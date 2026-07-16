import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from "jose";
import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createAccessTokenVerifier } from "../src/auth/tokenVerifier.js";
import { createRequireAuth } from "../src/middleware/requireAuth.js";

const issuer = "https://modelpass-test.authkit.app";
const audience = "client_test";
let privateKey: CryptoKey;
let verifier: ReturnType<typeof createAccessTokenVerifier>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  verifier = createAccessTokenVerifier({
    issuer,
    audience,
    keySet: createLocalJWKSet({ keys: [{ ...publicJwk, kid: "test-key", alg: "RS256" }] }),
  });
});

async function token(overrides: { issuer?: string; audience?: string; expiresAt?: string; sub?: string; sid?: string } = {}) {
  return new SignJWT({ sid: overrides.sid ?? "session_123" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(overrides.issuer ?? issuer)
    .setAudience(overrides.audience ?? audience)
    .setSubject(overrides.sub ?? "user_123")
    .setIssuedAt()
    .setExpirationTime(overrides.expiresAt ?? "5m")
    .sign(privateKey);
}

function testApp() {
  const app = express();
  app.get("/protected", createRequireAuth(verifier), (req, res) => res.json(req.auth));
  return app;
}

describe("bearer authentication", () => {
  it("returns MISSING_TOKEN when no bearer token is supplied", async () => {
    const response = await request(testApp()).get("/protected");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("MISSING_TOKEN");
  });

  it("returns INVALID_TOKEN for malformed tokens", async () => {
    const malformed = await request(testApp()).get("/protected").set("Authorization", "Basic nope");
    const invalid = await request(testApp()).get("/protected").set("Authorization", "Bearer not-a-jwt");
    expect(malformed.body.code).toBe("INVALID_TOKEN");
    expect(invalid.body.code).toBe("INVALID_TOKEN");
  });

  it("returns INVALID_TOKEN for a token signed by an untrusted key", async () => {
    const rogueKey = (await generateKeyPair("RS256")).privateKey;
    const rogueToken = await new SignJWT({ sid: "session_123" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer).setAudience(audience).setSubject("user_123")
      .setIssuedAt().setExpirationTime("5m").sign(rogueKey);
    const response = await request(testApp()).get("/protected").set("Authorization", `Bearer ${rogueToken}`);
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_TOKEN");
  });

  it("returns TOKEN_EXPIRED for expired tokens", async () => {
    const response = await request(testApp()).get("/protected").set("Authorization", `Bearer ${await token({ expiresAt: "0s" })}`);
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("TOKEN_EXPIRED");
  });

  it.each([
    ["issuer", { issuer: "https://wrong.authkit.app" }],
    ["audience", { audience: "wrong_client" }],
  ])("rejects the wrong %s", async (_label, overrides) => {
    const response = await request(testApp()).get("/protected").set("Authorization", `Bearer ${await token(overrides)}`);
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_TOKEN");
  });

  it("attaches only the verified subject and session ID", async () => {
    const response = await request(testApp()).get("/protected").set("Authorization", `Bearer ${await token()}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: "user_123", sessionId: "session_123" });
  });
});
