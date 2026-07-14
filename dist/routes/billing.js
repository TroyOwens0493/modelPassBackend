import { Polar } from "@polar-sh/sdk";
import { Router } from "express";
import { getCreditPackage, getPublicCreditPackages, isCheckoutConfigured, isSandboxCheckout, } from "../billing/packages.js";
import { requireAuth } from "../middleware/requireAuth.js";
export const billingRouter = Router();
billingRouter.use(requireAuth);
billingRouter.get("/", (_req, res) => {
    res.json({
        balance: {
            creditBalance: 0,
            creditsUsed: 0,
            tokensUsed: 0,
        },
        packages: getPublicCreditPackages(),
        transactions: [],
        fulfillmentEnabled: Boolean(process.env.POLAR_WEBHOOK_SECRET),
    });
});
billingRouter.post("/checkout", async (req, res) => {
    const packageId = typeof req.body?.packageId === "string" ? req.body.packageId : "";
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
    const polar = new Polar({
        accessToken: process.env.POLAR_ACCESS_TOKEN,
        server: isSandboxCheckout() ? "sandbox" : "production",
    });
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
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
    }
    catch (error) {
        console.error("Unable to create Polar checkout:", error);
        res.status(502).json({
            error: "We could not start checkout. Please try again.",
            code: "CHECKOUT_CREATION_FAILED",
        });
    }
});
