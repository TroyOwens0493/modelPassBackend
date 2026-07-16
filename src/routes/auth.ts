import { Router } from "express";
import type { Request, Response, Router as RouterType } from "express";
import {
  getAuthUser,
  syncAuthUser,
  toPublicUser,
  updateAuthUserPreferences,
} from "../auth/model.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { clientId, frontendUrl, redirectUri, workos } from "../workos.js";

export const authRouter: RouterType = Router();

const statePattern = /^[A-Za-z0-9_-]{16,256}$/;

authRouter.get("/authorize", (req: Request, res: Response) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const screenHint = req.query.screen_hint === "sign-up" ? "sign-up" : "sign-in";

  if (!statePattern.test(state)) {
    res.status(400).json({ error: "A valid state nonce is required" });
    return;
  }

  try {
    res.redirect(workos.userManagement.getAuthorizationUrl({
      provider: "authkit",
      redirectUri,
      clientId,
      screenHint,
      state,
    }));
  } catch {
    console.error("Unable to initiate authentication");
    res.status(500).json({ error: "Failed to initiate authentication" });
  }
});

authRouter.get("/token-callback", (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";

  if (!code || !statePattern.test(state)) {
    res.status(400).json({ error: "Authorization code and state are required" });
    return;
  }

  const fragment = new URLSearchParams({ code, state });
  res.redirect(`${frontendUrl}/auth/callback#${fragment}`);
});

async function persistAuthentication(response: Awaited<ReturnType<typeof workos.userManagement.authenticateWithCode>>) {
  await syncAuthUser(response.user);

  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    user: response.user,
  };
}

authRouter.post("/exchange", async (req: Request, res: Response) => {
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (!code) {
    res.status(400).json({ error: "Authorization code is required" });
    return;
  }

  try {
    const authentication = await workos.userManagement.authenticateWithCode({ code, clientId });
    res.json(await persistAuthentication(authentication));
  } catch {
    console.error("Authorization code exchange failed");
    res.status(401).json({ error: "Authorization code exchange failed", code: "INVALID_CODE" });
  }
});

authRouter.post("/refresh", async (req: Request, res: Response) => {
  const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  if (!refreshToken) {
    res.status(400).json({ error: "Refresh token is required" });
    return;
  }

  try {
    const authentication = await workos.userManagement.authenticateWithRefreshToken({
      refreshToken,
      clientId,
    });
    res.json(await persistAuthentication(authentication));
  } catch {
    console.error("Token refresh failed");
    res.status(401).json({ error: "Token refresh failed", code: "INVALID_REFRESH_TOKEN" });
  }
});

authRouter.post("/logout", requireAuth, async (req: Request, res: Response) => {
  try {
    await workos.userManagement.revokeSession({ sessionId: req.auth!.sessionId });
    res.status(204).end();
  } catch {
    console.error("Session revocation failed");
    res.status(502).json({ error: "Session revocation failed" });
  }
});

authRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  const user = await getAuthUser(req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: "User profile was not found" });
    return;
  }

  res.json({ user: toPublicUser(user) });
});

authRouter.patch("/me", requireAuth, async (req: Request, res: Response) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
  const replyStyle = typeof req.body?.replyStyle === "string" ? req.body.replyStyle : undefined;
  const defaultModel = typeof req.body?.defaultModel === "string" ? req.body.defaultModel : undefined;
  const user = await updateAuthUserPreferences(req.auth!.userId, {
    ...(name ? { name } : {}),
    ...(replyStyle ? { replyStyle } : {}),
    ...(defaultModel ? { defaultModel } : {}),
  });

  if (!user) {
    res.status(404).json({ error: "User profile was not found" });
    return;
  }

  res.json({ user: toPublicUser(user) });
});
