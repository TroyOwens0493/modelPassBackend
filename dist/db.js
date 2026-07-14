import { MongoClient } from "mongodb";
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;
if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required");
}
export const mongoClient = new MongoClient(MONGODB_URI);
let connectedDb = null;
export async function connectDb() {
    if (!connectedDb) {
        await mongoClient.connect();
        connectedDb = mongoClient.db(MONGODB_DB_NAME);
    }
    return connectedDb;
}
export function db() {
    if (!connectedDb) {
        throw new Error("Database has not been connected. Call connectDb() before using db().");
    }
    return connectedDb;
}
