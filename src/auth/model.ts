import type { User } from "@workos-inc/node";
import { billingUsersCollection } from "../billing/model.js";
import type { BillingUserDocument } from "../billing/types.js";

export async function syncAuthUser(user: User) {
  const now = new Date();
  return billingUsersCollection().findOneAndUpdate(
    { workosUserId: user.id },
    {
      $setOnInsert: {
        workosUserId: user.id,
        creditBalance: 0,
        creditsUsed: 0,
        tokensUsed: 0,
        createdAt: now,
      },
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
  return billingUsersCollection().findOne({ workosUserId });
}

export async function updateAuthUserPreferences(
  workosUserId: string,
  preferences: { name?: string; replyStyle?: string; defaultModel?: string },
) {
  const update = Object.fromEntries(
    Object.entries(preferences).filter(([, value]) => typeof value === "string"),
  );

  return billingUsersCollection().findOneAndUpdate(
    { workosUserId },
    { $set: { ...update, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
}

export function toPublicUser(user: BillingUserDocument) {
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
