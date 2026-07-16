import type { NextFunction, Request, Response } from "express";
import {
  isExpiredTokenError,
  verifyAccessToken,
  type AccessTokenVerifier,
} from "../auth/tokenVerifier.js";

export function createRequireAuth(verifier: AccessTokenVerifier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;

    if (!authorization) {
      res.status(401).json({ error: "Authentication is required", code: "MISSING_TOKEN" });
      return;
    }

    const match = authorization.match(/^Bearer ([^\s]+)$/i);
    if (!match) {
      res.status(401).json({ error: "The bearer token is malformed", code: "INVALID_TOKEN" });
      return;
    }

    try {
      req.auth = await verifier(match[1]);
      next();
    } catch (error) {
      res.status(401).json({
        error: isExpiredTokenError(error) ? "The access token has expired" : "The access token is invalid",
        code: isExpiredTokenError(error) ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      });
    }
  };
}

export const requireAuth = createRequireAuth(verifyAccessToken);
