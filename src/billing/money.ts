import { Decimal128 } from "mongodb";

// Provider Cost is accepted through 18 fractional places; two guard digits keep /20 exact.
export const MONEY_SCALE = 20;
export const MONEY_FACTOR = 10n ** BigInt(MONEY_SCALE);

export function parseUsd(value: string | number | Decimal128): bigint {
  const raw = value instanceof Decimal128 ? value.toString() : String(value);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!match) throw new Error(`Invalid USD amount: ${raw}`);
  const fraction = match[3] ?? "";
  const exponent = Number(match[4] ?? "0");
  const digits = BigInt(`${match[2]}${fraction}`);
  const scalePower = MONEY_SCALE + exponent - fraction.length;
  let magnitude: bigint;
  if (scalePower >= 0) magnitude = digits * 10n ** BigInt(scalePower);
  else {
    const divisor = 10n ** BigInt(-scalePower);
    if (digits % divisor !== 0n) throw new Error("USD amount exceeds Decimal128 precision policy");
    magnitude = digits / divisor;
  }
  return match[1] === "-" ? -magnitude : magnitude;
}

export function formatUsd(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const magnitude = value < 0n ? -value : value;
  const whole = magnitude / MONEY_FACTOR;
  const fraction = (magnitude % MONEY_FACTOR).toString().padStart(MONEY_SCALE, "0").replace(/0+$/, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}

export const decimalUsd = (value: bigint) => Decimal128.fromString(formatUsd(value));

export function parseProviderCost(value: string | number | Decimal128) {
  const parsed = parseUsd(value);
  if (parsed % 100n !== 0n) throw new Error("Provider Cost exceeds the 18-place settlement envelope");
  return parsed;
}

export function usageCharge(providerCost: bigint) {
  if (providerCost < 0n) throw new Error("Provider Cost cannot be negative");
  const markup = providerCost / 20n;
  return { markup, total: providerCost + markup };
}

export function centsToUsd(cents: number) {
  if (!Number.isSafeInteger(cents)) throw new Error("Invalid cent amount");
  return BigInt(cents) * (MONEY_FACTOR / 100n);
}

export const truncatedCents = (value: bigint) => value / (MONEY_FACTOR / 100n);
export const customerBalanceFromBigInt = (value: bigint) => (Number(truncatedCents(value)) / 100).toFixed(2);
export const customerBalance = (value: Decimal128 | undefined) => customerBalanceFromBigInt(value ? parseUsd(value) : 0n);
