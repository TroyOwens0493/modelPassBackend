import type { Collection } from "mongodb";
import { db } from "../../db.js";
import type { ChatDocument } from "./types.js";

export function chatsCollection(): Collection<ChatDocument> {
  return db().collection<ChatDocument>("chats");
}
