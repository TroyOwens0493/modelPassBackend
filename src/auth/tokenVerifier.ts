import {
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import type { AuthPrincipal } from "./types.js";

export type AccessTokenVerifier = (token: string) => Promise<AuthPrincipal>;

export function createAccessTokenVerifier(options: {
  issuer: string;
  audience: string;
  keySet?: JWTVerifyGetKey;
}): AccessTokenVerifier {
  const issuer = options.issuer.replace(/\/$/, "");
  const keySet = options.keySet ?? createRemoteJWKSet(
    new URL(`${issuer}/oauth2/jwks`),
  );

  return async (token) => {
    const { payload } = await jwtVerify(token, keySet, {
      issuer,
      audience: options.audience,
    });

    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      throw new Error("Access token is missing required subject or session claims");
    }

    return { userId: payload.sub, sessionId: payload.sid };
  };
}

let configuredVerifier: AccessTokenVerifier | undefined;

export function verifyAccessToken(token: string) {
  if (!configuredVerifier) {
    const issuer = process.env.WORKOS_JWT_ISSUER;
    const audience = process.env.WORKOS_CLIENT_ID;

    if (!issuer || !audience) {
      throw new Error("WORKOS_JWT_ISSUER and WORKOS_CLIENT_ID are required");
    }

    configuredVerifier = createAccessTokenVerifier({ issuer, audience });
  }

  return configuredVerifier(token);
}

export function isExpiredTokenError(error: unknown) {
  return error instanceof joseErrors.JWTExpired;
}

