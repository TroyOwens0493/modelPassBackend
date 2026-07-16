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
  clientId: string;
  jwksUrl?: string;
  keySet?: JWTVerifyGetKey;
}): AccessTokenVerifier {
  const issuer = options.issuer.endsWith("/") ? options.issuer : `${options.issuer}/`;
  const keySet = options.keySet ?? createRemoteJWKSet(
    new URL(options.jwksUrl ?? `${issuer}sso/jwks/${options.clientId}`),
  );

  return async (token) => {
    const { payload } = await jwtVerify(token, keySet, {
      issuer,
    });

    if (
      typeof payload.exp !== "number" ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      payload.client_id !== options.clientId
    ) {
      throw new Error("Access token is missing required claims");
    }

    return { userId: payload.sub, sessionId: payload.sid };
  };
}

let configuredVerifier: AccessTokenVerifier | undefined;

export function verifyAccessToken(token: string) {
  if (!configuredVerifier) {
    const issuer = process.env.WORKOS_JWT_ISSUER ?? "https://api.workos.com/";
    const clientId = process.env.WORKOS_CLIENT_ID;

    if (!clientId) {
      throw new Error("WORKOS_CLIENT_ID is required");
    }

    configuredVerifier = createAccessTokenVerifier({ issuer, clientId });
  }

  return configuredVerifier(token);
}

export function isExpiredTokenError(error: unknown) {
  return error instanceof joseErrors.JWTExpired;
}
