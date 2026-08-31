import { Decimal128 } from "mongodb";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.OPEN_ROUTER_API_KEY = "test-key";
process.env.WALLET_ENDPOINT_CONFIG = JSON.stringify({ version: "test-v1", endpoints: { "author/model": { provider: "Provider", promptPerToken: "0.000001", completionPerToken: "0.000002", requestCost: "0", maxOutputTokens: 128, fixedPromptTokens: 10, perMessageTokens: 4 } } });
const mocks = vi.hoisted(() => ({ finalizeUsage: vi.fn(), getUser: vi.fn(), getPending: vi.fn(), linkHold: vi.fn(), ambiguous: vi.fn(), releaseHold: vi.fn(), reserveBalance: vi.fn(), flowFind: vi.fn(), flowUpdate: vi.fn(), generationGet: vi.fn() }));
vi.mock("@openrouter/sdk", () => ({ OpenRouter: class { generations = { getGeneration: mocks.generationGet }; } }));
vi.mock("../src/billing/balanceLedger.js", () => ({ finalizeUsage: mocks.finalizeUsage, getOrCreateBillingUser: mocks.getUser, getPendingUsageHolds: mocks.getPending, linkHold: mocks.linkHold, markAmbiguousUnlinkedHold: mocks.ambiguous, releaseHold: mocks.releaseHold, reserveBalance: mocks.reserveBalance, InsufficientBalanceError: class extends Error {} }));
vi.mock("../src/billing/model.js", () => ({ flowControlsCollection: () => ({ findOne: mocks.flowFind, updateOne: mocks.flowUpdate }) }));
let stream: typeof import("../src/billing/openRouterUsage.js").streamBillableCompletion;
beforeAll(async () => ({ streamBillableCompletion: stream } = await import("../src/billing/openRouterUsage.js")));
beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ balance: Decimal128.fromString("10") }); mocks.flowFind.mockResolvedValue(null); mocks.reserveBalance.mockResolvedValue(undefined); mocks.linkHold.mockResolvedValue(undefined); mocks.finalizeUsage.mockResolvedValue({ applied: true }); });
const body = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[],"usage":{"cost":0.00002,"total_tokens":12}}\n\ndata: [DONE]\n\n';
describe("OpenRouter Balance dispatch", () => {
  it("links the Hold from the response header before consuming streamed text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { "x-generation-id": "generation_1", "content-type": "text/event-stream" } })));
    const onText = vi.fn();
    await stream({ workosUserId: "user_1", model: "author/model", messages: [{ role: "user", content: "Hi" }], onStart: vi.fn(), onText });
    expect(mocks.linkHold).toHaveBeenCalledWith("user_1", expect.any(String), "generation_1", "author/model");
    expect(mocks.linkHold.mock.invocationCallOrder[0]).toBeLessThan(onText.mock.invocationCallOrder[0]);
    expect(mocks.finalizeUsage).toHaveBeenCalledWith(expect.objectContaining({ generationId: "generation_1", providerCost: "0.00002", tokens: 12 }));
  });
  it("retains the Hold and freezes billing when an accepted response has no generation ID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    await expect(stream({ workosUserId: "user_1", model: "author/model", messages: [{ role: "user", content: "Hi" }], onStart: vi.fn(), onText: vi.fn() })).rejects.toThrow(/generation ID/);
    expect(mocks.ambiguous).toHaveBeenCalledWith("user_1", expect.any(String), "author/model");
    expect(mocks.releaseHold).not.toHaveBeenCalled();
  });
});
