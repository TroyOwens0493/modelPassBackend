import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { chatsCollection } from "./model.js";
import type { ChatMessages } from "@openrouter/sdk/models";
import type { Router as RouterType } from "express";
import type { ChatDocument, ChatMessage, CreateChatBody } from "./types.js";
import { InsufficientCreditsError } from "../../billing/creditLedger.js";
import { streamBillableCompletion } from "../../billing/openRouterUsage.js";

export const chatsRouter: RouterType = Router();

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

// Creates an empty chat owned by the authenticated user.
chatsRouter.post("/", async (req: Request, res: Response) => {
    const { title, model } = req.body as Partial<CreateChatBody>;
    const userId = req.session!.user!.id;

    if (typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ error: "Invalid title" });
    }

    if (typeof model !== "string" || model.trim().length === 0) {
        return res.status(400).json({ error: "Invalid model" });
    }

    const now = new Date();
    const chat: ChatDocument = {
        userId,
        title: title.trim(),
        model,
        messages: [],
        tokensUsed: 0,
        creditsUsed: 0,
        createdAt: now,
        updatedAt: now,
    };
    const result = await chatsCollection().insertOne(chat);

    return res.status(201).json({ ...chat, _id: result.insertedId });
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
    try {
        await streamBillableCompletion({
            workosUserId: user.id,
            model,
            messages: allMsgs,
            onStart: () => {
                res.status(200);
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.setHeader("Cache-Control", "no-cache, no-transform");
                res.setHeader("X-Content-Type-Options", "nosniff");
                res.flushHeaders();
            },
            onText: (content) => {
                if (!res.destroyed) res.write(content);
            },
        });

        return res.end();
    } catch (error) {
        if (error instanceof InsufficientCreditsError) {
            return res.status(402).json({
                error: "Your balance is too low for this request. Add credits to continue.",
                code: "INSUFFICIENT_CREDITS",
            });
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

    const storedMessage: ChatMessage = {
        role: msg.role,
        text: msg.text,
        timestamp: new Date(),
    };

    const chatsDb = chatsCollection();
    const updatedChat = await chatsDb.findOneAndUpdate(
        chatFilter,
        {
            $push: { messages: storedMessage },
            $set: { updatedAt: new Date() },
        },
        { returnDocument: "after" },
    );

    if (!updatedChat) {
        return res.status(404).json({ error: "Not found" });
    }

    return res.json(updatedChat);
});
