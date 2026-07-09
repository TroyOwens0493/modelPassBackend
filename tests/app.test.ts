import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.WORKOS_API_KEY ??= "test_workos_api_key";
process.env.WORKOS_CLIENT_ID ??= "test_workos_client_id";
process.env.WORKOS_COOKIE_PASSWORD ??= "test_cookie_password_must_be_32_chars";
process.env.CORS_ORIGIN ??= "http://localhost:5173";

const { app } = await import("../src/app.js");

describe("app routes", () => {
  it("returns health check status", async () => {
    const response = await request(app).get("/health").expect(200);

    assert.deepEqual(response.body, { status: "ok" });
  });

  it("returns unauthenticated home session state without a session cookie", async () => {
    const response = await request(app).get("/").expect(200);

    assert.deepEqual(response.body, {
      authenticated: false,
      user: null,
      loginUrl: "/auth/login",
      logoutUrl: null,
    });
  });

  it("rejects /auth/me when no session cookie exists", async () => {
    const response = await request(app).get("/auth/me").expect(401);

    assert.deepEqual(response.body, {
      error: "Not authenticated",
      user: null,
    });
  });

  it("rejects auth callback requests without an authorization code", async () => {
    const response = await request(app).get("/auth/callback").expect(400);

    assert.deepEqual(response.body, {
      error: "Authorization code is required",
    });
  });

  it("clears session cookie and redirects on GET logout", async () => {
    const response = await request(app).get("/auth/logout").expect(302);

    assert.equal(response.headers.location, "/");
    assert.match(response.headers["set-cookie"]?.[0] ?? "", /workos_session=;/);
  });
});
