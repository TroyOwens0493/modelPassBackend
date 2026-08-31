import { randomUUID } from "node:crypto";
import { mongoClient } from "../db.js";
import { auditRecordsCollection, billingUsersCollection, depositLotsCollection, ledgerEntriesCollection, paymentShortfallsCollection, refundHoldsCollection } from "./model.js";
import { centsToUsd, decimalUsd, parseUsd } from "./money.js";
const openRetention = new Date("9999-12-31T23:59:59.000Z");
const closedRetention = () => new Date(Date.now() + 10 * 365.25 * 24 * 60 * 60 * 1000);

export async function placeRefundHold(workosUserId: string, polarOrderId: string, refundCents: number) {
  const amount = centsToUsd(refundCents);
  const session = mongoClient.startSession();
  try { return await session.withTransaction(async () => {
    const [user, lot] = await Promise.all([billingUsersCollection().findOne({ workosUserId }, { session }), depositLotsCollection().findOne({ workosUserId, polarOrderId }, { session })]);
    if (!user || !lot || amount <= 0n || parseUsd(lot.remaining as never) < amount || parseUsd(user.balance) < amount) throw new Error("Refund exceeds the unspent attributable Deposit");
    const id = randomUUID(), next = parseUsd(user.balance) - amount, key = `refund-hold:${id}`;
    await billingUsersCollection().updateOne({ workosUserId }, { $set: { balance: decimalUsd(next), updatedAt: new Date() } }, { session });
    await refundHoldsCollection().insertOne({ id, workosUserId, polarOrderId, amount: decimalUsd(amount), status: "pending", createdAt: new Date(), updatedAt: new Date() }, { session });
    await ledgerEntriesCollection().insertOne({ workosUserId, type: "refund_hold", delta: decimalUsd(-amount), balanceAfter: decimalUsd(next), description: "Pending voluntary refund", source: "polar", idempotencyKey: key, referenceId: id, createdAt: new Date() }, { session });
    await auditRecordsCollection().insertOne({ workosUserId, kind: "refund", providerId: polarOrderId, idempotencyKey: key, outcome: "refund_hold_pending", retainUntil: openRetention, createdAt: new Date() }, { session });
    return { id, refundCents };
  }); } finally { await session.endSession(); }
}

export async function resolveRefundHold(holdId: string, outcome: "succeeded" | "failed" | "canceled", polarRefundId: string) {
  const session = mongoClient.startSession();
  try { return await session.withTransaction(async () => {
    const hold = await refundHoldsCollection().findOne({ id: holdId, status: "pending" }, { session });
    if (!hold) return { applied: false };
    const user = await billingUsersCollection().findOne({ workosUserId: hold.workosUserId }, { session });
    if (!user) throw new Error("Refund Customer was not found");
    const amount = parseUsd(hold.amount as never), succeeded = outcome === "succeeded", release = succeeded ? 0n : amount, next = parseUsd(user.balance) + release;
    if (succeeded) {
      const lot = await depositLotsCollection().findOne({ workosUserId: hold.workosUserId, polarOrderId: hold.polarOrderId }, { session });
      if (!lot || parseUsd(lot.remaining as never) < amount) throw new Error("Refund attribution is inconsistent");
      await depositLotsCollection().updateOne({ _id: lot._id }, { $set: { remaining: decimalUsd(parseUsd(lot.remaining as never) - amount), updatedAt: new Date() } }, { session });
    }
    await billingUsersCollection().updateOne({ workosUserId: hold.workosUserId }, { $set: { balance: decimalUsd(next), updatedAt: new Date() } }, { session });
    await ledgerEntriesCollection().insertOne({ workosUserId: hold.workosUserId, type: succeeded ? "refund" : "hold_release", delta: decimalUsd(release), balanceAfter: decimalUsd(next), description: succeeded ? "Voluntary Deposit refund" : "Released Refund Hold", source: "polar", idempotencyKey: `polar:refund:${polarRefundId}:${outcome}`, referenceId: holdId, createdAt: new Date() }, { session });
    await refundHoldsCollection().updateOne({ id: holdId }, { $set: { status: outcome, polarRefundId, updatedAt: new Date() } }, { session });
    await auditRecordsCollection().updateMany({ workosUserId: hold.workosUserId, kind: "refund", providerId: hold.polarOrderId }, { $set: { outcome: `refund_${outcome}`, retainUntil: closedRetention() } }, { session });
    return { applied: true };
  }); } finally { await session.endSession(); }
}

export async function applyForcedReversal(workosUserId: string, polarOrderId: string, reversalId: string) {
  const session = mongoClient.startSession();
  try { return await session.withTransaction(async () => {
    const key = `polar:reversal:${reversalId}`;
    if (await ledgerEntriesCollection().findOne({ idempotencyKey: key }, { session })) return { applied: false };
    const [user, lot] = await Promise.all([billingUsersCollection().findOne({ workosUserId }, { session }), depositLotsCollection().findOne({ workosUserId, polarOrderId }, { session })]);
    if (!user || !lot) throw new Error("Reversed Deposit was not found");
    const remaining = parseUsd(lot.remaining as never), original = parseUsd(lot.original as never), removable = parseUsd(user.balance) < remaining ? parseUsd(user.balance) : remaining;
    const next = parseUsd(user.balance) - removable, shortfall = original - removable;
    await billingUsersCollection().updateOne({ workosUserId }, { $set: { balance: decimalUsd(next), billingFrozen: true, freezeReason: `payment-reversal:${reversalId}`, updatedAt: new Date() } }, { session });
    await depositLotsCollection().updateOne({ _id: lot._id }, { $set: { remaining: decimalUsd(remaining - removable), updatedAt: new Date() } }, { session });
    await ledgerEntriesCollection().insertOne({ workosUserId, type: "reversal", delta: decimalUsd(-removable), balanceAfter: decimalUsd(next), description: "Forced Deposit reversal", source: "polar", idempotencyKey: key, referenceId: polarOrderId, createdAt: new Date() }, { session });
    if (shortfall > 0n) await paymentShortfallsCollection().insertOne({ workosUserId, polarOrderId, reversalId, amount: decimalUsd(shortfall), recoverableFromCustomer: false, createdAt: new Date() }, { session });
    await auditRecordsCollection().insertOne({ workosUserId, kind: "forced_reversal", providerId: reversalId, idempotencyKey: key, outcome: shortfall > 0n ? "payment_shortfall_recorded" : "balance_removed", retainUntil: shortfall > 0n ? openRetention : closedRetention(), createdAt: new Date() }, { session });
    return { applied: true, shortfall: decimalUsd(shortfall) };
  }); } finally { await session.endSession(); }
}

export async function placeDisputeHold(workosUserId: string, polarOrderId: string, disputeId: string) {
  const session = mongoClient.startSession();
  try { return await session.withTransaction(async () => {
    const existing = await refundHoldsCollection().findOne({ id: `dispute:${disputeId}` }, { session });
    if (existing) return { amount: existing.amount };
    const [user, lot] = await Promise.all([billingUsersCollection().findOne({ workosUserId }, { session }), depositLotsCollection().findOne({ workosUserId, polarOrderId }, { session })]);
    if (!user || !lot) throw new Error("Disputed Deposit was not found");
    const attributable = parseUsd(lot.remaining as never), balance = parseUsd(user.balance), amount = balance < attributable ? balance : attributable, next = balance - amount;
    await billingUsersCollection().updateOne({ workosUserId }, { $set: { balance: decimalUsd(next), billingFrozen: true, freezeReason: `dispute:${disputeId}`, updatedAt: new Date() } }, { session });
    await refundHoldsCollection().insertOne({ id: `dispute:${disputeId}`, kind: "dispute", workosUserId, polarOrderId, amount: decimalUsd(amount), status: "pending", createdAt: new Date(), updatedAt: new Date() }, { session });
    await ledgerEntriesCollection().insertOne({ workosUserId, type: "dispute_hold", delta: decimalUsd(-amount), balanceAfter: decimalUsd(next), description: "Disputed Deposit Hold", source: "reconciliation", idempotencyKey: `dispute-hold:${disputeId}`, referenceId: polarOrderId, createdAt: new Date() }, { session });
    await auditRecordsCollection().insertOne({ workosUserId, kind: "dispute", providerId: disputeId, idempotencyKey: `dispute:${disputeId}`, outcome: "dispute_hold_pending", retainUntil: openRetention, createdAt: new Date() }, { session });
    return { amount: decimalUsd(amount) };
  }); } finally { await session.endSession(); }
}

export async function resolveDispute(disputeId: string, outcome: "won" | "lost") {
  const session = mongoClient.startSession();
  try { return await session.withTransaction(async () => {
    const hold = await refundHoldsCollection().findOne({ id: `dispute:${disputeId}`, status: "pending" }, { session });
    if (!hold) return { applied: false };
    const [user, lot] = await Promise.all([billingUsersCollection().findOne({ workosUserId: hold.workosUserId }, { session }), depositLotsCollection().findOne({ workosUserId: hold.workosUserId, polarOrderId: hold.polarOrderId }, { session })]);
    if (!user || !lot) throw new Error("Dispute attribution is inconsistent");
    const amount = parseUsd(hold.amount as never), release = outcome === "won" ? amount : 0n, next = parseUsd(user.balance) + release;
    if (outcome === "lost") {
      const remaining = parseUsd(lot.remaining as never), shortfall = parseUsd(lot.original as never) - amount;
      await depositLotsCollection().updateOne({ _id: lot._id }, { $set: { remaining: decimalUsd(remaining - amount), updatedAt: new Date() } }, { session });
      if (shortfall > 0n) await paymentShortfallsCollection().insertOne({ workosUserId: hold.workosUserId, polarOrderId: hold.polarOrderId, reversalId: disputeId, amount: decimalUsd(shortfall), recoverableFromCustomer: false, createdAt: new Date() }, { session });
    }
    await billingUsersCollection().updateOne(
      { workosUserId: hold.workosUserId },
      outcome === "lost"
        ? { $set: { balance: decimalUsd(next), billingFrozen: true, freezeReason: `lost-dispute:${disputeId}`, updatedAt: new Date() } }
        : { $set: { balance: decimalUsd(next), billingFrozen: true, freezeReason: `reconcile-after-won-dispute:${disputeId}`, updatedAt: new Date() } },
      { session },
    );
    await ledgerEntriesCollection().insertOne({ workosUserId: hold.workosUserId, type: outcome === "won" ? "hold_release" : "reversal", delta: decimalUsd(release), balanceAfter: decimalUsd(next), description: outcome === "won" ? "Released Dispute Hold" : "Lost Deposit dispute", source: "reconciliation", idempotencyKey: `dispute:${disputeId}:${outcome}`, referenceId: hold.polarOrderId as string, createdAt: new Date() }, { session });
    await refundHoldsCollection().updateOne({ _id: hold._id }, { $set: { status: outcome, updatedAt: new Date() } }, { session });
    await auditRecordsCollection().updateMany({ workosUserId: hold.workosUserId, kind: "dispute", providerId: disputeId }, { $set: { outcome: `dispute_${outcome}`, retainUntil: outcome === "won" ? closedRetention() : openRetention } }, { session });
    return { applied: true };
  }); } finally { await session.endSession(); }
}
