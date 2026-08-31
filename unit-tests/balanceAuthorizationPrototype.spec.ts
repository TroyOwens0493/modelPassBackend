import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cliPath = fileURLToPath(
  new URL("../src/billing/balance-authorization.prototype/cli.ts", import.meta.url),
);

describe("balance authorization prototype CLI", () => {
  it("processes a scripted authorize/finalize session and exits", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", cliPath],
      { input: "a\nf\nq\n", encoding: "utf8", timeout: 5_000 },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Authorized 464 output tokens and posted a Hold");
    expect(result.stdout).toContain("Captured $0.001575 Usage Charge and released unused Hold");
  });
});
