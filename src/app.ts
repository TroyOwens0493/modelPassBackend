import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "./routes/auth.js";
import { billingRouter } from "./routes/billing.js";
import { chatsRouter } from "./routes/chats/chats.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { polarWebhookHandler } from "./billing/webhook.js";

export const app: Express = express();

const allowedOrigins = [process.env.CORS_ORIGIN, "http://localhost:5173", "http://localhost:3000"]
  .filter(Boolean) as string[];

// Security middleware
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: false,
  allowedHeaders: ["Authorization", "Content-Type"],
}));

// Polar signatures must be verified against the unparsed request body.
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  polarWebhookHandler,
);

// Body parsing
app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

// Auth routes
app.use("/auth", authRouter);

// Chat routes (/chats, /chats/:chatId, /chats/:chatId/messages)
app.use("/chats", requireAuth, chatsRouter);

// Billing routes (/api/billing, /api/billing/checkout)
app.use("/api/billing", billingRouter);

// Home route - shows auth status
app.get("/", (_req, res) => {
  res.json({
    authenticated: false,
    user: null,
    loginUrl: "/auth/authorize",
    logoutUrl: null,
  });
});
