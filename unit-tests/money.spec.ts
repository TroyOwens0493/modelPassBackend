import { describe, expect, it } from "vitest";
import { customerBalanceFromBigInt, formatUsd, parseProviderCost, parseUsd, usageCharge } from "../src/billing/money.js";

describe("exact Balance money", () => {
  it("round-trips 18-place Decimal128 values without binary floating point", () => {
    const value = parseUsd("12.123456789012345680");
    expect(formatUsd(value)).toBe("12.12345678901234568");
  });
  it("accepts provider JSON numbers serialized in scientific notation", () => {
    expect(formatUsd(parseUsd("5e-8"))).toBe("0.00000005");
  });
  it("adds exactly 5% without per-request rounding", () => {
    const charge = usageCharge(parseUsd("0.000000000000000020"));
    expect(formatUsd(charge.markup)).toBe("0.000000000000000001");
    expect(formatUsd(charge.total)).toBe("0.000000000000000021");
  });
  it("truncates the Customer Balance down to cents", () => {
    expect(customerBalanceFromBigInt(parseUsd("9.999999"))).toBe("9.99");
  });
  it("preserves an 18-place Provider Cost and its exact 5% markup", () => {
    const charge = usageCharge(parseProviderCost("0.000000000000000001"));
    expect(formatUsd(charge.markup)).toBe("0.00000000000000000005");
  });
  it("quarantines Provider Cost outside the 18-place settlement envelope", () => {
    expect(() => parseProviderCost("0.0000000000000000001")).toThrow(/18-place/);
  });
});
