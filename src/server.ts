//test for connection

// server.ts
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI!);
await client.connect();

const db = client.db("sleepOutside");

app.get("/api/test", async (req, res) => {
  const items = await db.collection("test").find().toArray();
  res.json(items);
});

app.post("/api/test", async (req, res) => {
  const result = await db.collection("test").insertOne(req.body);
  res.json(result);
});

app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000");
import "dotenv/config";
import { app } from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Login: http://localhost:${PORT}/auth/login`);
});
