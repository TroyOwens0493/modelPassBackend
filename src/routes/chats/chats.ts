import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { chatsCollection } from "./model.js";
import { OpenRouter } from '@openrouter/sdk';
import type { ChatMessages } from "@openrouter/sdk/models";
import type { Router as RouterType } from "express";
import type { ChatMessage } from "./types.js";

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
        const completion = await client.chat.send({
            chatRequest: {
                model,
                messages: allMsgs,
                stream: true
            },
        });

        res.status(200);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.flushHeaders();

        for await (const chunk of completion) {
            if (res.destroyed) {
                break;
            }

            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                res.write(content);
            }
        }

        return res.end();
    } catch (error) {
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
