import { Polar } from "@polar-sh/sdk";
import { Router, type Request, type Response } from "express";
import type { Router as RouterType } from "express";
import {
  getCreditPackage,
  getPublicCreditPackages,
} from "../billing/packages.js";

type SessionUser = {
  id: string;
  email: string;
};

export const billingRouter: RouterType = Router();

function getSessionUser(req: Request): SessionUser | null {
  const sessionCookie = req.signedCookies.workos_session;

  if (typeof sessionCookie !== "string") {
    return null;
  }

  try {
    const session = JSON.parse(sessionCookie);

    if (
      typeof session?.user?.id !== "string" ||
      typeof session?.user?.email !== "string"
    ) {
      return null;
    }

    return session.user;
  } catch {
    return null;
  }
}

function requireSessionUser(req: Request, res: Response) {
  const user = getSessionUser(req);

  if (!user) {
    res.status(401).json({
      error: "Authentication required",
      code: "AUTHENTICATION_REQUIRED",
    });
    return null;
  }

  return user;
}

billingRouter.get("/", (req, res) => {
  if (!requireSessionUser(req, res)) {
    return;
  }

  res.json({
    balance: {
      creditBalance: 0,
      creditsUsed: 0,
      tokensUsed: 0,
    },
    packages: getPublicCreditPackages(),
    transactions: [],
    fulfillmentEnabled: process.env.POLAR_CHECKOUT_ENABLED === "true",
  });
});

billingRouter.post("/checkout", async (req, res) => {
  const user = requireSessionUser(req, res);

  if (!user) {
    return;
  }

  const packageId =
    typeof req.body?.packageId === "string" ? req.body.packageId : "";
  const creditPackage = getCreditPackage(packageId);

  if (!creditPackage) {
    res.status(400).json({
      error: "That credit package is not available",
      code: "INVALID_PACKAGE",
    });
    return;
  }

  const accessToken = process.env.POLAR_ACCESS_TOKEN;

  if (
    process.env.POLAR_CHECKOUT_ENABLED !== "true" ||
    !accessToken ||
    !creditPackage.polarProductId
  ) {
    res.status(503).json({
      error: "Polar checkout has not been configured yet",
      code: "BILLING_NOT_CONFIGURED",
    });
    return;
  }

  const polar = new Polar({
    accessToken,
    server: process.env.POLAR_SERVER === "production" ? "production" : "sandbox",
  });
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

  try {
    const checkout = await polar.checkouts.create({
      products: [creditPackage.polarProductId],
      externalCustomerId: user.id,
      customerEmail: user.email,
      successUrl: `${frontendUrl}/credits?checkout=success&checkout_id={CHECKOUT_ID}`,
      returnUrl: `${frontendUrl}/credits?checkout=canceled`,
      metadata: {
        packageId: creditPackage.id,
        credits: creditPackage.credits,
      },
    });

    res.status(201).json({ checkoutUrl: checkout.url });
  } catch (error) {
    console.error("Unable to create Polar checkout:", error);
    res.status(502).json({
      error: "We could not start checkout. Please try again.",
      code: "CHECKOUT_CREATION_FAILED",
    });
  }
});
