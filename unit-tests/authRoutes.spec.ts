import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "production";
process.env.FRONTEND_URL = "https://modelpass.netlify.app";

const mocks = vi.hoisted(() => ({
  authenticateWithCode: vi.fn(),
  getOrCreateBillingUser: vi.fn(),
}));

vi.mock("../src/workos.js", () => ({
  clientId: "client_test",
  redirectUri: "https://api.example.com/auth/callback",
  workos: {
    userManagement: {
      authenticateWithCode: mocks.authenticateWithCode,
    },
  },
}));

vi.mock("../src/billing/creditLedger.js", () => ({
  getOrCreateBillingUser: mocks.getOrCreateBillingUser,
}));

vi.mock("jose", () => ({
  decodeJwt: () => ({ sid: "session_123" }),
}));

let app: express.Express;

beforeAll(async () => {
  const { authRouter } = await import("../src/routes/auth.js");
  app = express();
  app.use(cookieParser("test_cookie_password_at_least_32_characters"));
  app.use("/auth", authRouter);

  mocks.authenticateWithCode.mockResolvedValue({
    user: {
      id: "user_123",
      email: "user@example.com",
      firstName: "Sam",
      lastName: "Rivera",
      profilePictureUrl: null,
    },
    accessToken: "access_token",
    refreshToken: "refresh_token",
  });
  mocks.getOrCreateBillingUser.mockResolvedValue(undefined);
});

describe("auth routes", () => {
  it("sets a cookie that can be sent from the production frontend", async () => {
    const response = await request(app).get("/auth/callback?code=authorization_code");

    expect(response.status).toBe(302);
    expect(response.headers["set-cookie"]?.[0]).toContain("SameSite=None");
    expect(response.headers["set-cookie"]?.[0]).toContain("Secure");
  });
});
