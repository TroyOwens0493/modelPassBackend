import { WorkOS } from "@workos-inc/node";

if (!process.env.WORKOS_API_KEY) {
  throw new Error("WORKOS_API_KEY environment variable is required");
}

if (!process.env.WORKOS_CLIENT_ID) {
  throw new Error("WORKOS_CLIENT_ID environment variable is required");
}

export const workos = new WorkOS(process.env.WORKOS_API_KEY, {
  clientId: process.env.WORKOS_CLIENT_ID,
});

export const clientId = process.env.WORKOS_CLIENT_ID;
export const redirectUri = process.env.WORKOS_REDIRECT_URI || "http://localhost:3000/auth/token-callback";
export const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
