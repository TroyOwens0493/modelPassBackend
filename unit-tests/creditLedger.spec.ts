import { afterEach, beforeAll, describe, expect, it } from "vitest";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/modelpass-test";

let creditsForCost: typeof import("../src/billing/creditLedger.js").creditsForCost;

beforeAll(async () => {
  ({ creditsForCost } = await import("../src/billing/creditLedger.js"));
});

afterEach(() => {
  delete process.env.USD_PER_CREDIT;
});

describe("creditsForCost", () => {
  it("does not charge for a zero-cost completion", () => {
    expect(creditsForCost(0)).toBe(0);
  });

  it("rounds paid usage up to a whole credit", () => {
    expect(creditsForCost(0.0001)).toBe(1);
    expect(creditsForCost(0.01)).toBe(1);
    expect(creditsForCost(0.0101)).toBe(2);
  });

  it("uses the configured dollar value of a credit", () => {
    process.env.USD_PER_CREDIT = "0.02";

    expect(creditsForCost(0.039)).toBe(2);
  });

  it("falls back safely when the configured rate is invalid", () => {
    process.env.USD_PER_CREDIT = "not-a-number";

    expect(creditsForCost(0.02)).toBe(2);
  });
});
