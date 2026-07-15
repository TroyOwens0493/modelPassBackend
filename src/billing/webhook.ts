import type { Request, Response } from "express";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { applyCreditChange, setPolarCustomerId } from "./creditLedger.js";
import { getCreditPackageByPolarProductId } from "./packages.js";

function stringHeaders(req: Request) {
  return Object.fromEntries(
    Object.entries(req.headers).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  );
}

export async function polarWebhookHandler(req: Request, res: Response) {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

  if (!webhookSecret) {
    res.status(503).json({ error: "Polar webhook is not configured" });
    return;
  }

  try {
    const event = validateEvent(req.body, stringHeaders(req), webhookSecret);

    if (event.type !== "order.paid") {
      res.status(202).send();
      return;
    }

    const order = event.data;
    const workosUserId = order.customer.externalId;
    const creditPackage = order.productId
      ? getCreditPackageByPolarProductId(order.productId)
      : undefined;

    if (!workosUserId) {
      console.error("Polar paid order has no external customer ID", order.id);
      res.status(422).json({ error: "Order is not linked to an app user" });
      return;
    }

    if (!creditPackage) {
      console.error("Polar paid order has an unknown product", order.id);
      res.status(422).json({ error: "Order product is not configured" });
      return;
    }

    const result = await applyCreditChange({
      workosUserId,
      type: "purchase",
      creditDelta: creditPackage.credits,
      description: `${creditPackage.name} credit package`,
      source: "polar",
      externalId: `polar:order:${order.id}`,
      metadata: {
        polarOrderId: order.id,
        polarCheckoutId: order.checkoutId,
        polarProductId: order.productId!,
        amount: order.totalAmount,
        currency: order.currency,
      },
    });

    await setPolarCustomerId(workosUserId, order.customerId);

    res.status(202).json({
      received: true,
      applied: result.applied,
    });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      res.status(403).json({ error: "Invalid webhook signature" });
      return;
    }

    console.error("Unable to process Polar webhook:", error);
    res.status(500).json({ error: "Unable to process webhook" });
  }
}
