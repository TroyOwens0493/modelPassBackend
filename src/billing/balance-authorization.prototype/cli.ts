/** PROTOTYPE — run with: pnpm prototype:balance-authorization */
import { createInterface } from "node:readline";
import {
  finalize,
  formatUsd,
  interrupt,
  start,
  type EndpointBudget,
  type State,
  usd,
} from "./model.js";

const budget: EndpointBudget = {
  promptTokenUpperBound: 1_000,
  promptUsdPerToken: usd("0.000001"),
  completionUsdPerToken: usd("0.000004"),
  requestFeeUsd: usd("0"),
  requestedOutputTokens: 1_024,
  endpointOutputTokenLimit: 4_096,
  minimumOutputTokens: 16,
};

let state: State = { balance: usd("0.003"), hold: null, lastOutcome: "Ready" };
const rl = createInterface({ input: process.stdin, output: process.stdout });

function render(): void {
  console.clear();
  console.log("\x1b[1mPROTOTYPE: balance-aware request authorization\x1b[0m");
  console.log("\x1b[2mExact values are shown here for design inspection; the product shows Balance in truncated cents.\x1b[0m\n");
  console.log(`\x1b[1mAvailable Balance\x1b[0m  ${formatUsd(state.balance)}`);
  console.log(`\x1b[1mPrompt upper bound\x1b[0m ${budget.promptTokenUpperBound} tokens`);
  console.log(`\x1b[1mRequested output\x1b[0m   ${budget.requestedOutputTokens} tokens`);
  console.log(`\x1b[1mActive Hold\x1b[0m        ${state.hold ? formatUsd(state.hold.amount) : "none"}`);
  console.log(`\x1b[1mAuthorized output\x1b[0m  ${state.hold?.outputTokenLimit ?? "none"}`);
  console.log(`\x1b[1mRequest state\x1b[0m      ${state.hold?.status ?? "idle"}`);
  console.log(`\x1b[1mLast outcome\x1b[0m       ${state.lastOutcome}\n`);
  console.log("[a] authorize  [i] interrupt  [f] finalize cheaply  [x] force bound failure");
  console.log("[+] add $0.01  [-] reset to $0.003  [q] quit");
  rl.question("> ", handle);
}

function handle(key: string): void {
  if (key === "q") return rl.close();
  if (key === "a") state = start(state, budget);
  if (key === "i") state = interrupt(state);
  if (key === "f") state = finalize(state, usd("0.0015"));
  if (key === "x") state = finalize(state, usd("0.01"));
  if (key === "+") state = { ...state, balance: state.balance + usd("0.01"), lastOutcome: "Deposited $0.01" };
  if (key === "-") state = { balance: usd("0.003"), hold: null, lastOutcome: "Reset" };
  render();
}

render();
