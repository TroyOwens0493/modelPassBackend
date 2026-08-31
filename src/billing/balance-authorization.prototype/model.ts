/**
 * PROTOTYPE — throw this directory away after issue #20 is resolved.
 *
 * Question: can a request be authorized by shrinking its output-token limit to
 * the largest endpoint-specific worst-case Usage Charge the Customer's exact
 * Balance can cover, while a Hold keeps concurrent requests and interrupted
 * streams from creating debt?
 */

// Provider Cost may have 18 fractional digits; dividing it by 20 for the exact
// markup can produce 20, so the prototype keeps 20 fixed fractional digits.
const SCALE = 100_000_000_000_000_000_000n;

export type Money = bigint;

export type State = {
  balance: Money;
  hold: null | {
    amount: Money;
    outputTokenLimit: number;
    status: "streaming" | "awaiting-provider-cost";
  };
  lastOutcome: string;
};

export type EndpointBudget = {
  promptTokenUpperBound: number;
  promptUsdPerToken: Money;
  completionUsdPerToken: Money;
  requestFeeUsd: Money;
  requestedOutputTokens: number;
  endpointOutputTokenLimit: number;
  minimumOutputTokens: number;
};

export type Authorization =
  | { authorized: false; reason: string }
  | { authorized: true; hold: Money; outputTokenLimit: number };

export function usd(value: string): Money {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * SCALE + BigInt((fraction + "0".repeat(20)).slice(0, 20));
}

export function formatUsd(value: Money): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const fraction = (absolute % SCALE).toString().padStart(20, "0").replace(/0+$/, "");
  return `${sign}$${absolute / SCALE}${fraction ? `.${fraction}` : ".00"}`;
}

function usageCharge(providerCost: Money): Money {
  return providerCost + providerCost / 20n;
}

function providerCostFor(budget: EndpointBudget, outputTokens: number): Money {
  return (
    budget.requestFeeUsd +
    BigInt(budget.promptTokenUpperBound) * budget.promptUsdPerToken +
    BigInt(outputTokens) * budget.completionUsdPerToken
  );
}

export function authorize(balance: Money, budget: EndpointBudget): Authorization {
  const outputCeiling = Math.min(
    budget.requestedOutputTokens,
    budget.endpointOutputTokenLimit,
  );

  for (let output = outputCeiling; output >= budget.minimumOutputTokens; output -= 1) {
    const hold = usageCharge(providerCostFor(budget, output));
    if (hold <= balance) return { authorized: true, hold, outputTokenLimit: output };
  }

  return {
    authorized: false,
    reason: `Balance cannot cover prompt, request fee, and ${budget.minimumOutputTokens} output tokens`,
  };
}

export function start(state: State, budget: EndpointBudget): State {
  if (state.hold) return { ...state, lastOutcome: "Rejected: one prototype request is already active" };
  const result = authorize(state.balance, budget);
  if (!result.authorized) return { ...state, lastOutcome: `Rejected: ${result.reason}` };
  return {
    balance: state.balance - result.hold,
    hold: { amount: result.hold, outputTokenLimit: result.outputTokenLimit, status: "streaming" },
    lastOutcome: `Authorized ${result.outputTokenLimit} output tokens and posted a Hold`,
  };
}

export function interrupt(state: State): State {
  if (!state.hold) return { ...state, lastOutcome: "Nothing to interrupt" };
  return {
    ...state,
    hold: { ...state.hold, status: "awaiting-provider-cost" },
    lastOutcome: "Customer disconnected; Hold remains until authoritative Provider Cost arrives",
  };
}

export function finalize(state: State, providerCost: Money): State {
  if (!state.hold) return { ...state, lastOutcome: "Nothing to finalize" };
  const charge = usageCharge(providerCost);
  if (charge > state.hold.amount) {
    return {
      ...state,
      lastOutcome: `BUDGET BOUND FAILURE: ${formatUsd(charge)} exceeds ${formatUsd(state.hold.amount)} Hold; freeze billing`,
    };
  }
  return {
    balance: state.balance + state.hold.amount - charge,
    hold: null,
    lastOutcome: `Captured ${formatUsd(charge)} Usage Charge and released unused Hold`,
  };
}
