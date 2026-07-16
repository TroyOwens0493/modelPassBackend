import express from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(), find: vi.fn(), project: vi.fn(), toArray: vi.fn(),
}));

vi.mock("../src/auth/tokenVerifier.js", () => ({
  verifyAccessToken: mocks.verifyAccessToken,
  isExpiredTokenError: () => false,
}));
vi.mock("../src/routes/chats/model.js", () => ({ chatsCollection: () => ({ find: mocks.find }) }));
vi.mock("../src/billing/openRouterUsage.js", () => ({ streamBillableCompletion: vi.fn() }));
vi.mock("../src/billing/creditLedger.js", () => ({
  InsufficientCreditsError: class InsufficientCreditsError extends Error {},
}));

let app: express.Express;

beforeAll(async () => {
  const { chatsRouter } = await import("../src/routes/chats/chats.js");
  const { requireAuth } = await import("../src/middleware/requireAuth.js");
  app = express();
  app.use("/chats", requireAuth, chatsRouter);
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyAccessToken.mockResolvedValue({ userId: "verified_user", sessionId: "session_123" });
  mocks.find.mockReturnValue({ project: mocks.project });
  mocks.project.mockReturnValue({ toArray: mocks.toArray });
  mocks.toArray.mockResolvedValue([]);
});

describe("chat ownership", () => {
  it("lists chats only for the verified subject", async () => {
    const response = await request(app).get("/chats/all").set("Authorization", "Bearer valid_token");
    expect(response.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith({ userId: "verified_user" });
  });

  it("does not expose the former client-supplied user ID route", async () => {
    const response = await request(app).get("/chats/all/attacker").set("Authorization", "Bearer valid_token");
    expect(response.status).toBe(404);
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
