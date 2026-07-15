import type { ObjectId } from "mongodb";

export type CreditTransactionType =
  | "purchase"
  | "usage"
  | "refund"
  | "adjustment"
  | "bonus";

export interface BillingUserDocument {
  _id?: ObjectId;
  workosUserId: string;
  email?: string;
  polarCustomerId?: string;
  creditBalance: number;
  creditsUsed: number;
  tokensUsed: number;
  creditReservations?: Array<{
    id: string;
    credits: number;
    createdAt: Date;
    completionId?: string;
    model?: string;
  }>;
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

export type CreditChange = {
  workosUserId: string;
  type: CreditTransactionType;
  creditDelta: number;
  description: string;
  source: CreditTransactionDocument["source"];
  externalId: string;
  tokens?: number;
  costUsd?: number;
  metadata?: CreditTransactionDocument["metadata"];
};
