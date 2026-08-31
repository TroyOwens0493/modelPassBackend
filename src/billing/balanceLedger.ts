import { MongoServerError, type ClientSession } from "mongodb";
import { mongoClient } from "../db.js";
import { DEFAULT_MODEL } from "../models/catalog.js";
import { auditRecordsCollection, billingUsersCollection, depositIntentsCollection, depositLotsCollection, flowControlsCollection, ledgerEntriesCollection, usageShortfallsCollection } from "./model.js";
import { centsToUsd, decimalUsd, parseProviderCost, parseUsd, usageCharge } from "./money.js";

export class InsufficientBalanceError extends Error { constructor() { super("Insufficient Balance"); } }
export class BillingFrozenError extends Error { constructor() { super("Billing is frozen pending reconciliation"); } }
const unresolvedRetention = () => new Date(Date.now() + 100 * 365.25 * 24 * 60 * 60 * 1000);

export async function getOrCreateBillingUser(workosUserId: string, email?: string, session?: ClientSession) {
  const now = new Date();
  let user = await billingUsersCollection().findOneAndUpdate({ workosUserId }, {
    $setOnInsert: { workosUserId, balance: decimalUsd(0n), reservedDepositCapacity: decimalUsd(0n), defaultModel: DEFAULT_MODEL, createdAt: now },
    $set: { ...(email ? { email } : {}), updatedAt: now },
  }, { upsert: true, returnDocument: "after", session });
  if (user && (!user.balance || !user.reservedDepositCapacity)) {
    user = await billingUsersCollection().findOneAndUpdate(
      { workosUserId },
      { $set: { ...(!user.balance ? { balance: decimalUsd(0n) } : {}), ...(!user.reservedDepositCapacity ? { reservedDepositCapacity: decimalUsd(0n) } : {}), updatedAt: now } },
      { returnDocument: "after", session },
    );
  }
  return user;
}

export async function setPolarCustomerId(workosUserId: string, polarCustomerId: string, session?: ClientSession) {
  await billingUsersCollection().updateOne({ workosUserId }, { $set: { polarCustomerId, updatedAt: new Date() } }, { session });
}
export async function setDefaultModel(workosUserId: string, defaultModel: string) {
  await billingUsersCollection().updateOne({ workosUserId }, { $set: { defaultModel, updatedAt: new Date() } });
}
export async function getRecentLedgerEntries(workosUserId: string, limit = 20) {
  return ledgerEntriesCollection().find({ workosUserId }).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function reserveBalance(workosUserId: string, holdId: string, amountText: string) {
  const amount = parseUsd(amountText);
  if (amount <= 0n) throw new Error("Hold must be positive");
  const session = mongoClient.startSession();
  try {
    return await session.withTransaction(async () => {
      const key = `hold:${holdId}`;
      if (await ledgerEntriesCollection().findOne({ idempotencyKey: key }, { session })) return amountText;
      const user = await getOrCreateBillingUser(workosUserId, undefined, session);
      if (!user) throw new Error("Unable to load billing Customer");
      if (user.billingFrozen) throw new BillingFrozenError();
      const balance = parseUsd(user.balance);
      if (balance < amount) throw new InsufficientBalanceError();
      const next = balance - amount;
      await billingUsersCollection().updateOne({ workosUserId }, {
        $set: { balance: decimalUsd(next), updatedAt: new Date() },
        $push: { usageHolds: { id: holdId, amount: decimalUsd(amount), createdAt: new Date() } },
      }, { session });
      await ledgerEntriesCollection().insertOne({ workosUserId, type: "hold", delta: decimalUsd(-amount), balanceAfter: decimalUsd(next), description: "Model request Hold", source: "openrouter", idempotencyKey: key, referenceId: holdId, createdAt: new Date() }, { session });
      return amountText;
    });
  } finally { await session.endSession(); }
}

export async function linkHold(workosUserId: string, holdId: string, generationId: string, model: string) {
  await billingUsersCollection().updateOne({ workosUserId, "usageHolds.id": holdId }, { $set: { "usageHolds.$.generationId": generationId, "usageHolds.$.model": model, updatedAt: new Date() } });
}

export async function markAmbiguousUnlinkedHold(workosUserId: string, holdId: string, model: string) {
  const session = mongoClient.startSession();
  try { await session.withTransaction(async () => {
    await billingUsersCollection().updateOne({ workosUserId, "usageHolds.id": holdId }, { $set: { "usageHolds.$.model": model, billingFrozen: true, freezeReason: `unlinked-generation:${holdId}`, updatedAt: new Date() } }, { session });
    await flowControlsCollection().updateOne({ flow: "openrouter_dispatch" }, { $set: { flow: "openrouter_dispatch", paused: true, reason: "dispatched_generation_without_id", updatedAt: new Date() } }, { upsert: true, session });
    await flowControlsCollection().updateOne({ flow: `openrouter:${model}` }, { $set: { flow: `openrouter:${model}`, paused: true, reason: "dispatched_generation_without_id", updatedAt: new Date() } }, { upsert: true, session });
    await auditRecordsCollection().insertOne({ workosUserId, kind: "ambiguous_openrouter_dispatch", idempotencyKey: `ambiguous:${holdId}`, outcome: "hold_retained_customer_frozen_flow_paused", details: { model }, retainUntil: unresolvedRetention(), createdAt: new Date() }, { session });
  }); } finally { await session.endSession(); }
}

export async function releaseHold(workosUserId: string, holdId: string) {
  const session = mongoClient.startSession();
  try {
    await session.withTransaction(async () => {
      const key = `hold-release:${holdId}`;
      if (await ledgerEntriesCollection().findOne({ idempotencyKey: key }, { session })) return;
      const user = await billingUsersCollection().findOne({ workosUserId, "usageHolds.id": holdId }, { session });
      const hold = user?.usageHolds?.find((item) => item.id === holdId);
      if (!user || !hold) return;
      const next = parseUsd(user.balance) + parseUsd(hold.amount);
      await billingUsersCollection().updateOne({ workosUserId, "usageHolds.id": holdId }, { $set: { balance: decimalUsd(next), updatedAt: new Date() }, $pull: { usageHolds: { id: holdId } } }, { session });
      await ledgerEntriesCollection().insertOne({ workosUserId, type: "hold_release", delta: hold.amount, balanceAfter: decimalUsd(next), description: "Released unused Hold", source: "openrouter", idempotencyKey: key, referenceId: holdId, createdAt: new Date() }, { session });
    });
  } finally { await session.endSession(); }
}

export async function finalizeUsage(input: { workosUserId: string; holdId: string; generationId: string; providerCost: string; tokens: number; model: string; reconciled?: boolean }) {
  const providerCost = parseProviderCost(input.providerCost);
  const charge = usageCharge(providerCost);
  const session = mongoClient.startSession();
  try {
    return await session.withTransaction(async () => {
      const key = `openrouter:generation:${input.generationId}`;
      if (await ledgerEntriesCollection().findOne({ idempotencyKey: key }, { session })) return { applied: false, violatedBound: false };
      const user = await billingUsersCollection().findOne({ workosUserId: input.workosUserId, "usageHolds.id": input.holdId }, { session });
      const hold = user?.usageHolds?.find((item) => item.id === input.holdId);
      if (!user || !hold) throw new Error("Usage Hold was not found");
      const held = parseUsd(hold.amount);
      const violatedBound = charge.total > held;
      const release = violatedBound ? 0n : held - charge.total;
      const next = parseUsd(user.balance) + release;
      const update: Record<string, unknown> = { balance: decimalUsd(next), updatedAt: new Date() };
      if (violatedBound) { update.billingFrozen = true; update.freezeReason = `usage-bound:${input.generationId}`; }
      await billingUsersCollection().updateOne({ workosUserId: input.workosUserId, "usageHolds.id": input.holdId }, { $set: update, $pull: { usageHolds: { id: input.holdId } } }, { session });
      await ledgerEntriesCollection().insertOne({
        workosUserId: input.workosUserId, type: "usage", delta: decimalUsd(release), balanceAfter: decimalUsd(next), description: `${input.model} response`,
        source: input.reconciled ? "reconciliation" : "openrouter", idempotencyKey: key, referenceId: input.holdId,
        providerCost: decimalUsd(providerCost), markup: decimalUsd(charge.markup), usageCharge: decimalUsd(charge.total),
        metadata: { model: input.model, tokens: input.tokens, violatedBound }, createdAt: new Date(),
      }, { session });
      let allocationRemaining = violatedBound ? held : charge.total;
      const lots = await depositLotsCollection().find({ workosUserId: input.workosUserId, remaining: { $ne: decimalUsd(0n) } }, { session }).sort({ createdAt: 1 }).toArray();
      for (const lot of lots) {
        if (allocationRemaining === 0n) break;
        const available = parseUsd(lot.remaining as never);
        const allocated = available < allocationRemaining ? available : allocationRemaining;
        await depositLotsCollection().updateOne({ _id: lot._id }, { $set: { remaining: decimalUsd(available - allocated), updatedAt: new Date() } }, { session });
        allocationRemaining -= allocated;
      }
      if (allocationRemaining > 0n) throw new Error("Deposit FIFO allocation did not cover the Usage Charge");
      if (violatedBound) {
        const excess = charge.total - held;
        await usageShortfallsCollection().insertOne({ workosUserId: input.workosUserId, generationId: input.generationId, hold: decimalUsd(held), usageCharge: decimalUsd(charge.total), amount: decimalUsd(excess), absorbedBy: "modelpass", createdAt: new Date() }, { session });
        await auditRecordsCollection().insertOne({ workosUserId: input.workosUserId, kind: "usage_bound_violation", providerId: input.generationId, idempotencyKey: key, outcome: "customer_frozen_endpoint_requires_disable", details: { model: input.model }, retainUntil: unresolvedRetention(), createdAt: new Date() }, { session });
        await flowControlsCollection().updateOne({ flow: `openrouter:${input.model}` }, { $set: { flow: `openrouter:${input.model}`, paused: true, reason: "usage_bound_violation", updatedAt: new Date() } }, { upsert: true, session });
      }
      return { applied: true, violatedBound };
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) return { applied: false, violatedBound: false };
    throw error;
  } finally { await session.endSession(); }
}

export async function applyPaidDeposit(input: { intentId: string; orderId: string; customerId: string }) {
  const session = mongoClient.startSession();
  try {
    return await session.withTransaction(async () => {
      const key = `polar:order:${input.orderId}`;
      const existing = await ledgerEntriesCollection().findOne({ idempotencyKey: key }, { session });
      if (existing) return { applied: false, entry: existing };
      const intent = await depositIntentsCollection().findOne({ id: input.intentId }, { session });
      if (!intent || !["created", "checkout_created"].includes(intent.status)) throw new Error("Deposit Intent is unavailable");
      const user = await getOrCreateBillingUser(intent.workosUserId, undefined, session);
      if (!user) throw new Error("Unable to load billing Customer");
      const deposit = centsToUsd(intent.depositCents);
      const holds = (user.usageHolds ?? []).reduce((sum, hold) => sum + parseUsd(hold.amount), 0n);
      const otherReserved = parseUsd(user.reservedDepositCapacity) - centsToUsd(intent.reservedCents);
      if (parseUsd(user.balance) + holds + (otherReserved < 0n ? 0n : otherReserved) + deposit > centsToUsd(199_999)) {
        await depositIntentsCollection().updateOne({ id: intent.id }, { $set: { status: "reconciliation", polarOrderId: input.orderId, updatedAt: new Date() } }, { session });
        return { applied: false, rejected: true };
      }
      const next = parseUsd(user.balance) + deposit;
      const reserved = parseUsd(user.reservedDepositCapacity) - centsToUsd(intent.reservedCents);
      await billingUsersCollection().updateOne({ workosUserId: intent.workosUserId }, { $set: { balance: decimalUsd(next), reservedDepositCapacity: decimalUsd(reserved < 0n ? 0n : reserved), polarCustomerId: input.customerId, updatedAt: new Date() } }, { session });
      const entry = { workosUserId: intent.workosUserId, type: "deposit" as const, delta: decimalUsd(deposit), balanceAfter: decimalUsd(next), description: "Polar Deposit", source: "polar" as const, idempotencyKey: key, referenceId: intent.id, metadata: { polarOrderId: input.orderId, depositCents: intent.depositCents, fundingFeeCents: intent.fundingFeeCents }, createdAt: new Date() };
      const result = await ledgerEntriesCollection().insertOne(entry, { session });
      await depositLotsCollection().insertOne({ workosUserId: intent.workosUserId, polarOrderId: input.orderId, original: decimalUsd(deposit), remaining: decimalUsd(deposit), createdAt: new Date(), updatedAt: new Date() }, { session });
      await depositIntentsCollection().updateOne({ id: intent.id }, { $set: { status: "paid", polarOrderId: input.orderId, updatedAt: new Date() } }, { session });
      return { applied: true, entry: { ...entry, _id: result.insertedId } };
    });
  } finally { await session.endSession(); }
}

export async function getPendingUsageHolds() {
  const users = await billingUsersCollection().find({ "usageHolds.generationId": { $exists: true } }).toArray();
  return users.flatMap((user) => (user.usageHolds ?? []).filter((hold) => hold.generationId && hold.model).map((hold) => ({ workosUserId: user.workosUserId, holdId: hold.id, generationId: hold.generationId!, model: hold.model! })));
}
