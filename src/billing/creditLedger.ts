import { MongoServerError, type ClientSession } from "mongodb";
import { mongoClient } from "../db.js";
import {
  billingUsersCollection,
  creditTransactionsCollection,
} from "./model.js";
import type {
  BillingUserDocument,
  CreditChange,
  CreditTransactionDocument,
} from "./types.js";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
  }
}

export async function getOrCreateBillingUser(
  workosUserId: string,
  email?: string,
  session?: ClientSession,
) {
  const now = new Date();
  const update = {
    $setOnInsert: {
      workosUserId,
      creditBalance: 0,
      creditsUsed: 0,
      tokensUsed: 0,
      createdAt: now,
    },
    $set: {
      ...(email ? { email } : {}),
      updatedAt: now,
    },
  };

  return billingUsersCollection().findOneAndUpdate(
    { workosUserId },
    update,
    { upsert: true, returnDocument: "after", session },
  );
}

export async function getBillingUser(workosUserId: string, email?: string) {
  return getOrCreateBillingUser(workosUserId, email);
}

export async function setPolarCustomerId(
  workosUserId: string,
  polarCustomerId: string,
  session?: ClientSession,
) {
  await billingUsersCollection().updateOne(
    { workosUserId },
    {
      $set: {
        polarCustomerId,
        updatedAt: new Date(),
      },
    },
    { session },
  );
}

export function creditsForCost(costUsd: number) {
  if (!Number.isFinite(costUsd) || costUsd <= 0) {
    return 0;
  }

  const configuredRate = Number(process.env.USD_PER_CREDIT ?? "0.01");
  const dollarsPerCredit =
    Number.isFinite(configuredRate) && configuredRate > 0
      ? configuredRate
      : 0.01;

  return Math.max(1, Math.ceil(costUsd / dollarsPerCredit));
}

export async function reserveCredits(
  workosUserId: string,
  reservationId: string,
  requestedCredits = 1,
) {
  const users = billingUsersCollection();
  const credits = Math.max(1, Math.trunc(requestedCredits));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const user = await getOrCreateBillingUser(workosUserId);

    if (!user || user.creditBalance < credits) {
      throw new InsufficientCreditsError();
    }

    const existing = user.creditReservations?.find(
      (reservation) => reservation.id === reservationId,
    );
    if (existing) {
      return existing.credits;
    }

    const updated = await users.findOneAndUpdate(
      {
        workosUserId,
        creditBalance: { $gte: credits },
        "creditReservations.id": { $ne: reservationId },
      },
      {
        $inc: { creditBalance: -credits },
        $push: {
          creditReservations: {
            id: reservationId,
            credits,
            createdAt: new Date(),
          },
        },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after" },
    );

    if (updated) {
      return credits;
    }
  }

  throw new InsufficientCreditsError();
}

export async function markCreditReservationPending(
  workosUserId: string,
  reservationId: string,
  completionId: string,
  model: string,
) {
  await billingUsersCollection().updateOne(
    {
      workosUserId,
      "creditReservations.id": reservationId,
    },
    {
      $set: {
        "creditReservations.$.completionId": completionId,
        "creditReservations.$.model": model,
        updatedAt: new Date(),
      },
    },
  );
}

export async function getPendingCreditReservations() {
  const users = await billingUsersCollection()
    .find({ "creditReservations.completionId": { $exists: true } })
    .toArray();

  return users.flatMap((user) =>
    (user.creditReservations ?? [])
      .filter(
        (reservation) =>
          typeof reservation.completionId === "string" &&
          typeof reservation.model === "string",
      )
      .map((reservation) => ({
        workosUserId: user.workosUserId,
        reservationId: reservation.id,
        completionId: reservation.completionId!,
        model: reservation.model!,
      })),
  );
}

export async function releaseExpiredUnlinkedReservations(
  maximumAgeMs = 15 * 60 * 1000,
) {
  const cutoff = Date.now() - maximumAgeMs;
  const users = await billingUsersCollection()
    .find({ "creditReservations.0": { $exists: true } })
    .toArray();

  for (const user of users) {
    for (const reservation of user.creditReservations ?? []) {
      if (
        !reservation.completionId &&
        reservation.createdAt.getTime() < cutoff
      ) {
        await releaseCreditReservation(user.workosUserId, reservation.id);
      }
    }
  }
}

export async function releaseCreditReservation(
  workosUserId: string,
  reservationId: string,
) {
  const users = billingUsersCollection();
  const user = await users.findOne({
    workosUserId,
    "creditReservations.id": reservationId,
  });
  const reservation = user?.creditReservations?.find(
    (item) => item.id === reservationId,
  );

  if (!reservation) {
    return;
  }

  await users.updateOne(
    {
      workosUserId,
      "creditReservations.id": reservationId,
    },
    {
      $inc: { creditBalance: reservation.credits },
      $pull: { creditReservations: { id: reservationId } },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function finalizeCreditReservation(input: {
  workosUserId: string;
  reservationId: string;
  externalId: string;
  requestedCredits: number;
  description: string;
  tokens: number;
  costUsd: number;
  metadata?: CreditTransactionDocument["metadata"];
}) {
  const session = mongoClient.startSession();

  try {
    return await session.withTransaction(async () => {
      const externalId = `openrouter:completion:${input.externalId}`;
      const existing = await creditTransactionsCollection().findOne(
        { externalId },
        { session },
      );

      if (existing) {
        return { transaction: existing, applied: false };
      }

      const user = await billingUsersCollection().findOne(
        {
          workosUserId: input.workosUserId,
          "creditReservations.id": input.reservationId,
        },
        { session },
      );
      const reservation = user?.creditReservations?.find(
        (item) => item.id === input.reservationId,
      );

      if (!user || !reservation) {
        throw new Error("Credit reservation was not found");
      }

      const chargedCredits = Math.min(
        reservation.credits,
        Math.max(0, Math.trunc(input.requestedCredits)),
      );
      const refund = reservation.credits - chargedCredits;
      const updatedUser = await billingUsersCollection().findOneAndUpdate(
        {
          workosUserId: input.workosUserId,
          "creditReservations.id": input.reservationId,
        },
        {
          $inc: {
            creditBalance: refund,
            creditsUsed: chargedCredits,
            tokensUsed: input.tokens,
          },
          $pull: { creditReservations: { id: input.reservationId } },
          $set: { updatedAt: new Date() },
        },
        { returnDocument: "after", session },
      );

      if (!updatedUser) {
        throw new Error("Unable to finalize credit reservation");
      }

      const transaction: CreditTransactionDocument = {
        workosUserId: input.workosUserId,
        type: "usage",
        credits: -chargedCredits,
        balanceAfter: updatedUser.creditBalance,
        description: input.description,
        source: "openrouter",
        externalId,
        tokens: input.tokens,
        costUsd: input.costUsd,
        ...(input.metadata ? { metadata: input.metadata } : {}),
        createdAt: new Date(),
      };
      const result = await creditTransactionsCollection().insertOne(
        transaction,
        { session },
      );

      return {
        transaction: { ...transaction, _id: result.insertedId },
        applied: true,
      };
    });
  } finally {
    await session.endSession();
  }
}

async function applyWithinTransaction(
  change: CreditChange,
  session: ClientSession,
) {
  const transactions = creditTransactionsCollection();
  const existing = await transactions.findOne(
    { externalId: change.externalId },
    { session },
  );

  if (existing) {
    return { transaction: existing, applied: false };
  }

  await getOrCreateBillingUser(change.workosUserId, undefined, session);

  const isUsage = change.type === "usage";
  const debit = change.creditDelta < 0 ? Math.abs(change.creditDelta) : 0;
  const userFilter =
    debit > 0
      ? {
          workosUserId: change.workosUserId,
          creditBalance: { $gte: debit },
        }
      : { workosUserId: change.workosUserId };
  const increments: Record<string, number> = {
    creditBalance: change.creditDelta,
  };

  if (isUsage) {
    increments.creditsUsed = debit;
    increments.tokensUsed = change.tokens ?? 0;
  }

  const updatedUser = await billingUsersCollection().findOneAndUpdate(
    userFilter,
    {
      $inc: increments,
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after", session },
  );

  if (!updatedUser) {
    throw new InsufficientCreditsError();
  }

  const transaction: CreditTransactionDocument = {
    workosUserId: change.workosUserId,
    type: change.type,
    credits: change.creditDelta,
    balanceAfter: updatedUser.creditBalance,
    description: change.description,
    source: change.source,
    externalId: change.externalId,
    ...(change.tokens !== undefined ? { tokens: change.tokens } : {}),
    ...(change.costUsd !== undefined ? { costUsd: change.costUsd } : {}),
    ...(change.metadata ? { metadata: change.metadata } : {}),
    createdAt: new Date(),
  };
  const result = await transactions.insertOne(transaction, { session });

  return {
    transaction: { ...transaction, _id: result.insertedId },
    applied: true,
  };
}

export async function applyCreditChange(change: CreditChange) {
  const isZeroTokenUsage =
    change.type === "usage" &&
    change.creditDelta === 0 &&
    (change.tokens ?? 0) > 0;

  if (
    !Number.isInteger(change.creditDelta) ||
    (change.creditDelta === 0 && !isZeroTokenUsage)
  ) {
    throw new Error(
      "Credit changes must be non-zero integers unless recording free token usage",
    );
  }

  const session = mongoClient.startSession();

  try {
    return await session.withTransaction(() =>
      applyWithinTransaction(change, session),
    );
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const existing = await creditTransactionsCollection().findOne({
        externalId: change.externalId,
      });

      if (existing) {
        return { transaction: existing, applied: false };
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

export async function getRecentCreditTransactions(
  workosUserId: string,
  limit = 20,
) {
  return creditTransactionsCollection()
    .find({ workosUserId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export type { BillingUserDocument };
