import { connectDb, mongoClient } from "../db.js";
import { ensureBillingIndexes } from "../billing/model.js";
import { reconcilePolarEvidence } from "../billing/polarReconciliation.js";

await connectDb();
await ensureBillingIndexes();
try {
  const result = await reconcilePolarEvidence();
  console.log(`Polar reconciliation complete: ${result.applied} applied, ${result.skipped} skipped, ${result.inconsistent} inconsistent, ${result.refundFailures} refund failures.`);
} finally { await mongoClient.close(); }
