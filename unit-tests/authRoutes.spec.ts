import express from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.FRONTEND_URL = "https://modelpass.netlify.app";

const mocks = vi.hoisted(() => ({
  authenticateWithCode: vi.fn(),
  authenticateWithRefreshToken: vi.fn(),
  getAuthorizationUrl: vi.fn(),
  revokeSession: vi.fn(),
  syncAuthUser: vi.fn(),
  getOrCreateBillingUser: vi.fn(),
  verifyAccessToken: vi.fn(),
}));

vi.mock("../src/workos.js", () => ({
  clientId: "client_test",
  frontendUrl: "https://modelpass.netlify.app",
  redirectUri: "https://api.example.com/auth/token-callback",
  workos: { userManagement: {
    authenticateWithCode: mocks.authenticateWithCode,
    authenticateWithRefreshToken: mocks.authenticateWithRefreshToken,
    getAuthorizationUrl: mocks.getAuthorizationUrl,
    revokeSession: mocks.revokeSession,
  } },
}));
vi.mock("../src/auth/tokenVerifier.js", () => ({
  verifyAccessToken: mocks.verifyAccessToken,
  isExpiredTokenError: () => false,
}));
vi.mock("../src/auth/model.js", () => ({
  syncAuthUser: mocks.syncAuthUser,
  getAuthUser: vi.fn(),
  updateAuthUserPreferences: vi.fn(),
  toPublicUser: vi.fn(),
}));
vi.mock("../src/billing/creditLedger.js", () => ({ getOrCreateBillingUser: mocks.getOrCreateBillingUser }));

let app: express.Express;
const authentication = {
  user: { id: "user_123", email: "user@example.com", firstName: "Sam", lastName: "Rivera", profilePictureUrl: null },
  accessToken: "access_token",
  refreshToken: "rotated_refresh_token",
};

beforeAll(async () => {
  const { authRouter } = await import("../src/routes/auth.js");
  app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateWithCode.mockResolvedValue(authentication);
  mocks.authenticateWithRefreshToken.mockResolvedValue(authentication);
  mocks.getAuthorizationUrl.mockReturnValue("https://example.authkit.app/authorize");
  mocks.verifyAccessToken.mockResolvedValue({ userId: "user_123", sessionId: "session_123" });
});

describe("bearer auth routes", () => {
  it("forwards state and sign-up hint without leaking tokens", async () => {
    const state = "abcdefghijklmnop123456";
    const response = await request(app).get(`/auth/authorize?state=${state}&screen_hint=sign-up`);
    expect(response.status).toBe(302);
    expect(mocks.getAuthorizationUrl).toHaveBeenCalledWith(expect.objectContaining({ state, screenHint: "sign-up" }));
    expect(response.headers.location).not.toContain("token");
  });

  it("moves the one-use code into the frontend fragment", async () => {
    const response = await request(app).get("/auth/token-callback?code=one_use_code&state=abcdefghijklmnop123456");
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://modelpass.netlify.app/auth/callback#code=one_use_code&state=abcdefghijklmnop123456");
  });

  it("exchanges a code and seeds the WorkOS-backed records", async () => {
    const response = await request(app).post("/auth/exchange").send({ code: "one_use_code" });
    expect(response.body).toEqual(authentication);
    expect(mocks.authenticateWithCode).toHaveBeenCalledWith({ code: "one_use_code", clientId: "client_test" });
    expect(mocks.syncAuthUser).toHaveBeenCalledWith(authentication.user);
    expect(mocks.getOrCreateBillingUser).not.toHaveBeenCalled();
  });

  it("returns and persists the rotated refresh token", async () => {
    const response = await request(app).post("/auth/refresh").send({ refreshToken: "old_refresh_token" });
    expect(mocks.authenticateWithRefreshToken).toHaveBeenCalledWith({ refreshToken: "old_refresh_token", clientId: "client_test" });
    expect(response.body.refreshToken).toBe("rotated_refresh_token");
  });

  it("revokes the verified token session ID", async () => {
    const response = await request(app).post("/auth/logout").set("Authorization", "Bearer valid_token");
    expect(response.status).toBe(204);
    expect(mocks.revokeSession).toHaveBeenCalledWith({ sessionId: "session_123" });
  });
});
