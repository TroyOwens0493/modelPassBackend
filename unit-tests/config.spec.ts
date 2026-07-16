import { describe, expect, it } from "vitest";
import { getFrontendUrl, getWorkosRedirectUri } from "../src/config.js";

describe("environment URL configuration", () => {
  it("uses the configured frontend URL", () => {
    const environment = { FRONTEND_URL: "https://modelpass.example.com/" };

    expect(getFrontendUrl(environment)).toBe("https://modelpass.example.com");
    expect(getWorkosRedirectUri(environment)).toBe("https://modelpass.example.com/auth/callback");
  });

  it("defaults to the local frontend", () => {
    expect(getFrontendUrl({})).toBe("http://localhost:5173");
    expect(getWorkosRedirectUri({})).toBe("http://localhost:5173/auth/callback");
  });
});
