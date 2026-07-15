import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const session = {
    withTransaction: vi.fn(async (callback: () => unknown) => callback()),
    endSession: vi.fn(),
  };
  const users = {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  };
  const transactions = {
    findOne: vi.fn(),
    insertOne: vi.fn(),
  };

  return {
    session,
    users,
    transactions,
    startSession: vi.fn(() => session),
  };
});

vi.mock("../src/db.js", () => ({
  mongoClient: { startSession: mocks.startSession },
}));

vi.mock("../src/billing/model.js", () => ({
  billingUsersCollection: () => mocks.users,
  creditTransactionsCollection: () => mocks.transactions,
}));

let ledger: typeof import("../src/billing/creditLedger.js");

beforeAll(async () => {
  ledger = await import("../src/billing/creditLedger.js");
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.withTransaction.mockImplementation(
    async (callback: () => unknown) => callback(),
  );
  mocks.transactions.findOne.mockResolvedValue(null);
  mocks.transactions.insertOne.mockResolvedValue({ insertedId: "transaction_1" });
});

describe("applyCreditPurchase", () => {
  it("does not apply a transaction whose external ID already exists", async () => {
    mocks.transactions.findOne.mockResolvedValue({
      externalId: "polar:order:123",
      credits: 100,
    });

    const result = await ledger.applyCreditPurchase({
      workosUserId: "user_123",
      credits: 100,
      description: "Starter credit package",
      externalId: "polar:order:123",
    });

    expect(result.applied).toBe(false);
    expect(mocks.users.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.transactions.insertOne).not.toHaveBeenCalled();
  });

  it("rejects invalid purchase amounts", async () => {
    await expect(
      ledger.applyCreditPurchase({
        workosUserId: "user_123",
        credits: -2,
        description: "Invalid credit package",
        externalId: "polar:order:invalid",
      }),
    ).rejects.toThrow("Purchased credits must be a positive integer");

    expect(mocks.users.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.transactions.insertOne).not.toHaveBeenCalled();
  });

  it("updates balance and inserts a matching purchase entry", async () => {
    mocks.users.findOneAndUpdate
      .mockResolvedValueOnce({ workosUserId: "user_123", creditBalance: 10 })
      .mockResolvedValueOnce({ workosUserId: "user_123", creditBalance: 110 });

    const result = await ledger.applyCreditPurchase({
      workosUserId: "user_123",
      credits: 100,
      description: "Starter credit package",
      externalId: "polar:order:123",
    });

    expect(result.applied).toBe(true);
    expect(mocks.transactions.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "purchase",
        credits: 100,
        balanceAfter: 110,
        source: "polar",
      }),
      expect.objectContaining({ session: mocks.session }),
    );
  });

  it("atomically reserves available credits before model usage", async () => {
    mocks.users.findOneAndUpdate
      .mockResolvedValueOnce({
        workosUserId: "user_123",
        creditBalance: 10,
      })
      .mockResolvedValueOnce({
        workosUserId: "user_123",
        creditBalance: 0,
        creditReservations: [
          { id: "reservation_1", credits: 10, createdAt: new Date() },
        ],
      });

    const reserved = await ledger.reserveCredits(
      "user_123",
      "reservation_1",
      10,
    );

    expect(reserved).toBe(10);
    expect(mocks.users.findOneAndUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        workosUserId: "user_123",
        creditBalance: { $gte: 10 },
      }),
      expect.objectContaining({
        $inc: { creditBalance: -10 },
      }),
      expect.objectContaining({ returnDocument: "after" }),
    );
  });

  it("returns an existing reservation without debiting credits again", async () => {
    mocks.users.findOneAndUpdate
      .mockResolvedValueOnce({ workosUserId: "user_123", creditBalance: 10 })
      .mockResolvedValueOnce(null);
    mocks.users.findOne.mockResolvedValue({
      workosUserId: "user_123",
      creditBalance: 0,
      creditReservations: [
        { id: "reservation_1", credits: 10, createdAt: new Date() },
      ],
    });

    const reserved = await ledger.reserveCredits(
      "user_123",
      "reservation_1",
      10,
    );

    expect(reserved).toBe(10);
    expect(mocks.users.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it("refunds unused reservation credits and records actual usage", async () => {
    mocks.users.findOne.mockResolvedValue({
      workosUserId: "user_123",
      creditBalance: 0,
      creditReservations: [
        { id: "reservation_1", credits: 10, createdAt: new Date() },
      ],
    });
    mocks.users.findOneAndUpdate.mockResolvedValue({
      workosUserId: "user_123",
      creditBalance: 8,
    });

    const result = await ledger.finalizeCreditReservation({
      workosUserId: "user_123",
      reservationId: "reservation_1",
      externalId: "completion_1",
      requestedCredits: 2,
      description: "Model response",
      tokens: 100,
      costUsd: 0.02,
    });

    expect(result.applied).toBe(true);
    expect(mocks.users.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        workosUserId: "user_123",
        "creditReservations.id": "reservation_1",
      }),
      expect.objectContaining({
        $inc: {
          creditBalance: 8,
          creditsUsed: 2,
          tokensUsed: 100,
        },
      }),
      expect.objectContaining({ session: mocks.session }),
    );
    expect(mocks.transactions.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        credits: -2,
        balanceAfter: 8,
        externalId: "openrouter:completion:completion_1",
      }),
      expect.objectContaining({ session: mocks.session }),
    );
  });
});
