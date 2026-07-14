import { Router } from "express";
import { workos, clientId, redirectUri } from "../workos.js";
export const authRouter = Router();
/**
 * GET /auth/login
 * Redirects user to WorkOS AuthKit for authentication
 */
authRouter.get("/login", async (_req, res) => {
    try {
        const authorizationUrl = workos.userManagement.getAuthorizationUrl({
            provider: "authkit",
            redirectUri,
            clientId,
            screenHint: "sign-in",
        });
        res.redirect(authorizationUrl);
    }
    catch (error) {
        console.error("Error generating authorization URL:", error);
        res.status(500).json({ error: "Failed to initiate login" });
    }
});
/**
 * GET /auth/signup
 * Redirects user to WorkOS AuthKit with the sign-up screen enabled.
 */
authRouter.get("/signup", async (_req, res) => {
    try {
        const authorizationUrl = workos.userManagement.getAuthorizationUrl({
            provider: "authkit",
            redirectUri,
            clientId,
            screenHint: "sign-up",
        });
        res.redirect(authorizationUrl);
    }
    catch (error) {
        console.error("Error generating sign-up authorization URL:", error);
        res.status(500).json({ error: "Failed to initiate sign-up" });
    }
});
/**
 * GET /auth/callback
 * Handles OAuth callback from WorkOS AuthKit
 * Exchanges authorization code for user session
 */
authRouter.get("/callback", async (req, res) => {
    const code = req.query.code;
    if (!code) {
        res.status(400).json({ error: "Authorization code is required" });
        return;
    }
    try {
        const { user, accessToken, refreshToken } = await workos.userManagement.authenticateWithCode({
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
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        res.redirect(`${frontendUrl}/chat`);
    }
    catch (error) {
        console.error("Error authenticating with WorkOS:", error);
        res.status(500).json({ error: "Authentication failed" });
    }
});
/**
 * POST /auth/logout
 * Clears the session cookie and logs out the user
 */
authRouter.post("/logout", async (req, res) => {
    try {
        const sessionCookie = req.signedCookies.workos_session;
        res.clearCookie("workos_session");
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        if (sessionCookie) {
            res.redirect(`${frontendUrl}/login`);
            return;
        }
        res.redirect(`${frontendUrl}/login`);
    }
    catch (error) {
        console.error("Error during logout:", error);
        res.clearCookie("workos_session");
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        res.redirect(`${frontendUrl}/login`);
    }
});
/**
 * GET /auth/logout
 * Alternative GET endpoint for logout (for simple link-based logout)
 */
authRouter.get("/logout", async (req, res) => {
    try {
        res.clearCookie("workos_session");
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        res.redirect(`${frontendUrl}/login`);
    }
    catch (error) {
        console.error("Error during logout:", error);
        res.clearCookie("workos_session");
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        res.redirect(`${frontendUrl}/login`);
    }
});
/**
 * GET /auth/me
 * Returns the current user's session data
 */
authRouter.get("/me", (req, res) => {
    const sessionCookie = req.signedCookies.workos_session;
    if (!sessionCookie) {
        res.status(401).json({ error: "Not authenticated", user: null });
        return;
    }
    try {
        const session = JSON.parse(sessionCookie);
        res.json({ user: session.user });
    }
    catch {
        res.status(401).json({ error: "Invalid session", user: null });
    }
});
