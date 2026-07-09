import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { chatsCollection } from "./model.js";
import { OpenRouter } from '@openrouter/sdk';
import type { Router as RouterType } from "express";
import type { ChatMessage } from "./types.js";

export const chatsRouter: RouterType = Router();

const OPEN_ROUTER_KEY = process.env.OPEN_ROUTER_KEY;
const chatsDb = chatsCollection();

const client = new OpenRouter({
    apiKey: OPEN_ROUTER_KEY,
    httpReferer: 'modelpass.netlify.app',
    appTitle: 'Model Pass'
});

chatsRouter.get("/", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
});

// Returns the ids and titles for every chat owned by the given numeric user id.
chatsRouter.get("/all/:userId", async (req: Request, res: Response) => {
    const { userId } = req.params;
    const parsedUserId = Number(userId);

    if (typeof userId !== "string" || !Number.isInteger(parsedUserId)) {
        return res.status(400).json({ error: "Invalid userId" });
    }

    const chats = await chatsDb
        .find({ userId: parsedUserId })
        .project<{ _id: ObjectId; title: string }>({ _id: 1, title: 1 })
        .toArray();

    return res.json(chats);
});

// Returns the full chat document for the given Mongo chat _id.
chatsRouter.get("/:chatId", async (req: Request, res: Response) => {
    const { chatId } = req.params;

    if (typeof chatId !== "string" || !ObjectId.isValid(chatId)) {
        return res.status(404).json({ error: "Not found" });
    }

    const chat = await chatsDb.findOne({ _id: new ObjectId(chatId) });

    if (!chat) {
        return res.status(404).json({ error: "Not found" });
    }

    return res.json(chat);
});

// Get a response from the model.
// Todo: stream the response in the future.
chatsRouter.post("/response", async (req: Request, res: Response) => {
    const { messages } = req.body;

    const allMsgs = messages.map((msg: ChatMessage) => {
        return { role: msg.role, text: msg.text };
    });

    const completion = await client.chat.send({
        model: chat.model,
        messages: allMsgs,
    });

    return res.json(completion);
});

// Append a message to the db chat history
chatsRouter.post("/addMessage/:chatId", async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const msg = req.body as ChatMessage;

    if (typeof chatId !== "string" || !ObjectId.isValid(chatId)) {
        return res.status(404).json({ error: "Not found" });
    }

    if (!["user", "model", "system"].includes(msg.role) || typeof msg.text !== "string" || msg.text.trim().length === 0) {
        return res.status(400).json({ error: "Invalid message" });
    }

    const updatedChat = await chatsDb.findOneAndUpdate(
        { _id: new ObjectId(chatId) },
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
