import { afterEach, beforeAll, describe, expect, it } from "vitest";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/modelpass-test";
let fundingFeeCents: typeof import("../src/billing/deposits.js").fundingFeeCents;
let parseDepositCents: typeof import("../src/billing/deposits.js").parseDepositCents;
beforeAll(async () => ({ fundingFeeCents, parseDepositCents } = await import("../src/billing/deposits.js")));

afterEach(() => { delete process.env.POLAR_BASE_FEE_BPS; delete process.env.POLAR_BASE_FIXED_FEE_CENTS; });
describe("Deposit rules", () => {
  it("accepts $5.00 through $500.00 in cent increments", () => {
    expect(parseDepositCents("5")).toBe(500);
    expect(parseDepositCents("500.00")).toBe(50_000);
    expect(() => parseDepositCents("4.99")).toThrow();
    expect(() => parseDepositCents("5.001")).toThrow();
    expect(() => parseDepositCents("500.01")).toThrow();
  });
  it("grosses up the configured base fee and rounds upward", () => {
    process.env.POLAR_BASE_FEE_BPS = "400";
    process.env.POLAR_BASE_FIXED_FEE_CENTS = "40";
    expect(fundingFeeCents(1000)).toBe(84);
  });
});
