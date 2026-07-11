import { describe, expect, it } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";

process.env.WORKOS_API_KEY ??= "test_workos_api_key";
process.env.WORKOS_CLIENT_ID ??= "test_workos_client_id";
process.env.WORKOS_COOKIE_PASSWORD ??= "test_cookie_password_must_be_32_chars";
process.env.CORS_ORIGIN ??= "http://localhost:5173";

const { app } = await import("../src/app.js");

function createSessionCookie() {
  const value = JSON.stringify({
    user: {
      id: "user_123",
      email: "customer@example.com",
    },
  });
  const signature = createHmac(
    "sha256",
    process.env.WORKOS_COOKIE_PASSWORD!,
  )
    .update(value)
    .digest("base64")
    .replace(/=+$/, "");

  return `workos_session=${encodeURIComponent(`s:${value}.${signature}`)}`;
}

describe("app", () => {
  it("responds to the health endpoint", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("allows the configured frontend origin for CORS requests", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:5173");

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("returns logged-out session state from the home route", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      authenticated: false,
      user: null,
      loginUrl: "/auth/login",
      logoutUrl: null,
    });
  });

  it("requires a session cookie for /auth/me", async () => {
    const response = await request(app).get("/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Not authenticated",
      user: null,
    });
  });

  it("protects billing information behind authentication", async () => {
    const response = await request(app).get("/api/billing");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("returns checkout-disabled packages until Polar is configured", async () => {
    const response = await request(app)
      .get("/api/billing")
      .set("Cookie", createSessionCookie());

    expect(response.status).toBe(200);
    expect(response.body.fulfillmentEnabled).toBe(false);
    expect(response.body.packages).toHaveLength(3);
    expect(response.body.packages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "starter",
          checkoutAvailable: false,
        }),
      ]),
    );
    expect(response.body.packages[0]).not.toHaveProperty("polarProductId");
  });

  it("does not create a checkout before secure fulfillment is enabled", async () => {
    const response = await request(app)
      .post("/api/billing/checkout")
      .set("Cookie", createSessionCookie())
      .send({ packageId: "starter" });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("BILLING_NOT_CONFIGURED");
  });
});
