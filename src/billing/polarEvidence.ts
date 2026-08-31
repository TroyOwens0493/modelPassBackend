import type { DepositIntentDocument } from "./types.js";
import { depositLotsCollection } from "./model.js";
import { applyForcedReversal, placeDisputeHold, resolveDispute, resolveRefundHold } from "./reversals.js";

export function paidOrderMatchesIntent(order: { customer: { externalId?: string | null }; currency: string; productId?: string | null; netAmount: number; discountAmount: number; metadata?: Record<string, unknown> }, intent: DepositIntentDocument, productId: string | undefined) {
  return order.customer.externalId === intent.workosUserId && order.currency.toLowerCase() === "usd" && order.productId === productId && order.netAmount === intent.depositCents + intent.fundingFeeCents && order.discountAmount === 0 && Number(order.metadata?.depositCents) === intent.depositCents && Number(order.metadata?.fundingFeeCents) === intent.fundingFeeCents && order.metadata?.feePolicyVersion === intent.feePolicyVersion;
}

export async function processPolarRefund(refund: { id: string; orderId: string; status: string; metadata?: Record<string, unknown>; dispute?: { id: string; status: string } | null }) {
  const lot = await depositLotsCollection().findOne({ polarOrderId: refund.orderId });
  if (!lot) return "unmatched";
  const workosUserId = lot.workosUserId as string;
  const refundHoldId = typeof refund.metadata?.refundHoldId === "string" ? refund.metadata.refundHoldId : undefined;
  if (refund.dispute) {
    if (refund.dispute.status === "won") await resolveDispute(refund.dispute.id, "won");
    else if (refund.dispute.status === "lost" || refund.dispute.status === "prevented") await resolveDispute(refund.dispute.id, "lost");
    else await placeDisputeHold(workosUserId, refund.orderId, refund.dispute.id);
    return `dispute_${refund.dispute.status}`;
  }
  if (refundHoldId && ["succeeded", "failed", "canceled"].includes(refund.status)) {
    await resolveRefundHold(refundHoldId, refund.status as "succeeded" | "failed" | "canceled", refund.id);
    return `voluntary_${refund.status}`;
  }
  if (refund.status === "succeeded") { await applyForcedReversal(workosUserId, refund.orderId, refund.id); return "forced_reversal"; }
  return `pending_${refund.status}`;
}
