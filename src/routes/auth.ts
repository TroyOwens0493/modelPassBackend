import { Router, Request, Response } from "express";
import type { Router as RouterType } from "express";
import { workos, clientId, redirectUri } from "../workos.js";

// Extend Express Request to include session
declare global {
  namespace Express {
    interface Request {
      session?: {
        user?: {
          id: string;
          email: string;
          firstName: string | null;
          lastName: string | null;
          profilePictureUrl: string | null;
        };
        accessToken?: string;
        refreshToken?: string;
      };
    }
  }
}

export const authRouter: RouterType = Router();

function buildAuthUrl(screenHint?: string) {
  const options: {
    provider: string;
    redirectUri: string;
    clientId: string;
    screenHint?: string;
  } = {
    provider: "authkit",
    redirectUri,
    clientId,
  };

  if (screenHint) {
    options.screenHint = screenHint;
  }

  return workos.userManagement.getAuthorizationUrl(options);
}

/**
 * GET /auth/login
 * Redirects user to WorkOS AuthKit for authentication
 */
authRouter.get("/login", async (_req: Request, res: Response) => {
  try {
    const authorizationUrl = buildAuthUrl();
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error("Error generating authorization URL:", error);
    res.status(500).json({ error: "Failed to initiate login" });
  }
});

/**
 * GET /auth/signup
 * Redirects user to WorkOS AuthKit with signup screen hint.
 */
authRouter.get("/signup", async (_req: Request, res: Response) => {
  try {
    const authorizationUrl = buildAuthUrl("signup");
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error("Error generating signup authorization URL:", error);
    res.status(500).json({ error: "Failed to initiate signup" });
  }
});

/**
 * GET /auth/callback
 * Handles OAuth callback from WorkOS AuthKit
 * Exchanges authorization code for user session
 */
authRouter.get("/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;

  if (!code) {
    res.status(400).json({ error: "Authorization code is required" });
    return;
  }

  try {
    const { user, accessToken, refreshToken } =
      await workos.userManagement.authenticateWithCode({
        code,
        clientId,
      });

    // Store session data in a secure cookie
    const sessionData = {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
      },
      accessToken,
      refreshToken,
    };

    // Set session cookie (httpOnly, secure in production)
    res.cookie("workos_session", JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      signed: true,
    });

    // Redirect to home or dashboard after successful login
    res.redirect("/");
  } catch (error) {
    console.error("Error authenticating with WorkOS:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

/**
 * POST /auth/logout
 * Clears the session cookie and logs out the user
 */
authRouter.post("/logout", async (req: Request, res: Response) => {
  try {
    const sessionCookie = req.signedCookies.workos_session;
    res.clearCookie("workos_session");

    if (sessionCookie) {
      const logoutUrl = workos.userManagement.getLogoutUrl({
        sessionId: JSON.parse(sessionCookie).accessToken,
      });

      res.redirect(logoutUrl);
      return;
    }

    res.redirect("/");
  } catch (error) {
    console.error("Error during logout:", error);
    res.clearCookie("workos_session");
    res.redirect("/");
  }
});

/**
 * GET /auth/logout
 * Alternative GET endpoint for logout (for simple link-based logout)
 */
authRouter.get("/logout", async (req: Request, res: Response) => {
  try {
    res.clearCookie("workos_session");
    res.redirect("/");
  } catch (error) {
    console.error("Error during logout:", error);
    res.clearCookie("workos_session");
    res.redirect("/");
  }
});

/**
 * GET /auth/me
 * Returns the current user's session data
 */
authRouter.get("/me", (req: Request, res: Response) => {
  const sessionCookie = req.signedCookies.workos_session;

  if (!sessionCookie) {
    res.status(401).json({ error: "Not authenticated", user: null });
    return;
  }

  try {
    const session = JSON.parse(sessionCookie);
    res.json({ user: session.user });
  } catch {
    res.status(401).json({ error: "Invalid session", user: null });
  }
});
