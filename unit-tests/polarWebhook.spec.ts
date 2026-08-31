import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/modelpass-test";
process.env.POLAR_WEBHOOK_SECRET = "secret";
process.env.POLAR_WALLET_PRODUCT_ID = "wallet-product";
process.env.POLAR_ACCESS_TOKEN = "test-token";
const mocks = vi.hoisted(() => ({ validateEvent: vi.fn(), applyPaidDeposit: vi.fn(), findIntent: vi.fn(), updateIntent: vi.fn(), insertAudit: vi.fn(), updateUser: vi.fn(), updateFlow: vi.fn(), findLot: vi.fn(), createRefund: vi.fn() }));
class VerificationError extends Error {}
vi.mock("@polar-sh/sdk/webhooks", () => ({ validateEvent: mocks.validateEvent, WebhookVerificationError: VerificationError }));
vi.mock("@polar-sh/sdk", () => ({ Polar: class { refunds = { create: mocks.createRefund }; } }));
vi.mock("../src/billing/balanceLedger.js", () => ({ applyPaidDeposit: mocks.applyPaidDeposit }));
vi.mock("../src/billing/reversals.js", () => ({ applyForcedReversal: vi.fn(), placeDisputeHold: vi.fn(), resolveDispute: vi.fn(), resolveRefundHold: vi.fn() }));
vi.mock("../src/billing/deposits.js", () => ({ releaseDepositIntent: vi.fn() }));
vi.mock("../src/billing/model.js", () => ({ depositIntentsCollection: () => ({ findOne: mocks.findIntent, updateOne: mocks.updateIntent }), auditRecordsCollection: () => ({ insertOne: mocks.insertAudit }), billingUsersCollection: () => ({ updateOne: mocks.updateUser }), flowControlsCollection: () => ({ updateOne: mocks.updateFlow }), depositLotsCollection: () => ({ findOne: mocks.findLot }) }));
let handler: typeof import("../src/billing/webhook.js").polarWebhookHandler;
beforeAll(async () => { ({ polarWebhookHandler: handler } = await import("../src/billing/webhook.js")); });
beforeEach(() => { vi.clearAllMocks(); mocks.findIntent.mockResolvedValue({ id: "intent_1", workosUserId: "user_1", depositCents: 1000, fundingFeeCents: 84, feePolicyVersion: "polar-base-v1", status: "checkout_created" }); mocks.applyPaidDeposit.mockResolvedValue({ applied: true }); mocks.insertAudit.mockResolvedValue({}); mocks.updateIntent.mockResolvedValue({}); mocks.updateUser.mockResolvedValue({}); mocks.updateFlow.mockResolvedValue({}); mocks.createRefund.mockResolvedValue({ id: "refund_1" }); mocks.validateEvent.mockReturnValue({ type: "order.paid", data: { id: "order_1", customerId: "customer_1", customer: { externalId: "user_1" }, productId: "wallet-product", checkoutId: "checkout_1", currency: "usd", netAmount: 1084, discountAmount: 0, metadata: { depositIntentId: "intent_1", depositCents: 1000, fundingFeeCents: 84, feePolicyVersion: "polar-base-v1" } } }); });
function response() { const state = { status: 200, body: undefined as unknown }; const value = { status: vi.fn((code: number) => { state.status = code; return value; }), json: vi.fn((body: unknown) => { state.body = body; return value; }), send: vi.fn(() => value) }; return { state, value: value as unknown as Response }; }
describe("Polar paid Orders", () => {
  it("adds only a fully validated Deposit to Balance", async () => { const { state, value } = response(); await handler({ body: Buffer.from("{}"), headers: {} } as Request, value); expect(state.status).toBe(202); expect(mocks.applyPaidDeposit).toHaveBeenCalledWith({ intentId: "intent_1", orderId: "order_1", customerId: "customer_1" }); });
  it("adds nothing and enters Reconciliation on an amount mismatch", async () => { mocks.validateEvent.mockReturnValue({ type: "order.paid", data: { id: "order_1", customerId: "customer_1", customer: { externalId: "user_1" }, productId: "wallet-product", currency: "usd", netAmount: 999, discountAmount: 0, metadata: { depositIntentId: "intent_1", depositCents: 1000, fundingFeeCents: 84, feePolicyVersion: "polar-base-v1" } } }); const { state, value } = response(); await handler({ body: Buffer.from("{}"), headers: {} } as Request, value); expect(state.status).toBe(422); expect(mocks.applyPaidDeposit).not.toHaveBeenCalled(); expect(mocks.insertAudit).toHaveBeenCalled(); });
  it("rejects invalid signatures", async () => { mocks.validateEvent.mockImplementation(() => { throw new VerificationError(); }); const { state, value } = response(); await handler({ body: Buffer.from("{}"), headers: {} } as Request, value); expect(state.status).toBe(403); });
});
