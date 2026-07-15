import { createHmac } from "node:crypto";
import { ObjectId } from "mongodb";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/modelpass-test";
process.env.POLAR_SERVER = "sandbox";

const mocks = vi.hoisted(() => ({
  getBillingUser: vi.fn(),
  getRecentCreditTransactions: vi.fn(),
}));

vi.mock("../src/billing/creditLedger.js", () => ({
  getBillingUser: mocks.getBillingUser,
  getRecentCreditTransactions: mocks.getRecentCreditTransactions,
}));

const cookieSecret = "test_cookie_password_at_least_32_characters";
let app: express.Express;

beforeAll(async () => {
  const { billingRouter } = await import("../src/routes/billing.js");
  app = express();
  app.use(express.json());
  app.use(cookieParser(cookieSecret));
  app.use("/api/billing", billingRouter);
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBillingUser.mockResolvedValue({
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

function sessionCookie() {
  const value = JSON.stringify({
    user: { id: "user_123", email: "user@example.com" },
  });
  const signature = createHmac("sha256", cookieSecret)
    .update(value)
    .digest("base64")
    .replace(/=+$/, "");

  return `workos_session=${encodeURIComponent(`s:${value}.${signature}`)}`;
}

describe("billing routes", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/api/billing");

    expect(response.status).toBe(401);
  });

  it("returns the authenticated user's persisted accounting values", async () => {
    const response = await request(app)
      .get("/api/billing")
      .set("Cookie", sessionCookie());

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
    expect(mocks.getBillingUser).toHaveBeenCalledWith(
      "user_123",
      "user@example.com",
    );
  });
});
