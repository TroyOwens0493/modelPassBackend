import { describe, expect, it } from "vitest";
import request from "supertest";

process.env.WORKOS_API_KEY ??= "test_workos_api_key";
process.env.WORKOS_CLIENT_ID ??= "test_workos_client_id";
process.env.WORKOS_COOKIE_PASSWORD ??= "test_cookie_password_must_be_32_chars";
process.env.CORS_ORIGIN ??= "http://localhost:5173";

const { app } = await import("../src/app.js");

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
});
