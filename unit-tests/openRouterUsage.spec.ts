import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.OPEN_ROUTER_API_KEY = "test-openrouter-key";

const mocks = vi.hoisted(() => ({
  modelsGet: vi.fn(),
  chatSend: vi.fn(),
  generationGet: vi.fn(),
  creditsForCost: vi.fn(),
  reserveCredits: vi.fn(),
  markCreditReservationPending: vi.fn(),
  finalizeCreditReservation: vi.fn(),
  releaseCreditReservation: vi.fn(),
  releaseExpiredUnlinkedReservations: vi.fn(),
  getPendingCreditReservations: vi.fn(),
}));

vi.mock("@openrouter/sdk", () => ({
  OpenRouter: class {
    models = { get: mocks.modelsGet };
    chat = { send: mocks.chatSend };
    generations = { getGeneration: mocks.generationGet };
  },
}));

vi.mock("../src/billing/creditLedger.js", () => ({
  creditsForCost: mocks.creditsForCost,
  reserveCredits: mocks.reserveCredits,
  markCreditReservationPending: mocks.markCreditReservationPending,
  finalizeCreditReservation: mocks.finalizeCreditReservation,
  releaseCreditReservation: mocks.releaseCreditReservation,
  releaseExpiredUnlinkedReservations: mocks.releaseExpiredUnlinkedReservations,
  getPendingCreditReservations: mocks.getPendingCreditReservations,
}));

let streamBillableCompletion: typeof import("../src/billing/openRouterUsage.js").streamBillableCompletion;

beforeAll(async () => {
  ({ streamBillableCompletion } = await import(
    "../src/billing/openRouterUsage.js"
  ));
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.modelsGet.mockResolvedValue({
    data: {
      pricing: { prompt: "0.000001", completion: "0.000002", request: "0" },
    },
  });
  mocks.creditsForCost.mockImplementation((costUsd: number) =>
    costUsd === 0.005 ? 1 : 10,
  );
  mocks.reserveCredits.mockResolvedValue(10);
  mocks.markCreditReservationPending.mockResolvedValue(undefined);
  mocks.finalizeCreditReservation.mockResolvedValue({ applied: true });
  mocks.releaseCreditReservation.mockResolvedValue(undefined);
});

/** Produces a successful two-chunk OpenRouter stream. */
async function* successfulCompletion() {
  yield {
    id: "completion_123",
    choices: [{ delta: { content: "Hello" } }],
  };
  yield {
    id: "completion_123",
    choices: [{ delta: { content: " world" } }],
    usage: {
      cost: 0.005,
      totalTokens: 12,
      promptTokens: 5,
      completionTokens: 7,
    },
  };
}

/** Produces one linked chunk before simulating an interrupted stream. */
async function* interruptedCompletion() {
  yield {
    id: "completion_123",
    choices: [{ delta: { content: "Partial" } }],
  };
  throw new Error("Stream interrupted");
}

describe("streamBillableCompletion", () => {
  it("owns reservation, streaming, and final settlement", async () => {
    mocks.chatSend.mockResolvedValue(successfulCompletion());
    const onStart = vi.fn();
    const onText = vi.fn();

    await streamBillableCompletion({
      workosUserId: "user_123",
      model: "author/model",
      messages: [{ role: "user", content: "Hi" }],
      onStart,
      onText,
    });

    expect(mocks.reserveCredits).toHaveBeenCalledWith(
      "user_123",
      expect.any(String),
      10,
    );
    expect(onStart).toHaveBeenCalledOnce();
    expect(onText.mock.calls).toEqual([["Hello"], [" world"]]);
    expect(mocks.markCreditReservationPending).toHaveBeenCalledWith(
      "user_123",
      expect.any(String),
      "completion_123",
      "author/model",
    );
    expect(mocks.finalizeCreditReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        workosUserId: "user_123",
        externalId: "completion_123",
        requestedCredits: 1,
        tokens: 12,
        costUsd: 0.005,
      }),
    );
    expect(mocks.releaseCreditReservation).not.toHaveBeenCalled();
  });

  it("releases an unlinked reservation when OpenRouter rejects the request", async () => {
    mocks.chatSend.mockRejectedValue(new Error("OpenRouter unavailable"));

    await expect(
      streamBillableCompletion({
        workosUserId: "user_123",
        model: "author/model",
        messages: [{ role: "user", content: "Hi" }],
        onStart: vi.fn(),
        onText: vi.fn(),
      }),
    ).rejects.toThrow("OpenRouter unavailable");

    expect(mocks.releaseCreditReservation).toHaveBeenCalledWith(
      "user_123",
      expect.any(String),
    );
    expect(mocks.finalizeCreditReservation).not.toHaveBeenCalled();
  });

  it("keeps a linked reservation for reconciliation after stream failure", async () => {
    mocks.chatSend.mockResolvedValue(interruptedCompletion());

    await expect(
      streamBillableCompletion({
        workosUserId: "user_123",
        model: "author/model",
        messages: [{ role: "user", content: "Hi" }],
        onStart: vi.fn(),
        onText: vi.fn(),
      }),
    ).rejects.toThrow("Stream interrupted");

    expect(mocks.markCreditReservationPending).toHaveBeenCalledOnce();
    expect(mocks.releaseCreditReservation).not.toHaveBeenCalled();
    expect(mocks.finalizeCreditReservation).not.toHaveBeenCalled();
  });
});
