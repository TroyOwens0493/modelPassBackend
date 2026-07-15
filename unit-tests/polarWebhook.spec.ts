import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/modelpass-test";
process.env.POLAR_WEBHOOK_SECRET = "webhook-secret";
process.env.POLAR_STARTER_PRODUCT_ID = "starter-product";

const mocks = vi.hoisted(() => {
  class MockWebhookVerificationError extends Error {}

  return {
    validateEvent: vi.fn(),
    applyCreditPurchase: vi.fn(),
    setPolarCustomerId: vi.fn(),
    MockWebhookVerificationError,
  };
});

vi.mock("@polar-sh/sdk/webhooks", () => ({
  validateEvent: mocks.validateEvent,
  WebhookVerificationError: mocks.MockWebhookVerificationError,
}));

vi.mock("../src/billing/creditLedger.js", () => ({
  applyCreditPurchase: mocks.applyCreditPurchase,
  setPolarCustomerId: mocks.setPolarCustomerId,
}));

let polarWebhookHandler: typeof import("../src/billing/webhook.js").polarWebhookHandler;

beforeAll(async () => {
  ({ polarWebhookHandler } = await import("../src/billing/webhook.js"));
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.applyCreditPurchase.mockResolvedValue({
    applied: true,
    transaction: {},
  });
  mocks.setPolarCustomerId.mockResolvedValue(undefined);
});

function responseDouble() {
  const state = {
    status: 200,
    body: undefined as unknown,
  };
  const response = {
    status: vi.fn((status: number) => {
      state.status = status;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      state.body = body;
      return response;
    }),
    send: vi.fn(() => response),
  };

  return { response: response as unknown as Response, state };
}

function paidOrder(productId = "starter-product") {
  return {
    type: "order.paid",
    timestamp: new Date(),
    data: {
      id: "order_123",
      productId,
      checkoutId: "checkout_123",
      customerId: "customer_123",
      customer: { externalId: "user_123" },
      totalAmount: 500,
      currency: "usd",
    },
  };
}

describe("polarWebhookHandler", () => {
  it("credits a paid order using the configured product amount", async () => {
    mocks.validateEvent.mockReturnValue(paidOrder());
    const { response, state } = responseDouble();

    await polarWebhookHandler(
      { body: Buffer.from("{}"), headers: {} } as Request,
      response,
    );

    expect(state.status).toBe(202);
    expect(mocks.applyCreditPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        workosUserId: "user_123",
        credits: 100,
        externalId: "polar:order:order_123",
      }),
    );
    expect(mocks.setPolarCustomerId).toHaveBeenCalledWith(
      "user_123",
      "customer_123",
    );
  });

  it("reports duplicate paid orders as received but not applied", async () => {
    mocks.validateEvent.mockReturnValue(paidOrder());
    mocks.applyCreditPurchase.mockResolvedValue({
      applied: false,
      transaction: {},
    });
    const { response, state } = responseDouble();

    await polarWebhookHandler(
      { body: Buffer.from("{}"), headers: {} } as Request,
      response,
    );

    expect(state.status).toBe(202);
    expect(state.body).toEqual({ received: true, applied: false });
  });

  it("rejects paid orders for unknown products", async () => {
    mocks.validateEvent.mockReturnValue(paidOrder("unknown-product"));
    const { response, state } = responseDouble();

    await polarWebhookHandler(
      { body: Buffer.from("{}"), headers: {} } as Request,
      response,
    );

    expect(state.status).toBe(422);
    expect(mocks.applyCreditPurchase).not.toHaveBeenCalled();
  });

  it("rejects invalid webhook signatures", async () => {
    mocks.validateEvent.mockImplementation(() => {
      throw new mocks.MockWebhookVerificationError();
    });
    const { response, state } = responseDouble();

    await polarWebhookHandler(
      { body: Buffer.from("{}"), headers: {} } as Request,
      response,
    );

    expect(state.status).toBe(403);
    expect(mocks.applyCreditPurchase).not.toHaveBeenCalled();
  });
});
