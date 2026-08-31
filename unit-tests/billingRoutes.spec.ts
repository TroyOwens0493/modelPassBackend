import { createHmac } from "node:crypto";
import { Decimal128 } from "mongodb";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/modelpass-test";
const mocks = vi.hoisted(() => ({ getOrCreateBillingUser: vi.fn(), newestEntry: vi.fn() }));
vi.mock("../src/billing/balanceLedger.js", () => ({ getOrCreateBillingUser: mocks.getOrCreateBillingUser }));
vi.mock("../src/billing/model.js", () => ({ ledgerEntriesCollection: () => ({ find: () => ({ sort: () => ({ limit: () => ({ next: mocks.newestEntry }) }) }) }) }));
const secret = "test_cookie_password_at_least_32_characters";
let app: express.Express;
beforeAll(async () => { const { billingRouter } = await import("../src/routes/billing.js"); app = express(); app.use(express.json()); app.use(cookieParser(secret)); app.use("/api/billing", billingRouter); });
beforeEach(() => { vi.clearAllMocks(); mocks.getOrCreateBillingUser.mockResolvedValue({ workosUserId: "user_123", balance: Decimal128.fromString("4.75999"), reservedDepositCapacity: Decimal128.fromString("0"), usageHolds: [{ id: "hold_1", amount: Decimal128.fromString("0.25"), createdAt: new Date("2026-08-30T00:00:00Z") }] }); mocks.newestEntry.mockResolvedValue({ balanceAfter: Decimal128.fromString("4.75999") }); });
function cookie() { const value = JSON.stringify({ user: { id: "user_123", email: "user@example.com" } }); const signature = createHmac("sha256", secret).update(value).digest("base64").replace(/=+$/, ""); return `workos_session=${encodeURIComponent(`s:${value}.${signature}`)}`; }
describe("billing API", () => {
  it("requires authentication", async () => { expect((await request(app).get("/api/billing")).status).toBe(401); });
  it("returns only the cent-truncated Balance and active Holds", async () => { const response = await request(app).get("/api/billing").set("Cookie", cookie()); expect(response.status).toBe(200); expect(response.body.balance).toEqual({ availableUsd: "4.75", holdUsd: "0.25", frozen: false }); expect(response.body).not.toHaveProperty("transactions"); });
  it("quotes the separately disclosed Funding Fee", async () => { const response = await request(app).post("/api/billing/quote").set("Cookie", cookie()).send({ depositUsd: "10.00" }); expect(response.body).toEqual({ depositUsd: "10.00", fundingFeeUsd: "0.84", subtotalUsd: "10.84", tax: "Calculated by Polar" }); });
});
