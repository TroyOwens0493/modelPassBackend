import express from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrCreateBillingUser: vi.fn(),
  setDefaultModel: vi.fn(),
  isSelectableModel: vi.fn(),
}));

vi.mock("../src/billing/creditLedger.js", () => ({
  getOrCreateBillingUser: mocks.getOrCreateBillingUser,
  setDefaultModel: mocks.setDefaultModel,
}));

vi.mock("../src/models/catalog.js", () => ({
  DEFAULT_MODEL: "openai/gpt-4o-mini",
  isSelectableModel: mocks.isSelectableModel,
}));

vi.mock("../src/workos.js", () => ({
  workos: { userManagement: {} },
  clientId: "client_test",
  redirectUri: "http://localhost/callback",
}));

vi.mock("../src/config.js", () => ({ frontendUrl: "http://localhost:5173" }));

let app: express.Express;

beforeAll(async () => {
  const { authRouter } = await import("../src/routes/auth.js");
  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.signedCookies = {
      workos_session: JSON.stringify({
        user: { id: "user_123", email: "user@example.com" },
      }),
    };
    req.secret = "test_cookie_password_at_least_32_characters";
    next();
  });
  app.use("/auth", authRouter);
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOrCreateBillingUser.mockResolvedValue({
    workosUserId: "user_123",
    defaultModel: "anthropic/claude-sonnet-4",
  });
  mocks.isSelectableModel.mockResolvedValue(true);
  mocks.setDefaultModel.mockResolvedValue(undefined);
});

describe("profile model preference", () => {
  it("loads the preferred model from the user document", async () => {
    const response = await request(app).get("/auth/me");

    expect(response.status).toBe(200);
    expect(response.body.user.defaultModel).toBe("anthropic/claude-sonnet-4");
    expect(mocks.getOrCreateBillingUser).toHaveBeenCalledWith(
      "user_123",
      "user@example.com",
    );
  });

  it("persists an available preferred model", async () => {
    const response = await request(app)
      .patch("/auth/me")
      .send({ defaultModel: "google/gemini-2.5-flash" });

    expect(response.status).toBe(200);
    expect(mocks.setDefaultModel).toHaveBeenCalledWith(
      "user_123",
      "google/gemini-2.5-flash",
    );
    expect(response.body.user.defaultModel).toBe("google/gemini-2.5-flash");
  });

  it("rejects an unavailable preferred model", async () => {
    mocks.isSelectableModel.mockResolvedValue(false);

    const response = await request(app)
      .patch("/auth/me")
      .send({ defaultModel: "image/only" });

    expect(response.status).toBe(400);
    expect(mocks.setDefaultModel).not.toHaveBeenCalled();
  });

  it("reports a catalog outage without overwriting the preference", async () => {
    mocks.isSelectableModel.mockRejectedValue(new Error("OpenRouter unavailable"));

    const response = await request(app)
      .patch("/auth/me")
      .send({ defaultModel: "openai/gpt-4o-mini" });

    expect(response.status).toBe(503);
    expect(mocks.setDefaultModel).not.toHaveBeenCalled();
  });
});
