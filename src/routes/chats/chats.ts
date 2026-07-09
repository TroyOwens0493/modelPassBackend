import { Router, Request, Response } from "express";
import type { Router as RouterType } from "express";
import type { ChatDocument } from "./types.js";

export const chatsRouter: RouterType = Router();

const OPEN_ROUTER_KEY = process.env.OPEN_ROUTER_KEY;

chatsRouter.get("/", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
});

chatsRouter.get("/:chatId", (_req: Request, res: Response) => {
    res.status(501).json({ error: "Chats route not implemented" });
});

chatsRouter.post("/:chatId", (_req: Request, res: Response) => {
    res.status(501).json({ error: "Chats route not implemented" });
});
