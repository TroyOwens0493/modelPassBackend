import { randomUUID } from "node:crypto";
import { OpenRouter } from "@openrouter/sdk";
import type { ChatMessages } from "@openrouter/sdk/models";
import { finalizeUsage, getOrCreateBillingUser, getPendingUsageHolds, linkHold, markAmbiguousUnlinkedHold, releaseHold, reserveBalance, InsufficientBalanceError } from "./balanceLedger.js";
import { auditRecordsCollection, billingUsersCollection, flowControlsCollection } from "./model.js";
import { formatUsd, parseProviderCost, parseUsd, usageCharge } from "./money.js";

const lookupClient = new OpenRouter({ apiKey: process.env.OPEN_ROUTER_API_KEY, httpReferer: "modelpass.netlify.app", appTitle: "Model Pass" });
const MIN_OUTPUT_TOKENS = 16;
type EndpointConfig = { provider: string; promptPerToken: string; completionPerToken: string; requestCost: string; maxOutputTokens: number; fixedPromptTokens: number; perMessageTokens: number };

function configuredEndpoint(model: string): EndpointConfig {
  let parsed: { version?: string; endpoints?: Record<string, EndpointConfig> };
  try { parsed = JSON.parse(process.env.WALLET_ENDPOINT_CONFIG ?? ""); }
  catch { throw new Error("Versioned wallet endpoint configuration is required"); }
  if (!parsed.version) throw new Error("Versioned wallet endpoint configuration is required");
  const endpoint = parsed.endpoints?.[model];
  if (!endpoint?.provider || !Number.isSafeInteger(endpoint.maxOutputTokens) || endpoint.maxOutputTokens < MIN_OUTPUT_TOKENS || !Number.isSafeInteger(endpoint.fixedPromptTokens) || !Number.isSafeInteger(endpoint.perMessageTokens)) throw new Error("Model endpoint is not enabled for Balance billing");
  parseProviderCost(endpoint.promptPerToken); parseProviderCost(endpoint.completionPerToken); parseProviderCost(endpoint.requestCost);
  return endpoint;
}

function promptTokenBound(messages: ChatMessages[], endpoint: EndpointConfig) {
  return endpoint.fixedPromptTokens + messages.reduce((sum, message) => sum + (typeof message.content === "string" ? Buffer.byteLength(message.content, "utf8") : 0) + endpoint.perMessageTokens, 0);
}

function requestBudget(endpoint: EndpointConfig, promptTokens: number, outputTokens: number) {
  return usageCharge(BigInt(promptTokens) * parseProviderCost(endpoint.promptPerToken) + BigInt(outputTokens) * parseProviderCost(endpoint.completionPerToken) + parseProviderCost(endpoint.requestCost)).total;
}

async function affordableBudget(workosUserId: string, model: string, messages: ChatMessages[], requestedMax?: number) {
  const endpoint = configuredEndpoint(model);
  if (await flowControlsCollection().findOne({ flow: { $in: ["openrouter_dispatch", `openrouter:${model}`] }, paused: true })) throw new Error("Model dispatch is paused for reconciliation");
  const user = await getOrCreateBillingUser(workosUserId);
  if (!user) throw new Error("Unable to load Balance");
  const available = parseUsd(user.balance), promptTokens = promptTokenBound(messages, endpoint);
  const requested = Number.isSafeInteger(requestedMax) ? requestedMax! : endpoint.maxOutputTokens;
  const ceiling = Math.min(endpoint.maxOutputTokens, Math.max(MIN_OUTPUT_TOKENS, requested));
  if (requestBudget(endpoint, promptTokens, MIN_OUTPUT_TOKENS) > available) throw new InsufficientBalanceError();
  let low = MIN_OUTPUT_TOKENS, high = ceiling;
  while (low < high) { const middle = Math.ceil((low + high) / 2); if (requestBudget(endpoint, promptTokens, middle) <= available) low = middle; else high = middle - 1; }
  return { maxCompletionTokens: low, budget: requestBudget(endpoint, promptTokens, low), endpoint };
}

interface StreamInput { workosUserId: string; model: string; messages: ChatMessages[]; requestedMaxCompletionTokens?: number; signal?: AbortSignal; onStart: () => void; onText: (content: string) => void; }
interface ResolvedUsage { providerCost: string; totalTokens: number; }
type StreamUsage = { cost?: number | null; total_tokens?: number; totalTokens?: number };

async function resolveUsage(usage: { costText?: string; totalTokens?: number } | undefined, generationId: string): Promise<ResolvedUsage> {
  if (usage?.costText) return { providerCost: usage.costText, totalTokens: usage.totalTokens ?? 0 };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { const generation = await lookupClient.generations.getGeneration({ id: generationId }); return { providerCost: String(generation.data.totalCost), totalTokens: (generation.data.tokensPrompt ?? 0) + (generation.data.tokensCompletion ?? 0) }; }
    catch (error) { if (attempt === 4) throw error; await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt)); }
  }
  throw new Error("OpenRouter usage was unavailable");
}

async function consumeSse(response: Response, onText: (text: string) => void) {
  if (!response.body) throw new Error("OpenRouter streaming body was unavailable");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "", usage: { costText?: string; totalTokens?: number } | undefined;
  const processEvent = (event: string) => {
    const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    if (!data || data === "[DONE]") return;
    const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }>; usage?: StreamUsage };
    const content = parsed.choices?.[0]?.delta?.content;
    if (content) onText(content);
    if (parsed.usage) {
      const match = /"cost"\s*:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(data);
      usage = { costText: match?.[1], totalTokens: parsed.usage.total_tokens ?? parsed.usage.totalTokens };
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let boundary: number;
    while ((boundary = buffer.search(/\r?\n\r?\n/)) >= 0) { const event = buffer.slice(0, boundary); const delimiter = /^\r\n\r\n/.test(buffer.slice(boundary)) ? 4 : 2; buffer = buffer.slice(boundary + delimiter); processEvent(event); }
    if (done) break;
  }
  if (buffer.trim()) processEvent(buffer);
  return usage;
}

export async function streamBillableCompletion(input: StreamInput) {
  const holdId = randomUUID(), authorization = await affordableBudget(input.workosUserId, input.model, input.messages, input.requestedMaxCompletionTokens);
  await reserveBalance(input.workosUserId, holdId, formatUsd(authorization.budget));
  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", signal: input.signal, headers: { Authorization: `Bearer ${process.env.OPEN_ROUTER_API_KEY ?? ""}`, "Content-Type": "application/json", "HTTP-Referer": "https://modelpass.netlify.app", "X-Title": "Model Pass" }, body: JSON.stringify({ model: input.model, messages: input.messages, stream: true, usage: { include: true }, max_completion_tokens: authorization.maxCompletionTokens, provider: { only: [authorization.endpoint.provider], allow_fallbacks: false, require_parameters: true, max_price: { prompt: formatUsd(parseUsd(authorization.endpoint.promptPerToken) * 1_000_000n), completion: formatUsd(parseUsd(authorization.endpoint.completionPerToken) * 1_000_000n), request: authorization.endpoint.requestCost } } }) });
  } catch (error) { await markAmbiguousUnlinkedHold(input.workosUserId, holdId, input.model); throw error; }
  if (!response.ok) { await releaseHold(input.workosUserId, holdId); throw new Error(`OpenRouter rejected the request with status ${response.status}`); }
  const generationId = response.headers.get("x-generation-id");
  if (!generationId) { await markAmbiguousUnlinkedHold(input.workosUserId, holdId, input.model); throw new Error("OpenRouter accepted a request without a generation ID"); }
  await linkHold(input.workosUserId, holdId, generationId, input.model);
  input.onStart();
  const usage = await consumeSse(response, input.onText);
  const resolved = await resolveUsage(usage, generationId);
  await finalizeUsage({ workosUserId: input.workosUserId, holdId, generationId, providerCost: resolved.providerCost, tokens: resolved.totalTokens, model: input.model });
}

export async function reconcilePendingOpenRouterUsage() {
  const holds = await getPendingUsageHolds();
  const results = await Promise.allSettled(holds.map(async (hold) => {
    try {
      const usage = await resolveUsage(undefined, hold.generationId);
      const result = await finalizeUsage({ ...hold, providerCost: usage.providerCost, tokens: usage.totalTokens, model: hold.model, reconciled: true });
      await auditRecordsCollection().insertOne({ workosUserId: hold.workosUserId, kind: "openrouter_reconciliation", providerId: hold.generationId, idempotencyKey: `openrouter-reconcile:${hold.generationId}`, outcome: result.applied ? "authoritative_usage_replayed" : "already_consistent", retainUntil: new Date(Date.now() + 10 * 365.25 * 24 * 60 * 60 * 1000), createdAt: new Date() });
      return result;
    } catch (error) {
      await auditRecordsCollection().insertOne({ workosUserId: hold.workosUserId, kind: "openrouter_reconciliation", providerId: hold.generationId, idempotencyKey: `openrouter-reconcile-failed:${hold.generationId}`, outcome: "provider_evidence_unavailable", retainUntil: new Date("9999-12-31T23:59:59.000Z"), createdAt: new Date() });
      console.error("ALERT: OpenRouter Hold reconciliation failed", hold.generationId);
      throw error;
    }
  }));
  const failed = results.filter((result) => result.status === "rejected");
  const ambiguous = await billingUsersCollection().findOne({ "usageHolds.generationId": { $exists: false }, "usageHolds.model": { $exists: true } });
  const paused = failed.length > 0 || Boolean(ambiguous);
  await flowControlsCollection().updateOne({ flow: "openrouter_dispatch" }, { $set: { flow: "openrouter_dispatch", paused, reason: failed.length ? "stale_or_unavailable_provider_evidence" : ambiguous ? "dispatched_generation_without_id" : null, updatedAt: new Date() } }, { upsert: true });
  failed.forEach((result) => console.warn("Unable to reconcile OpenRouter usage:", (result as PromiseRejectedResult).reason));
}
