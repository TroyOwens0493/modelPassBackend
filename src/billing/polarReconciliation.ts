import { Polar } from "@polar-sh/sdk";
import { applyPaidDeposit } from "./balanceLedger.js";
import { auditRecordsCollection, billingUsersCollection, depositIntentsCollection, flowControlsCollection, refundHoldsCollection } from "./model.js";
import { paidOrderMatchesIntent, processPolarRefund } from "./polarEvidence.js";

const tenYearsFromNow = () => new Date(Date.now() + 10 * 365.25 * 24 * 60 * 60 * 1000);
export async function reconcilePolarEvidence() {
  if (!process.env.POLAR_ACCESS_TOKEN) throw new Error("POLAR_ACCESS_TOKEN is required");
  const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN, server: process.env.POLAR_SERVER === "production" ? "production" : "sandbox" });
  let applied = 0, skipped = 0, inconsistent = 0, refundFailures = 0;
  const pages = await polar.orders.list({ limit: 100 });
  for await (const page of pages) {
    for (const order of page.result.items) {
      const intentId = typeof order.metadata?.depositIntentId === "string" ? order.metadata.depositIntentId : "";
      const intent = intentId ? await depositIntentsCollection().findOne({ id: intentId }) : null;
      if (!order.paid) { skipped += 1; await auditRecordsCollection().insertOne({ kind: "polar_reconciliation", providerId: order.id, outcome: "unpaid_no_balance_effect", retainUntil: tenYearsFromNow(), createdAt: new Date() }); continue; }
      if (!intent) { skipped += 1; inconsistent += 1; await auditRecordsCollection().insertOne({ kind: "polar_reconciliation", providerId: order.id, outcome: "paid_order_missing_deposit_intent", retainUntil: new Date("9999-12-31T23:59:59.000Z"), createdAt: new Date() }); console.error("ALERT: paid Polar Order has no Deposit Intent", order.id); continue; }
      const valid = paidOrderMatchesIntent(order, intent, process.env.POLAR_WALLET_PRODUCT_ID);
      if (!valid) {
        inconsistent += 1;
        let refundFailed = false;
        await depositIntentsCollection().updateOne({ id: intent.id }, { $set: { status: "reconciliation", updatedAt: new Date() } });
        await billingUsersCollection().updateOne({ workosUserId: intent.workosUserId }, { $set: { billingFrozen: true, freezeReason: `polar-order:${order.id}`, updatedAt: new Date() } });
        try { await polar.refunds.create({ orderId: order.id, amount: order.netAmount, reason: "other", comment: "Automatic refund: rejected ModelPass Deposit", metadata: { depositIntentId: intent.id, exceptionalRefund: true } }); }
        catch (error) { refundFailed = true; refundFailures += 1; console.error("ALERT: rejected Deposit refund initiation failed", order.id, error); }
        await auditRecordsCollection().insertOne({ workosUserId: intent.workosUserId, kind: "polar_reconciliation", providerId: order.id, outcome: refundFailed ? "contradictory_order_refund_failed" : "contradictory_order_refund_initiated", retainUntil: refundFailed ? new Date("9999-12-31T23:59:59.000Z") : tenYearsFromNow(), createdAt: new Date() });
        console.error("ALERT: contradictory Polar Order", order.id);
        continue;
      }
      const result = await applyPaidDeposit({ intentId: intent.id, orderId: order.id, customerId: order.customerId });
      result.applied ? applied += 1 : skipped += 1;
      await auditRecordsCollection().insertOne({ workosUserId: intent.workosUserId, kind: "polar_reconciliation", providerId: order.id, idempotencyKey: `polar-reconcile:${order.id}:${new Date().toISOString().slice(0, 10)}`, outcome: result.applied ? "authoritative_order_replayed" : "already_consistent", retainUntil: tenYearsFromNow(), createdAt: new Date() });
    }
  }
  const refundPages = await polar.refunds.list({ limit: 100 });
  for await (const page of refundPages) for (const refund of page.result.items) {
    try {
      const outcome = await processPolarRefund(refund);
      if (outcome === "unmatched") { refundFailures += 1; console.error("ALERT: unmatched Polar Refund", refund.id); }
      await auditRecordsCollection().insertOne({ kind: "polar_refund_reconciliation", providerId: refund.id, outcome, retainUntil: outcome.includes("pending") ? new Date("9999-12-31T23:59:59.000Z") : tenYearsFromNow(), createdAt: new Date() });
    } catch (error) { refundFailures += 1; console.error("ALERT: Polar Refund reconciliation failed", refund.id, error); }
  }
  const paused = inconsistent > 0 || refundFailures > 0;
  await flowControlsCollection().updateOne({ flow: "polar_deposits" }, { $set: { flow: "polar_deposits", paused, reason: paused ? "contradictory_or_incomplete_provider_evidence" : null, updatedAt: new Date() } }, { upsert: true });
  if (!paused) {
    const candidates = await billingUsersCollection().find({ billingFrozen: true, freezeReason: { $regex: "^(polar-order|reconcile-after-won-dispute):" } }).toArray();
    for (const customer of candidates) {
      const [intent, hold] = await Promise.all([
        depositIntentsCollection().findOne({ workosUserId: customer.workosUserId, status: "reconciliation" }),
        refundHoldsCollection().findOne({ workosUserId: customer.workosUserId, status: "pending" }),
      ]);
      if (!intent && !hold) await billingUsersCollection().updateOne({ workosUserId: customer.workosUserId }, { $set: { billingFrozen: false, updatedAt: new Date() }, $unset: { freezeReason: "" } });
    }
  }
  return { applied, skipped, inconsistent, refundFailures };
}
