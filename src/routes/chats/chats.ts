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

chatsRouter.post("/:chatId", async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { newMsg } = req.body;

    if (typeof chatId !== "string" || !ObjectId.isValid(chatId)) {
        return res.status(404).json({ error: "Not found" });
    }

    const chat = await chatsDb.findOne({ _id: new ObjectId(chatId) });

    if (!chat) {
        return res.status(404).json({ error: "Not found" });
    }

    const history = chat.messages as ChatMessage[];
    const newChatWithHistory = history.push(newMsg);

    const allMsgs = newChatWithHistory.map((msg: ChatMessage) => {
        return { role, text };
    });

    const completion = await client.chat.send({
        model: '~openai/gpt-latest',
        messages: allMsgs,
    });

    return res.json(completion);
});

chatsRouter.get("/all/:userId", async (req: Request, res: Response) => {
});
