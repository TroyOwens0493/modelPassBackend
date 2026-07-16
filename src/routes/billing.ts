import { Polar } from "@polar-sh/sdk";
import { Router } from "express";
import type { Router as RouterType } from "express";
import {
  getCreditPackage,
  getPublicCreditPackages,
  isCheckoutConfigured,
  isSandboxCheckout,
} from "../billing/packages.js";
import {
  getOrCreateBillingUser,
  getRecentCreditTransactions,
} from "../billing/creditLedger.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getAuthUser } from "../auth/model.js";

export const billingRouter: RouterType = Router();

billingRouter.use(requireAuth);

billingRouter.get("/", async (req, res) => {
  const userId = req.auth!.userId;
  const user = await getAuthUser(userId);
  const [billingUser, transactions] = await Promise.all([
    getOrCreateBillingUser(userId, user?.email),
    getRecentCreditTransactions(userId),
  ]);

  res.json({
    balance: {
      creditBalance: billingUser!.creditBalance,
      creditsUsed: billingUser!.creditsUsed,
      tokensUsed: billingUser!.tokensUsed,
    },
    packages: getPublicCreditPackages(),
    transactions: transactions.map((transaction) => ({
      id: transaction._id!.toHexString(),
      type: transaction.type,
      credits: transaction.credits,
      balanceAfter: transaction.balanceAfter,
      description: transaction.description,
      createdAt: transaction.createdAt.toISOString(),
    })),
    fulfillmentEnabled: Boolean(process.env.POLAR_WEBHOOK_SECRET),
  });
});

billingRouter.post("/checkout", async (req, res) => {
  const packageId =
    typeof req.body?.packageId === "string" ? req.body.packageId : "";
  const creditPackage = getCreditPackage(packageId);

  if (!creditPackage) {
    res.status(400).json({
      error: "That credit package is not available.",
      code: "INVALID_PACKAGE",
    });
    return;
  }

  if (!isCheckoutConfigured(creditPackage.polarProductId)) {
    res.status(503).json({
      error: isSandboxCheckout()
        ? "Add a Polar sandbox token and product ID to start checkout."
        : "Production checkout requires configured webhook fulfillment.",
      code: "BILLING_NOT_CONFIGURED",
    });
    return;
  }

  const userId = req.auth!.userId;
  const user = await getAuthUser(userId);

  if (!user) {
    res.status(404).json({ error: "User profile was not found" });
    return;
  }

  await getOrCreateBillingUser(userId, user.email);

  const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN!,
    server: isSandboxCheckout() ? "sandbox" : "production",
  });
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  try {
    const checkout = await polar.checkouts.create({
      products: [creditPackage.polarProductId!],
      externalCustomerId: userId,
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
