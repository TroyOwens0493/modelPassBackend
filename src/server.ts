import { app } from "./app.js";
import { connectDb } from "./db.js";

const PORT = process.env.PORT || 3000;

await connectDb();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
