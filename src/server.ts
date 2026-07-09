import { MongoClient } from "mongodb";
import { app } from "./app.js";

const PORT = process.env.PORT || 3000;

const client = new MongoClient(process.env.MONGODB_URI!);
await client.connect();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
