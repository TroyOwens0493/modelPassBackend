import { db } from "../db.js";
import type {
  BillingUserDocument,
  CreditTransactionDocument,
} from "./types.js";

export function billingUsersCollection() {
  return db().collection<BillingUserDocument>("users");
}

export function creditTransactionsCollection() {
  return db().collection<CreditTransactionDocument>("creditTransactions");
}

export async function ensureBillingIndexes() {
  await Promise.all([
    billingUsersCollection().createIndex(
      { workosUserId: 1 },
      { unique: true, name: "users_workos_user_id_unique" },
    ),
    billingUsersCollection().createIndex(
      { polarCustomerId: 1 },
      {
        unique: true,
        sparse: true,
        name: "users_polar_customer_id_unique",
      },
    ),
    creditTransactionsCollection().createIndex(
      { externalId: 1 },
      { unique: true, name: "credit_transactions_external_id_unique" },
    ),
    creditTransactionsCollection().createIndex(
      { workosUserId: 1, createdAt: -1 },
      { name: "credit_transactions_user_created_at" },
    ),
  ]);
}
