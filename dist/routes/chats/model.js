import { db } from "../../db.js";
export function chatsCollection() {
    return db().collection("chats");
}
