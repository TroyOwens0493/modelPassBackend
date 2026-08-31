import type { Decimal128, ObjectId } from "mongodb";

export type LedgerEntryType = "deposit" | "hold" | "usage" | "hold_release" | "refund_hold" | "refund" | "dispute_hold" | "reversal" | "correction";
export interface UsageHold { id: string; amount: Decimal128; createdAt: Date; generationId?: string; model?: string; }
export interface BillingUserDocument {
  _id?: ObjectId; workosUserId: string; email?: string; polarCustomerId?: string;
  balance: Decimal128; reservedDepositCapacity: Decimal128; usageHolds?: UsageHold[];
  billingFrozen?: boolean; freezeReason?: string; defaultModel: string; createdAt: Date; updatedAt: Date;
}
export interface LedgerEntryDocument {
  _id?: ObjectId; workosUserId: string; type: LedgerEntryType; delta: Decimal128; balanceAfter: Decimal128;
  description: string; source: "polar" | "openrouter" | "reconciliation" | "admin"; idempotencyKey: string;
  referenceId?: string; providerCost?: Decimal128; markup?: Decimal128; usageCharge?: Decimal128;
  metadata?: Record<string, string | number | boolean | null>; createdAt: Date;
}
export interface DepositIntentDocument {
  _id?: ObjectId; id: string; workosUserId: string; depositCents: number; fundingFeeCents: number;
  feePolicyVersion: string; reservedCents: number; status: "created" | "checkout_created" | "paid" | "released" | "reconciliation";
  polarCheckoutId?: string; polarOrderId?: string; createdAt: Date; updatedAt: Date;
  expiresAt?: Date;
}
export interface AuditRecordDocument {
  _id?: ObjectId; workosUserId?: string; kind: string; providerId?: string; idempotencyKey?: string;
  outcome: string; details?: Record<string, string | number | boolean | null>; retainUntil: Date; createdAt: Date;
}
