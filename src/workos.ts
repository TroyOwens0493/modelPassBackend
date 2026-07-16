import { WorkOS } from "@workos-inc/node";
import { getWorkosRedirectUri } from "./config.js";

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
// WorkOS returns through the frontend proxy so its session cookie belongs to
// the same browser-facing origin as every subsequent API request.
export const redirectUri = getWorkosRedirectUri();
export const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD;
