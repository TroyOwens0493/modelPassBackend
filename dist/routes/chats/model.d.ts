import type { Collection } from "mongodb";
import type { ChatDocument } from "./types.js";
export declare function chatsCollection(): Collection<ChatDocument>;
