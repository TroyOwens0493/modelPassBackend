type Environment = Record<string, string | undefined>;

function withoutTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

export function getFrontendUrl(environment: Environment = process.env) {
  return withoutTrailingSlash(environment.FRONTEND_URL || "http://localhost:5173");
}

export function getWorkosRedirectUri(environment: Environment = process.env) {
  return `${getFrontendUrl(environment)}/auth/callback`;
}

export const frontendUrl = getFrontendUrl();
