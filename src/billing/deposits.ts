import { randomUUID } from "node:crypto";
import { mongoClient } from "../db.js";
import { billingUsersCollection, depositIntentsCollection, flowControlsCollection } from "./model.js";
import { centsToUsd, decimalUsd, parseUsd, truncatedCents } from "./money.js";
import { getOrCreateBillingUser } from "./balanceLedger.js";

export const MIN_DEPOSIT_CENTS = 500;
export const MAX_DEPOSIT_CENTS = 50_000;
export const BALANCE_CAP_CENTS = 199_999;
export const FEE_POLICY_VERSION = "polar-base-v1";

export function parseDepositCents(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("Deposit must be a USD amount");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new Error("Deposit must use whole cents");
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < MIN_DEPOSIT_CENTS || cents > MAX_DEPOSIT_CENTS) throw new Error("Deposit must be between $5.00 and $500.00");
  return cents;
}

export function fundingFeeCents(depositCents: number, environment = process.env) {
  const basisPoints = Number(environment.POLAR_BASE_FEE_BPS ?? "400");
  const fixedCents = Number(environment.POLAR_BASE_FIXED_FEE_CENTS ?? "40");
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints >= 10_000 || !Number.isInteger(fixedCents) || fixedCents < 0) throw new Error("Polar base fee configuration is invalid");
  return Math.ceil((depositCents * basisPoints + fixedCents * 10_000) / (10_000 - basisPoints));
}

export async function createDepositIntent(workosUserId: string, value: unknown) {
  const depositCents = parseDepositCents(value);
  const fundingFee = fundingFeeCents(depositCents);
  const session = mongoClient.startSession();
  try {
    return await session.withTransaction(async () => {
      const paused = await flowControlsCollection().findOne({ flow: "polar_deposits", paused: true }, { session });
      if (paused) throw new Error("Deposits are temporarily paused for reconciliation");
      const user = await getOrCreateBillingUser(workosUserId, undefined, session);
      if (!user) throw new Error("Unable to load billing Customer");
      if (user.billingFrozen) throw new Error("Billing is frozen pending reconciliation");
      const holds = (user.usageHolds ?? []).reduce((sum, hold) => sum + parseUsd(hold.amount), 0n);
      const exposureCents = truncatedCents(parseUsd(user.balance) + holds + parseUsd(user.reservedDepositCapacity));
      if (exposureCents + BigInt(depositCents) > BigInt(BALANCE_CAP_CENTS)) throw new Error("Deposit would exceed the $1,999.99 Balance cap");
      const id = randomUUID();
      const now = new Date();
      const reserved = parseUsd(user.reservedDepositCapacity) + centsToUsd(depositCents);
      await billingUsersCollection().updateOne({ workosUserId }, { $set: { reservedDepositCapacity: decimalUsd(reserved), updatedAt: now } }, { session });
      const intent = { id, workosUserId, depositCents, fundingFeeCents: fundingFee, feePolicyVersion: FEE_POLICY_VERSION, reservedCents: depositCents, status: "created" as const, createdAt: now, updatedAt: now };
      await depositIntentsCollection().insertOne(intent, { session });
      return intent;
    });
  } finally { await session.endSession(); }
}

export async function markDepositCheckoutCreated(intentId: string, checkoutId: string, expiresAt: Date) {
  await depositIntentsCollection().updateOne({ id: intentId, status: "created" }, { $set: { status: "checkout_created", polarCheckoutId: checkoutId, expiresAt, updatedAt: new Date() } });
}

export async function releaseDepositIntent(intentId: string) {
  const session = mongoClient.startSession();
  try {
    await session.withTransaction(async () => {
      const intent = await depositIntentsCollection().findOne({ id: intentId, status: { $in: ["created", "checkout_created"] } }, { session });
      if (!intent) return;
      const user = await billingUsersCollection().findOne({ workosUserId: intent.workosUserId }, { session });
      if (user) {
        const next = parseUsd(user.reservedDepositCapacity) - centsToUsd(intent.reservedCents);
        await billingUsersCollection().updateOne({ workosUserId: intent.workosUserId }, { $set: { reservedDepositCapacity: decimalUsd(next < 0n ? 0n : next), updatedAt: new Date() } }, { session });
      }
      await depositIntentsCollection().updateOne({ id: intentId }, { $set: { status: "released", updatedAt: new Date() } }, { session });
    });
  } finally { await session.endSession(); }
}

export async function releaseExpiredDepositIntents() {
  const expired = await depositIntentsCollection().find({ status: "checkout_created", expiresAt: { $lte: new Date() } }).toArray();
  await Promise.all(expired.map((intent) => releaseDepositIntent(intent.id)));
}
