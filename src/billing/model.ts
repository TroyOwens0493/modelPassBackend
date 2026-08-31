import { db } from "../db.js";
import type { AuditRecordDocument, BillingUserDocument, DepositIntentDocument, LedgerEntryDocument } from "./types.js";

export const billingUsersCollection = () => db().collection<BillingUserDocument>("users");
export const ledgerEntriesCollection = () => db().collection<LedgerEntryDocument>("balanceLedger");
export const depositIntentsCollection = () => db().collection<DepositIntentDocument>("depositIntents");
export const auditRecordsCollection = () => db().collection<AuditRecordDocument>("billingAuditRecords");
export const usageShortfallsCollection = () => db().collection("usageBoundShortfalls");
export const paymentShortfallsCollection = () => db().collection("paymentShortfalls");
export const flowControlsCollection = () => db().collection("billingFlowControls");
export const depositLotsCollection = () => db().collection("balanceDepositLots");
export const refundHoldsCollection = () => db().collection("refundHolds");

export async function ensureBillingIndexes() {
  await Promise.all([
    billingUsersCollection().createIndex({ workosUserId: 1 }, { unique: true, name: "users_workos_user_id_unique" }),
    billingUsersCollection().createIndex({ polarCustomerId: 1 }, { unique: true, sparse: true, name: "users_polar_customer_id_unique" }),
    ledgerEntriesCollection().createIndex({ idempotencyKey: 1 }, { unique: true, name: "balance_ledger_idempotency_unique" }),
    ledgerEntriesCollection().createIndex({ workosUserId: 1, createdAt: -1 }, { name: "balance_ledger_user_created_at" }),
    depositIntentsCollection().createIndex({ id: 1 }, { unique: true, name: "deposit_intent_id_unique" }),
    depositIntentsCollection().createIndex({ polarCheckoutId: 1 }, { unique: true, sparse: true, name: "deposit_intent_checkout_unique" }),
    auditRecordsCollection().createIndex({ retainUntil: 1 }, { name: "billing_audit_retention", expireAfterSeconds: 0 }),
    usageShortfallsCollection().createIndex({ generationId: 1 }, { unique: true, name: "usage_shortfall_generation_unique" }),
    depositLotsCollection().createIndex({ polarOrderId: 1 }, { unique: true, name: "deposit_lot_order_unique" }),
    depositLotsCollection().createIndex({ workosUserId: 1, createdAt: 1 }, { name: "deposit_lot_fifo" }),
    refundHoldsCollection().createIndex({ id: 1 }, { unique: true, name: "refund_hold_id_unique" }),
  ]);
}
