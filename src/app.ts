import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { billingRouter } from "./routes/billing.js";
import { chatsRouter } from "./routes/chats/chats.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { cookiePassword } from "./workos.js";

export const app: Express = express();

const allowedOrigins = [process.env.CORS_ORIGIN, "http://localhost:5173", "http://localhost:3000"]
  .filter(Boolean) as string[];

// Security middleware
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true, // Required for cookies
}));

// Body parsing
app.use(express.json());

// Cookie parsing with secret for signed cookies
if (!cookiePassword) {
  throw new Error("WORKOS_COOKIE_PASSWORD environment variable is required (32+ characters)");
}
app.use(cookieParser(cookiePassword));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

// Auth routes (/auth/login, /auth/callback, /auth/logout, /auth/me)
app.use("/auth", authRouter);

// Chat routes (/chats, /chats/:chatId, /chats/:chatId/messages)
app.use("/chats", requireAuth, chatsRouter);

// Billing routes (/api/billing, /api/billing/checkout)
app.use("/api/billing", billingRouter);

// Home route - shows auth status
app.get("/", (req, res) => {
  const sessionCookie = req.signedCookies.workos_session;

  if (sessionCookie) {
    try {
      const session = JSON.parse(sessionCookie);
      res.json({
        authenticated: true,
        user: session.user,
        loginUrl: null,
        logoutUrl: "/auth/logout",
      });
      return;
    } catch {
      // Invalid session, fall through to unauthenticated response
    }
  }

  res.json({
    authenticated: false,
    user: null,
    loginUrl: "/auth/login",
    logoutUrl: null,
  });
});
