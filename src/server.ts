import { app } from "./app.js";
import { connectDb } from "./db.js";
import { ensureBillingIndexes } from "./billing/model.js";
import { reconcilePendingOpenRouterUsage } from "./billing/openRouterUsage.js";
import { releaseExpiredDepositIntents } from "./billing/deposits.js";
import { reconcilePolarEvidence } from "./billing/polarReconciliation.js";

const PORT = process.env.PORT || 3000;

await connectDb();
await ensureBillingIndexes();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

void reconcilePendingOpenRouterUsage();
void releaseExpiredDepositIntents();
if (process.env.POLAR_ACCESS_TOKEN) {
  void reconcilePolarEvidence().catch((error) => console.error("ALERT: Polar reconciliation failed", error));
  setInterval(() => {
    void reconcilePolarEvidence().catch((error) => console.error("ALERT: Polar reconciliation failed", error));
  }, Math.max(60_000, Number(process.env.POLAR_RECONCILE_INTERVAL_MS ?? 15 * 60_000))).unref();
}
setInterval(() => {
  void reconcilePendingOpenRouterUsage();
  void releaseExpiredDepositIntents();
}, 60_000).unref();
