import type { User } from "@workos-inc/node";
import { db } from "../db.js";

export type AuthUserDocument = {
  workosUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
  name?: string;
  replyStyle?: string;
  defaultModel?: string;
  createdAt: Date;
  updatedAt: Date;
};

function authUsersCollection() {
  return db().collection<AuthUserDocument>("authUsers");
}

export async function syncAuthUser(user: User) {
  const now = new Date();
  return authUsersCollection().findOneAndUpdate(
    { workosUserId: user.id },
    {
      $setOnInsert: { workosUserId: user.id, createdAt: now },
      $set: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
}

export function getAuthUser(workosUserId: string) {
  return authUsersCollection().findOne({ workosUserId });
}

export async function updateAuthUserPreferences(
  workosUserId: string,
  preferences: { name?: string; replyStyle?: string; defaultModel?: string },
) {
  const update = Object.fromEntries(
    Object.entries(preferences).filter(([, value]) => typeof value === "string"),
  );

  return authUsersCollection().findOneAndUpdate(
    { workosUserId },
    { $set: { ...update, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
}

export function toPublicUser(user: AuthUserDocument) {
  return {
    id: user.workosUserId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profilePictureUrl: user.profilePictureUrl,
    name: user.name,
    replyStyle: user.replyStyle ?? "balanced",
    defaultModel: user.defaultModel ?? "openai/gpt-4o-mini",
  };
}

