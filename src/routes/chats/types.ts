import type { ObjectId } from "mongodb";

export type ChatMessageIssuer = "user" | "model";

export interface ChatMessage {
  timestamp: Date;
  issuer: ChatMessageIssuer;
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

export interface AddChatMessageBody {
  issuer: ChatMessageIssuer;
  text: string;
}
