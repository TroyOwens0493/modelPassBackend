import { Polar } from "@polar-sh/sdk";
import { connectDb, mongoClient } from "../db.js";
import { ensureBillingIndexes } from "../billing/model.js";
import {
  applyCreditPurchase,
  setPolarCustomerId,
} from "../billing/creditLedger.js";
import {
  getCreditPackageByPolarProductId,
  isSandboxCheckout,
} from "../billing/packages.js";

const accessToken = process.env.POLAR_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error("POLAR_ACCESS_TOKEN is required");
}

await connectDb();
await ensureBillingIndexes();

const polar = new Polar({
  accessToken,
  server: isSandboxCheckout() ? "sandbox" : "production",
});
let applied = 0;
let skipped = 0;

try {
  const pages = await polar.orders.list({ limit: 100 });

  for await (const page of pages) {
    for (const order of page.result.items) {
      const workosUserId = order.customer.externalId;
      const creditPackage = order.productId
        ? getCreditPackageByPolarProductId(order.productId)
        : undefined;

      if (!order.paid || !workosUserId || !creditPackage) {
        skipped += 1;
        continue;
      }

      const result = await applyCreditPurchase({
        workosUserId,
        credits: creditPackage.credits,
        description: `${creditPackage.name} credit package`,
        externalId: `polar:order:${order.id}`,
        metadata: {
          polarOrderId: order.id,
          polarCheckoutId: order.checkoutId,
          polarProductId: order.productId!,
          amount: order.totalAmount,
          currency: order.currency,
          reconciled: true,
        },
      });

      await setPolarCustomerId(workosUserId, order.customerId);
      result.applied ? (applied += 1) : (skipped += 1);
    }
  }

  console.log(`Polar reconciliation complete: ${applied} applied, ${skipped} skipped.`);
} finally {
  await mongoClient.close();
}
