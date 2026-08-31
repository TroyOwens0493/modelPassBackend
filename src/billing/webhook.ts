import type { Request, Response } from "express";
import { Polar } from "@polar-sh/sdk";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { applyPaidDeposit } from "./balanceLedger.js";
import { auditRecordsCollection, billingUsersCollection, depositIntentsCollection, flowControlsCollection } from "./model.js";
import { releaseDepositIntent } from "./deposits.js";
import { paidOrderMatchesIntent, processPolarRefund } from "./polarEvidence.js";

const headers = (req: Request) => Object.fromEntries(Object.entries(req.headers).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
const tenYearsFromNow = () => new Date(Date.now() + 10 * 365.25 * 24 * 60 * 60 * 1000);
const unresolvedRetention = () => new Date(Date.now() + 100 * 365.25 * 24 * 60 * 60 * 1000);

async function initiateExceptionalRefund(orderId: string, amount: number, intentId: string) {
  if (!process.env.POLAR_ACCESS_TOKEN) throw new Error("Polar refund credentials are unavailable");
  const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN, server: process.env.POLAR_SERVER === "production" ? "production" : "sandbox" });
  return polar.refunds.create({ orderId, amount, reason: "other", comment: "Automatic refund: rejected ModelPass Deposit", metadata: { depositIntentId: intentId, exceptionalRefund: true } });
}

export async function polarWebhookHandler(req: Request, res: Response) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: "Polar webhook is not configured" });
  try {
    const event = validateEvent(req.body, headers(req), secret);
    if (event.type === "checkout.expired") {
      const intentId = typeof event.data.metadata?.depositIntentId === "string" ? event.data.metadata.depositIntentId : "";
      if (intentId) await releaseDepositIntent(intentId);
      return res.status(202).json({ received: true });
    }
    if (event.type === "checkout.updated" && ["expired", "failed"].includes(event.data.status)) {
      const intentId = typeof event.data.metadata?.depositIntentId === "string" ? event.data.metadata.depositIntentId : "";
      if (intentId) await releaseDepositIntent(intentId);
      return res.status(202).json({ received: true });
    }
    if (event.type === "refund.updated") {
      const outcome = await processPolarRefund(event.data);
      if (outcome === "unmatched") {
        await flowControlsCollection().updateOne({ flow: "polar_deposits" }, { $set: { flow: "polar_deposits", paused: true, reason: "unmatched_refund", updatedAt: new Date() } }, { upsert: true });
        await auditRecordsCollection().insertOne({ kind: "polar_refund", providerId: event.data.id, outcome: "unmatched_refund_flow_paused", retainUntil: unresolvedRetention(), createdAt: new Date() });
        console.error("ALERT: unmatched Polar Refund", event.data.id);
      }
      return res.status(202).json({ received: true, outcome });
    }
    if (event.type !== "order.paid") return res.status(202).send();
    const order = event.data;
    const intentId = typeof order.metadata?.depositIntentId === "string" ? order.metadata.depositIntentId : "";
    const intent = intentId ? await depositIntentsCollection().findOne({ id: intentId }) : null;
    const expectedProduct = process.env.POLAR_WALLET_PRODUCT_ID;
    const valid = Boolean(intent && paidOrderMatchesIntent(order, intent, expectedProduct));
    if (!valid || !intent) {
      if (intent) await depositIntentsCollection().updateOne({ id: intent.id }, { $set: { status: "reconciliation", polarOrderId: order.id, updatedAt: new Date() } });
      if (intent) await billingUsersCollection().updateOne({ workosUserId: intent.workosUserId }, { $set: { billingFrozen: true, freezeReason: `polar-order:${order.id}`, updatedAt: new Date() } });
      await flowControlsCollection().updateOne({ flow: "polar_deposits" }, { $set: { flow: "polar_deposits", paused: true, reason: "contradictory_provider_evidence", updatedAt: new Date() } }, { upsert: true });
      let refundInitiated = false;
      try { if (order.productId === expectedProduct) { await initiateExceptionalRefund(order.id, order.netAmount, intentId); refundInitiated = true; } }
      catch (refundError) { console.error("ALERT: rejected Deposit refund initiation failed", order.id, refundError); }
      await auditRecordsCollection().insertOne({ workosUserId: intent?.workosUserId, kind: "polar_order_validation", providerId: order.id, outcome: refundInitiated ? "full_refund_initiated_no_balance_credit" : "reconciliation_required_refund_failed", details: { intentId: intentId || null }, retainUntil: refundInitiated ? tenYearsFromNow() : unresolvedRetention(), createdAt: new Date() });
      return res.status(422).json({ error: "Paid Order did not match its Deposit Intent" });
    }
    const result = await applyPaidDeposit({ intentId: intent.id, orderId: order.id, customerId: order.customerId });
    if ("rejected" in result && result.rejected) {
      await initiateExceptionalRefund(order.id, order.netAmount, intent.id);
      return res.status(202).json({ received: true, applied: false, refundInitiated: true });
    }
    return res.status(202).json({ received: true, applied: result.applied });
  } catch (error) {
    if (error instanceof WebhookVerificationError) return res.status(403).json({ error: "Invalid webhook signature" });
    console.error("Unable to process Polar webhook:", error);
    return res.status(500).json({ error: "Unable to process webhook" });
  }
}
