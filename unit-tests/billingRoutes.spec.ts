import { ObjectId } from "mongodb";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/modelpass-test";
process.env.POLAR_SERVER = "sandbox";

const mocks = vi.hoisted(() => ({
  getOrCreateBillingUser: vi.fn(),
  getRecentCreditTransactions: vi.fn(),
  verifyAccessToken: vi.fn(),
  getAuthUser: vi.fn(),
}));

vi.mock("../src/billing/creditLedger.js", () => ({
  getOrCreateBillingUser: mocks.getOrCreateBillingUser,
  getRecentCreditTransactions: mocks.getRecentCreditTransactions,
}));
vi.mock("../src/auth/tokenVerifier.js", () => ({
  verifyAccessToken: mocks.verifyAccessToken,
  isExpiredTokenError: () => false,
}));
vi.mock("../src/auth/model.js", () => ({ getAuthUser: mocks.getAuthUser }));

let app: express.Express;

beforeAll(async () => {
  const { billingRouter } = await import("../src/routes/billing.js");
  app = express();
  app.use(express.json());
  app.use("/api/billing", billingRouter);
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyAccessToken.mockResolvedValue({ userId: "user_123", sessionId: "session_123" });
  mocks.getAuthUser.mockResolvedValue({ workosUserId: "user_123", email: "user@example.com" });
  mocks.getOrCreateBillingUser.mockResolvedValue({
    workosUserId: "user_123",
    creditBalance: 475,
    creditsUsed: 25,
    tokensUsed: 12_000,
  });
  mocks.getRecentCreditTransactions.mockResolvedValue([
    {
      _id: new ObjectId("507f1f77bcf86cd799439011"),
      type: "purchase",
      credits: 500,
      balanceAfter: 500,
      description: "Plus credit package",
      createdAt: new Date("2026-07-15T12:00:00.000Z"),
    },
  ]);
});

describe("billing routes", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/api/billing");

    expect(response.status).toBe(401);
  });

  it("returns the authenticated user's persisted accounting values", async () => {
    const response = await request(app)
      .get("/api/billing")
      .set("Authorization", "Bearer valid_token");

    expect(response.status).toBe(200);
    expect(response.body.balance).toEqual({
      creditBalance: 475,
      creditsUsed: 25,
      tokensUsed: 12_000,
    });
    expect(response.body.transactions).toEqual([
      expect.objectContaining({
        id: "507f1f77bcf86cd799439011",
        credits: 500,
        balanceAfter: 500,
      }),
    ]);
    expect(mocks.getOrCreateBillingUser).toHaveBeenCalledWith(
      "user_123",
      "user@example.com",
    );
  });
});
