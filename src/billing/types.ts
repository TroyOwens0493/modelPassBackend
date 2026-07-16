import type { ObjectId } from "mongodb";

export type CreditTransactionType =
  | "purchase"
  | "usage"
  | "refund"
  | "adjustment"
  | "bonus";

export interface CreditReservation {
  id: string;
  credits: number;
  createdAt: Date;
  completionId?: string;
  model?: string;
}

export interface BillingUserDocument {
  _id?: ObjectId;
  workosUserId: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
  name?: string;
  replyStyle?: string;
  defaultModel?: string;
  polarCustomerId?: string;
  creditBalance: number;
  creditsUsed: number;
  tokensUsed: number;
  creditReservations?: CreditReservation[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditTransactionDocument {
  _id?: ObjectId;
  workosUserId: string;
  type: CreditTransactionType;
  credits: number;
  balanceAfter: number;
  description: string;
  source: "polar" | "openrouter" | "admin";
  externalId: string;
  tokens?: number;
  costUsd?: number;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: Date;
}

export interface CreditPurchase {
  workosUserId: string;
  credits: number;
  description: string;
  externalId: string;
  metadata?: CreditTransactionDocument["metadata"];
}
