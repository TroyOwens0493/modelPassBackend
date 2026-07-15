import { app } from "./app.js";
import { connectDb } from "./db.js";
import { ensureBillingIndexes } from "./billing/model.js";
import { reconcilePendingOpenRouterUsage } from "./billing/openRouterUsage.js";

const PORT = process.env.PORT || 3000;

await connectDb();
await ensureBillingIndexes();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

void reconcilePendingOpenRouterUsage();
setInterval(() => {
    void reconcilePendingOpenRouterUsage();
}, 60_000).unref();
