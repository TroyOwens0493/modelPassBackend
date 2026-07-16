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
import { frontendUrl } from "../config.js";

export const billingRouter: RouterType = Router();

billingRouter.use(requireAuth);

billingRouter.get("/", async (req, res) => {
  const user = req.session!.user!;
  const [billingUser, transactions] = await Promise.all([
    getOrCreateBillingUser(user.id, user.email),
    getRecentCreditTransactions(user.id),
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

  const user = req.session?.user;

  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  await getOrCreateBillingUser(user.id, user.email);

  const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN!,
    server: isSandboxCheckout() ? "sandbox" : "production",
  });
  try {
    const checkout = await polar.checkouts.create({
      products: [creditPackage.polarProductId!],
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
