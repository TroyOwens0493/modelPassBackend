import { Polar } from "@polar-sh/sdk";
import { Router } from "express";
import type { Router as RouterType } from "express";
import { getOrCreateBillingUser } from "../billing/balanceLedger.js";
import { depositIntentsCollection, ledgerEntriesCollection } from "../billing/model.js";
import { createDepositIntent, fundingFeeCents, markDepositCheckoutCreated, parseDepositCents, releaseDepositIntent } from "../billing/deposits.js";
import { customerBalance, customerBalanceFromBigInt, parseUsd } from "../billing/money.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { frontendUrl } from "../config.js";

export const billingRouter: RouterType = Router();
billingRouter.use(requireAuth);

billingRouter.get("/", async (req, res) => {
  const user = req.session!.user!;
  const billingUser = await getOrCreateBillingUser(user.id, user.email);
  if (!billingUser) return res.status(500).json({ error: "Unable to load Balance" });
  const newestEntry = await ledgerEntriesCollection().find({ workosUserId: user.id }).sort({ createdAt: -1 }).limit(1).next();
  const holdTotal = (billingUser.usageHolds ?? []).reduce((sum, hold) => sum + parseUsd(hold.amount), 0n);
  return res.json({
    balance: { availableUsd: customerBalance(newestEntry?.balanceAfter), holdUsd: customerBalanceFromBigInt(holdTotal), frozen: Boolean(billingUser.billingFrozen) },
    activeHolds: (billingUser.usageHolds ?? []).map((hold) => ({ id: hold.id, amountUsd: customerBalance(hold.amount), createdAt: hold.createdAt.toISOString() })),
    deposit: { minimumUsd: "5.00", maximumUsd: "500.00", currency: "USD", fundingFeeNonrefundable: true },
    checkoutEnabled: Boolean(process.env.POLAR_ACCESS_TOKEN && process.env.POLAR_WALLET_PRODUCT_ID && process.env.POLAR_WEBHOOK_SECRET),
  });
});

billingRouter.post("/quote", (req, res) => {
  try {
    const depositCents = parseDepositCents(req.body?.depositUsd);
    const feeCents = fundingFeeCents(depositCents);
    res.json({ depositUsd: (depositCents / 100).toFixed(2), fundingFeeUsd: (feeCents / 100).toFixed(2), subtotalUsd: ((depositCents + feeCents) / 100).toFixed(2), tax: "Calculated by Polar" });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid Deposit", code: "INVALID_DEPOSIT" }); }
});

billingRouter.get("/checkout/:checkoutId", async (req, res) => {
  const checkoutId = typeof req.params.checkoutId === "string" ? req.params.checkoutId : "";
  const intent = await depositIntentsCollection().findOne({ polarCheckoutId: checkoutId, workosUserId: req.session!.user!.id });
  if (!intent) return res.status(404).json({ error: "Checkout was not found" });
  return res.json({ status: intent.status, balanceUpdated: intent.status === "paid" });
});

billingRouter.post("/checkout", async (req, res) => {
  const user = req.session!.user!;
  const productId = process.env.POLAR_WALLET_PRODUCT_ID;
  if (!process.env.POLAR_ACCESS_TOKEN || !productId || !process.env.POLAR_WEBHOOK_SECRET) return res.status(503).json({ error: "Deposits are not configured.", code: "BILLING_NOT_CONFIGURED" });
  let intent: Awaited<ReturnType<typeof createDepositIntent>> | undefined;
  try {
    intent = await createDepositIntent(user.id, req.body?.depositUsd);
    const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN, server: process.env.POLAR_SERVER === "production" ? "production" : "sandbox" });
    const checkout = await polar.checkouts.create({
      products: [productId],
      prices: { [productId]: [{ amountType: "fixed", priceCurrency: "usd", priceAmount: intent.depositCents + intent.fundingFeeCents }] },
      externalCustomerId: user.id,
      customerEmail: user.email,
      allowDiscountCodes: false,
      successUrl: `${frontendUrl}/credits?checkout=success&checkout_id={CHECKOUT_ID}`,
      returnUrl: `${frontendUrl}/credits?checkout=canceled`,
      metadata: { depositIntentId: intent.id, depositCents: intent.depositCents, fundingFeeCents: intent.fundingFeeCents, feePolicyVersion: intent.feePolicyVersion },
    });
    await markDepositCheckoutCreated(intent.id, checkout.id, checkout.expiresAt);
    return res.status(201).json({ checkoutUrl: checkout.url });
  } catch (error) {
    if (intent) await releaseDepositIntent(intent.id);
    const message = error instanceof Error ? error.message : "We could not start checkout.";
    const inputError = /Deposit|Balance cap|frozen|paused/.test(message);
    return res.status(inputError ? 400 : 502).json({ error: message, code: inputError ? "INVALID_DEPOSIT" : "CHECKOUT_CREATION_FAILED" });
  }
});
