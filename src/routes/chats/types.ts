import type { ObjectId } from "mongodb";

export type ChatRole = "user" | "model" | "system";

export interface ChatMessage {
    timestamp: Date;
    role: ChatRole;
    text: string;
}

export interface ChatDocument {
    _id?: ObjectId;
    userId: number;
    title: string;
    model: string;
    messages: ChatMessage[];
    tokensUsed: number;
    creditsUsed: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateChatBody {
    userId: number;
    title: string;
    model: string;
}
