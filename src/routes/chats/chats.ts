import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { chatsCollection } from "./model.js";
import { OpenRouter } from '@openrouter/sdk';
import type { ChatMessages, ChatUsage } from "@openrouter/sdk/models";
import type { Router as RouterType } from "express";
import type { ChatMessage } from "./types.js";
import {
    creditsForCost,
    finalizeCreditReservation,
    getPendingCreditReservations,
    InsufficientCreditsError,
    markCreditReservationPending,
    releaseCreditReservation,
    releaseExpiredUnlinkedReservations,
    reserveCredits,
} from "../../billing/creditLedger.js";

export const chatsRouter: RouterType = Router();

const OPEN_ROUTER_KEY = process.env.OPEN_ROUTER_API_KEY;

if (!OPEN_ROUTER_KEY) {
    throw new Error("OPENROUTER_API_KEY environment variable is required");
}

const client = new OpenRouter({
    apiKey: OPEN_ROUTER_KEY,
    httpReferer: 'modelpass.netlify.app',
    appTitle: 'Model Pass'
});

const maxOutputTokens = Math.max(
    16,
    Math.trunc(Number(process.env.MAX_OUTPUT_TOKENS ?? "1024")),
);
const pricingSafetyFactor = Math.max(
    1,
    Number(process.env.MODEL_PRICING_SAFETY_FACTOR ?? "2"),
);
const modelPricingCache = new Map<
    string,
    { prompt: number; completion: number; request: number; expiresAt: number }
>();

async function maximumCreditsForRequest(model: string, messages: ChatMessages[]) {
    let pricing = modelPricingCache.get(model);

    if (!pricing || pricing.expiresAt < Date.now()) {
        const separator = model.indexOf("/");
        if (separator < 1 || separator === model.length - 1) {
            throw new Error("Invalid OpenRouter model slug");
        }

        const response = await client.models.get({
            author: model.slice(0, separator),
            slug: model.slice(separator + 1),
        });
        pricing = {
            prompt: Number(response.data.pricing.prompt),
            completion: Number(response.data.pricing.completion),
            request: Number(response.data.pricing.request ?? "0"),
            expiresAt: Date.now() + 5 * 60 * 1000,
        };

        if (
            !Number.isFinite(pricing.prompt) ||
            !Number.isFinite(pricing.completion) ||
            !Number.isFinite(pricing.request)
        ) {
            throw new Error("OpenRouter returned invalid model pricing");
        }

        modelPricingCache.set(model, pricing);
    }

    const maximumInputTokens = messages.reduce(
        (total, message) =>
            total +
            (typeof message.content === "string"
                ? Buffer.byteLength(message.content, "utf8")
                : 0) +
            32,
        100,
    );
    const maximumCost =
        (maximumInputTokens * pricing.prompt +
            maxOutputTokens * pricing.completion +
            pricing.request) *
        pricingSafetyFactor;

    return creditsForCost(maximumCost);
}

async function resolveUsage(usage: ChatUsage | undefined, completionId: string | undefined) {
    const streamedCost = usage?.cost;

    if (streamedCost !== undefined && streamedCost !== null && usage) {
        return {
            costUsd: streamedCost,
            totalTokens: usage.totalTokens,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
        };
    }

    if (!completionId) {
        throw new Error("OpenRouter did not return a completion ID");
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));

        try {
            const generation = await client.generations.getGeneration({
                id: completionId,
            });
            const promptTokens = generation.data.tokensPrompt ?? usage?.promptTokens ?? 0;
            const completionTokens =
                generation.data.tokensCompletion ?? usage?.completionTokens ?? 0;

            return {
                costUsd: generation.data.totalCost,
                totalTokens: promptTokens + completionTokens,
                promptTokens,
                completionTokens,
            };
        } catch (error) {
            if (attempt === 2) {
                throw error;
            }
        }
    }

    throw new Error("OpenRouter usage was unavailable");
}

export async function reconcilePendingChatUsage() {
    await releaseExpiredUnlinkedReservations();
    const reservations = await getPendingCreditReservations();

    const results = await Promise.allSettled(
        reservations.map(async (reservation) => {
            const usage = await resolveUsage(undefined, reservation.completionId);
            await finalizeCreditReservation({
                workosUserId: reservation.workosUserId,
                reservationId: reservation.reservationId,
                externalId: reservation.completionId,
                requestedCredits: creditsForCost(usage.costUsd),
                description: `${reservation.model} response`,
                tokens: usage.totalTokens,
                costUsd: usage.costUsd,
                metadata: {
                    model: reservation.model,
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    reconciled: true,
                },
            });
        }),
    );

    for (const result of results) {
        if (result.status === "rejected") {
            console.warn("Unable to reconcile pending OpenRouter usage:", result.reason);
        }
    }
}

/** Builds a query that limits a chat ID to the authenticated owner. */
function getOwnedChatFilter(req: Request) {
    const { chatId } = req.params;
    const userId = req.session?.user?.id;

    if (typeof chatId !== "string" || !ObjectId.isValid(chatId) || !userId) {
        return null;
    }

    return { _id: new ObjectId(chatId), userId };
}

chatsRouter.get("/", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
});

// Returns the ids and titles for every chat owned by the authenticated user.
chatsRouter.get("/all/:userId", async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (typeof userId !== "string" || userId !== req.session?.user?.id) {
        return res.status(404).json({ error: "Not found" });
    }

    const chatsDb = chatsCollection();
    const chats = await chatsDb
        .find({ userId })
        .project<{ _id: ObjectId; title: string }>({ _id: 1, title: 1 })
        .toArray();

    return res.json(chats);
});

// Returns the full chat document for the given Mongo chat _id.
chatsRouter.get("/:chatId", async (req: Request, res: Response) => {
    const chatFilter = getOwnedChatFilter(req);

    if (!chatFilter) {
        return res.status(404).json({ error: "Not found" });
    }

    const chatsDb = chatsCollection();
    const chat = await chatsDb.findOne(chatFilter);

    if (!chat) {
        return res.status(404).json({ error: "Not found" });
    }

    return res.json(chat);
});

// Stream a response from the model as plain UTF-8 text.
chatsRouter.post("/response", async (req: Request, res: Response) => {
    const { messages, model } = req.body as { messages?: ChatMessage[]; model?: string };
    const user = req.session!.user!;

    if (typeof model !== "string" || model.trim().length === 0) {
        return res.status(400).json({ error: "Invalid model" });
    }

    if (!Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages" });
    }

    const allMsgs: ChatMessages[] = messages.map((msg) => ({
        role: msg.role === "model" ? "assistant" : msg.role,
        content: msg.text,
    }));
    const reservationId = randomUUID();

    try {
        const maximumCredits = await maximumCreditsForRequest(model, allMsgs);
        await reserveCredits(user.id, reservationId, maximumCredits);
    } catch (error) {
        if (error instanceof InsufficientCreditsError) {
            return res.status(402).json({
                error: "Your balance is too low for this request. Add credits to continue.",
                code: "INSUFFICIENT_CREDITS",
            });
        }

        console.error("Unable to reserve credits for model response:", error);
        return res.status(502).json({ error: "Unable to price the model request" });
    }

    let reservationActive = true;
    let reservationLinked = false;

    try {
        const completion = await client.chat.send({
            chatRequest: {
                model,
                messages: allMsgs,
                stream: true,
                maxTokens: maxOutputTokens,
            },
        });

        res.status(200);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.flushHeaders();

        let usage: ChatUsage | undefined;
        let completionId: string | undefined;

        for await (const chunk of completion) {
            if (!completionId) {
                completionId = chunk.id;
                await markCreditReservationPending(
                    user.id,
                    reservationId,
                    completionId,
                    model,
                );
                reservationLinked = true;
            }
            usage = chunk.usage ?? usage;

            const content = chunk.choices[0]?.delta?.content;
            if (content && !res.destroyed) {
                res.write(content);
            }
        }

        if (!completionId) {
            throw new Error("OpenRouter did not return a completion ID");
        }

        const resolvedUsage = await resolveUsage(usage, completionId);
        const creditCost = creditsForCost(resolvedUsage.costUsd);

        await finalizeCreditReservation({
            workosUserId: user.id,
            reservationId,
            externalId: completionId,
            requestedCredits: creditCost,
            description: `${model} response`,
            tokens: resolvedUsage.totalTokens,
            costUsd: resolvedUsage.costUsd,
            metadata: {
                model,
                promptTokens: resolvedUsage.promptTokens,
                completionTokens: resolvedUsage.completionTokens,
            },
        });
        reservationActive = false;

        return res.end();
    } catch (error) {
        if (reservationActive && !reservationLinked) {
            await releaseCreditReservation(user.id, reservationId);
        }

        console.error("OpenRouter request failed:", error);

        if (res.headersSent) {
            return res.end();
        }

        return res.status(502).json({ error: "Unable to get a response from the model" });
    }
});

// Append a message to the db chat history
chatsRouter.post("/addMessage/:chatId", async (req: Request, res: Response) => {
    const chatFilter = getOwnedChatFilter(req);
    const msg = req.body as ChatMessage;

    if (!chatFilter) {
        return res.status(404).json({ error: "Not found" });
    }

    if (!["user", "model", "system"].includes(msg.role) || typeof msg.text !== "string" || msg.text.trim().length === 0) {
        return res.status(400).json({ error: "Invalid message" });
    }

    const chatsDb = chatsCollection();
    const updatedChat = await chatsDb.findOneAndUpdate(
        chatFilter,
        {
            $push: { messages: msg },
            $set: { updatedAt: new Date() },
        },
        { returnDocument: "after" },
    );

    if (!updatedChat) {
        return res.status(404).json({ error: "Not found" });
    }

    return res.json(updatedChat);
});
