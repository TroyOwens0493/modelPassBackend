import { app } from "./app.js";
import { connectDb } from "./db.js";
import { ensureBillingIndexes } from "./billing/model.js";
import { reconcilePendingChatUsage } from "./routes/chats/chats.js";

const PORT = process.env.PORT || 3000;

await connectDb();
await ensureBillingIndexes();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

void reconcilePendingChatUsage();
setInterval(() => {
    void reconcilePendingChatUsage();
}, 60_000).unref();
