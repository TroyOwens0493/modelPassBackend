# Issue #17 research: OpenRouter settlement and generation-budget facts

**Issue:** [#17 — Verify OpenRouter settlement and generation-budget facts](https://github.com/TroyOwens0493/modelPassBackend/issues/17)<br>
**Parent:** [#14 — planning map](https://github.com/TroyOwens0493/modelPassBackend/issues/14)<br>
**Researched:** 2026-08-23 15:49 AKDT (UTC-08:00)<br>
**Status:** Primary-source provider-contract briefing; no application code implemented<br>
**Decision:** For ordinary OpenRouter-funded inference, ModelPass **Provider Cost** is `usage.cost` in the terminal response and `generation.total_cost` in generation lookup—not `upstream_inference_cost`. Public OpenRouter material is not sufficient by itself to guarantee lossless settlement, recover every dispatched request, or prove a strict per-request dollar cap across the full catalog. Production wallet settlement remains blocked on written OpenRouter answers and captured integration results. The first launch must use a tightly controlled, non-BYOK, plain-text endpoint allowlist with all optional-cost features disabled.

## Executive summary

OpenRouter now documents the most important field distinction clearly: response `usage.cost` is “the total amount charged to your account,” while `cost_details.upstream_inference_cost` is what the upstream AI provider charged. The generation schema describes `total_cost` as the generation's total USD cost and separately describes `upstream_inference_cost` as upstream provider cost. It also says non-BYOK generation lookup generally returns upstream inference cost as `0` or `null` ([Usage Accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting), [generation API](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation)). Therefore:

- **Provider Cost for normal, OpenRouter-funded requests:** terminal `usage.cost`; reconcile against generation `total_cost`.
- **Not Provider Cost:** `upstream_inference_cost`. It is an upstream economics/debug field, is usually unavailable for non-BYOK, and is not ModelPass's OpenRouter account debit.
- **BYOK:** exclude it. OpenRouter deducts its BYOK fee from OpenRouter credits while the upstream provider separately bills the owner of the provider key. One OpenRouter field is therefore not the full external cost of a BYOK request ([BYOK](https://openrouter.ai/docs/guides/overview/auth/byok)).

For plain text chat streams, a deliberate connection abort is documented to stop model processing and billing immediately **only for supported providers**. A cancelled text stream still bills tokens produced before cancellation. Unsupported providers and all non-streaming calls continue processing and bill the complete response. A mid-stream provider error produces partial content followed by `finish_reason: "error"`; zero-completion insurance says an error-finish response has no model prompt/completion/reasoning charge, although auxiliary search, fetch, or parsing work may still be charged ([Streaming cancellation](https://openrouter.ai/docs/api_reference/streaming#stream-cancellation), [streaming errors](https://openrouter.ai/docs/api_reference/errors-and-debugging#streaming-error-formats), [Zero Completion Insurance](https://openrouter.ai/docs/guides/features/zero-completion-insurance)). Those are different outcomes and must not be collapsed into “stream failed, release the reservation.”

Generation recovery has material gaps. OpenRouter returns a generation ID in text response bodies/chunks and documents `X-Generation-Id` on Chat Completions, Completions, Responses, and Messages responses. `GET /api/v1/generation?id=...` can retrieve cost and token metadata after completion and is presented as useful for asynchronous audit ([API overview](https://openrouter.ai/docs/api_reference/overview#querying-cost-and-stats), [Streaming](https://openrouter.ai/docs/api_reference/streaming)). But public sources do **not** state:

- how quickly a record appears;
- whether an early `404` is eventually consistent or final;
- when cost becomes immutable/final;
- how long generation metadata is retained;
- whether every accepted, aborted, disconnected, or errored request gets a lookup record;
- whether `total_cost` can later be corrected; or
- that generation lookup is a settlement ledger authoritative over the actual account debit.

The lookup schema has nullable `cancelled`, `finish_reason`, and `native_finish_reason`, but no lifecycle `status`, `settled_at`, `updated_at`, version, or explicit finality flag ([current OpenAPI](https://openrouter.ai/openapi.json)). A lookup is the best documented per-generation recovery primitive, but treating it as final reconciliation authority is an **engineering inference requiring written confirmation and integration tests**.

OpenRouter also does not publish a settled-cost precision or rounding contract. Model catalog rates are decimal strings, while `usage.cost`, generation `total_cost`, and the installed TypeScript SDK expose JavaScript `number`/OpenAPI `double`. The current catalog contained rates with as many as 22 fractional decimal places, but that is an observation, not a maximum. No reviewed source specifies maximum settled-cost scale, rounding mode, minimum billable increment, lexical representation, or immutability ([Models](https://openrouter.ai/docs/guides/overview/models#pricing-object), [OpenAPI](https://openrouter.ai/openapi.json)). ModelPass cannot safely design an exact USD ledger around binary floating point or a guessed six-decimal scale.

Finally, `max_tokens`/`max_completion_tokens` cap generated tokens, not dollars; context and endpoint fields describe token capacities; and `provider.max_price` filters endpoint **rates**, not total spend. It does not cover every catalog component. OpenRouter has no documented preflight prompt-token counting endpoint: `/models/count` counts models, and `architecture.tokenizer` is only a tokenizer-family label. Native token counts arrive post hoc in `usage` ([Parameters](https://openrouter.ai/docs/api_reference/parameters#max-completion-tokens), [Models](https://openrouter.ai/docs/guides/overview/models), [Provider max price](https://openrouter.ai/docs/guides/routing/provider-selection#max-price)).

A conservative formula exists for a restricted token-only endpoint, but the public contract does not establish all of its premises across a mutable, routed catalog. Optional media, server tools, plugins, nested model calls, caching surcharges, pricing overrides, BYOK, dynamic routers, unbounded fetch/search behavior, and endpoints billed by characters, seconds, images, megapixels, or provider-specific SKUs must be excluded until each is separately bounded.

## 1. Scope, terms, and evidence standard

“Customer,” “Balance,” “Deposit,” “Provider Cost,” and “Usage Charge” retain the meanings in `CONTEXT.md`. In particular, a Usage Charge is Provider Cost plus exactly 5%; a catalog estimate is not Provider Cost.

This report covers current OpenRouter chat/completion behavior and identifies other endpoint/features that a general wallet could accidentally admit. It does not treat OpenRouter's own prepaid-credit purchase fee as inference Provider Cost. It does not implement a wallet.

### Evidence labels

- **Documented guarantee** — stated in current OpenRouter-owned documentation or API reference.
- **Observed current behavior/schema** — observed on 2026-08-23 in OpenRouter's live API, current OpenAPI, OpenRouter-maintained source, or this repository's installed SDK. It is not promoted into a future promise.
- **Engineering inference** — a ModelPass design conclusion from documented primitives; OpenRouter has not promised it.
- **Unknown — confirmation/testing required** — public primary sources are absent or insufficient. Written OpenRouter confirmation or a provider integration test is required as specified.

External evidence is limited to OpenRouter-owned documentation/API/OpenAPI, OpenRouter-maintained SDK/source, and first-party API responses. Repository claims cite local paths. No authenticated OpenRouter key was available during research, so no paid generation or authenticated generation lookup was performed; live observations below are limited to public Models and endpoint responses.

## 2. Repository baseline

### 2.1 Current implementation

**Observed current repository behavior.**

- `package.json:27` pins `@openrouter/sdk` exactly to `0.13.50`; `pnpm why @openrouter/sdk` resolves that one direct version. The npm registry's current release was 1.2.54 during research ([first-party registry metadata](https://registry.npmjs.org/@openrouter/sdk/latest)), so the installed generated schema must not be assumed to match current docs indefinitely.
- `src/billing/openRouterUsage.ts:25-32` configures an output limit (default 1,024, minimum 16) and a price “safety factor” (default 2).
- `src/billing/openRouterUsage.ts:66-103` fetches one model-level price record, parses decimal strings into binary JavaScript numbers, and reserves from `UTF-8 byte length + 32 per message + 100`, multiplied by prompt/completion/request rates and the safety factor. Bytes are not a documented tokenizer upper bound. The calculation ignores routed endpoint differences, pricing overrides, cache prices, reasoning, audio/images, web/tool/plugin fees, and nested calls.
- `src/billing/openRouterUsage.ts:167-174` sends a streaming request with deprecated `maxTokens`; it does not set `provider.requireParameters`, `provider.maxPrice`, a provider allowlist, or disable fallbacks/optional features.
- `src/billing/openRouterUsage.ts:181-191` learns the generation ID from the first parsed body chunk. OpenRouter documents `X-Generation-Id` on the response headers, but the installed high-level `Chat.send` success type returns only the stream and does not expose successful response headers (`node_modules/.pnpm/@openrouter+sdk@0.13.50/node_modules/@openrouter/sdk/esm/sdk/chat.d.ts`). A disconnect after dispatch but before the first parsed chunk can therefore leave a potentially billed request unlinked.
- `src/billing/openRouterUsage.ts:111-143` accepts streamed `usage.cost` immediately or retries generation lookup only three times after 250/500/750 ms, retrying every error indiscriminately. OpenRouter publishes no lookup-availability SLA that validates this schedule.
- `src/billing/creditLedger.ts:175-192` releases any reservation still lacking a generation ID after 15 minutes. That is unsafe for an ambiguously dispatched request because no public list-by-local-request-ID recovery API exists.
- `src/server.ts:15-18` runs pending reconciliation at startup and every minute. Linked requests remain reserved after stream failure, but an unresolved lookup remains pending indefinitely with only a warning.
- `src/billing/creditLedger.ts:73-84,265-300` converts cost to whole “credits,” rounds upward to the configured dollars-per-credit, then caps the actual debit at the amount reserved. It neither models a USD Balance nor applies the required exact 5% Usage Charge. If final Provider Cost exceeds the reservation, the excess is silently absorbed rather than making the bound failure visible.
- `src/billing/types.ts:23-50` stores Balance-like values and `costUsd` as JavaScript `number`.
- `src/models/catalog.ts:1-73` exposes every valid text-output model based only on model-level prompt/completion pricing and a relative price tier. It does not enforce an endpoint/feature allowlist suitable for strict budgeting.

### 2.2 Existing tests

**Observed current tests.** `unit-tests/openRouterUsage.spec.ts:60-163` mocks a normal final usage chunk, rejection before any generation ID, and interruption after a body ID. It does not exercise real OpenRouter, response-header ID capture, cancellation, provider disconnect, mid-stream error chunks, early lookup `404`, lookup finality, unsupported cancellation, auxiliary fees, routing price variance, decimal precision, settled-cost mismatch, or an estimate below final cost. There is no generation-reconciliation integration suite.

## 3. Which field is ModelPass Provider Cost?

### 3.1 Normal OpenRouter-funded requests

**Documented guarantee.** OpenRouter's usage guide defines:

- `usage.cost`: “The total amount charged to your account”; and
- `cost_details.upstream_inference_cost`: “The actual cost charged by the upstream AI provider”

([Usage Accounting — Cost Breakdown](https://openrouter.ai/docs/cookbook/administration/usage-accounting#cost-breakdown)). OpenRouter's FAQ says it receives provider token totals, calculates the corresponding request cost, and deducts it from OpenRouter credits ([FAQ — billing](https://openrouter.ai/docs/faq#how-do-i-get-billed-for-my-usage-on-openrouter)).

The generation API independently describes:

- `total_cost`: total cost of the generation in USD;
- `usage`: usage amount in USD; and
- `upstream_inference_cost`: cost charged by the upstream provider

([generation API schema](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation), [OpenAPI](https://openrouter.ai/openapi.json)). Its example gives `total_cost === usage` while upstream cost differs, but equality in one example is not a separately stated invariant.

**Decision.**

```text
normal response Provider Cost candidate = response.usage.cost
reconciliation Provider Cost candidate = generation.total_cost
never Provider Cost                    = upstream_inference_cost
```

`generation.usage` appears to be a legacy/alias amount in the current schema, but ModelPass should not choose it while `total_cost` has the explicit generation-total description. Require `generation.usage === generation.total_cost` in integration observations and ask OpenRouter whether that equality is guaranteed.

### 3.2 BYOK and external tool accounts

**Documented guarantee.** For BYOK, OpenRouter deducts an OpenRouter platform fee while use of the provider key gives direct control of costs through the provider account ([BYOK](https://openrouter.ai/docs/guides/overview/auth/byok)). The usage guide says generation `upstream_inference_cost` is only available for BYOK and otherwise is `0` or `null` ([Usage Accounting — Generation ID](https://openrouter.ai/docs/cookbook/administration/usage-accounting#alternative-getting-usage-via-generation-id)). Firecrawl-backed search/fetch can similarly bill the separate Firecrawl account with no OpenRouter charge ([web-search pricing](https://openrouter.ai/docs/guides/features/server-tools/web-search#pricing), [web-fetch pricing](https://openrouter.ai/docs/guides/features/server-tools/web-fetch#pricing)).

**Engineering inference.** Exclude BYOK and externally billed plugin/tool credentials from the ModelPass launch. Otherwise “Provider Cost” becomes the sum of multiple provider invoices rather than the amount OpenRouter charges ModelPass, contradicting the current context and making one-generation settlement incomplete.

## 4. Streaming and terminal-outcome semantics

OpenRouter uses “cancel,” “abort the connection,” “provider disconnect,” and error finish reasons; it does not publish a single exhaustive state machine covering every application word below. The wallet must map only documented outcomes.

| Application outcome | What OpenRouter documents | Billing consequence | Classification |
|---|---|---|---|
| **Completed text stream** | Usage is in the final SSE chunk before `[DONE]`; usage details are automatically included ([API response schema](https://openrouter.ai/docs/api_reference/overview#completionsresponse-format), [Usage Accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting)). | `usage.cost` is the account charge candidate. | Documented guarantee. |
| **Customer abort/cancel on a supported text provider** | Aborting the streaming connection immediately stops model processing and billing for the listed supported providers ([Stream cancellation](https://openrouter.ai/docs/api_reference/streaming#stream-cancellation)). | Tokens produced before cancellation remain billable; the image guide states this text-chat contrast explicitly ([Image billing and cancellation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation#billing-and-cancellation)). | Documented guarantee, but no detection-latency or exact provider-version SLA. |
| **Customer abort/cancel on an unsupported provider** | Cancellation is not supported; the model continues processing and ModelPass is billed for the complete response ([Streaming warning](https://openrouter.ai/docs/api_reference/streaming#stream-cancellation)). | Full completed response may be billed even though the Customer received only a prefix. | Documented guarantee. |
| **Non-streaming cancellation/disconnect** | Cancellation only works for streaming requests; non-streaming continues and bills the complete response ([Streaming warning](https://openrouter.ai/docs/api_reference/streaming#stream-cancellation)). | Full response billable. | Documented guarantee. |
| **Network/client disconnect** | Cancellation is implemented by aborting the connection. | Treat an observed closed connection as a cancellation attempt, not proof billing stopped. Whether OpenRouter detected it, which provider was selected, and when processing stopped must come from generation settlement. | Engineering inference; edge timing unknown. |
| **Upstream provider disconnect/timeout after partial text** | OpenRouter emits an in-band SSE error with partial content already delivered, `finish_reason: "error"`, and cannot fail over after the first token ([Streaming errors](https://openrouter.ai/docs/api_reference/errors-and-debugging#streaming-error-formats)). | Zero-completion insurance says error-finish responses do not charge model prompt/completion/reasoning tokens; already-run auxiliary services can still be billed ([Zero Completion Insurance](https://openrouter.ai/docs/guides/features/zero-completion-insurance#what-is-covered)). | Documented guarantee. Verify the resulting nonzero/zero `usage.cost` combinations. |
| **Error before first token** | OpenRouter can return an HTTP error or transparently try another provider before content is committed ([Pre-stream errors](https://openrouter.ai/docs/api_reference/errors-and-debugging#pre-stream-errors)). | An HTTP failure is not enough to infer zero auxiliary/account charge. Zero-completion insurance covers model inference under its stated conditions, not already-run auxiliaries. | Documented in part; settle from provider cost record. |
| **Application interruption** | Not an OpenRouter lifecycle term. It may mean local exception, lost downstream Customer socket, lost OpenRouter socket, explicit abort, process death, or upstream error. | Never release solely because ModelPass saw an exception. Preserve the reservation and reconcile if dispatch may have occurred. | Engineering inference. |
| **Image generation** | Dedicated Image API billing is all-or-nothing: complete and fully billed, or failed/cancelled/early-terminated stream and not billed; partial previews are not billable ([Image billing](https://openrouter.ai/docs/guides/overview/multimodal/image-generation#billing-and-cancellation)). | Do not import text partial-token rules into images. | Documented guarantee. |
| **TTS streaming** | Invalid/truncated output is not billed, but once format-valid audio is delivered, character-priced TTS bills the full input even if the client cancels after partial audio ([Zero Completion Insurance](https://openrouter.ai/docs/guides/features/zero-completion-insurance#what-is-covered)). | No token-prefix formula applies. | Documented guarantee. |

### Consequences for the wallet vocabulary

**Engineering inference.** Product terms must disclose that a Customer can incur a Usage Charge for a cancelled or disconnected request whenever OpenRouter records Provider Cost. “Completed request” in `CONTEXT.md` should be specified operationally as **a provider-terminal, settled generation**, not “the Customer received the entire intended answer.” Otherwise the canonical Provider Cost definition conflicts with documented partial-stream billing.

A local `AbortError`, missing `[DONE]`, closed browser socket, `finish_reason`, or `cancelled` flag is evidence about outcome—not the monetary amount. Monetary settlement remains the OpenRouter account-charge field.

## 5. Generation IDs and lookup

### 5.1 Acquiring the ID

**Documented guarantee.** The response body/chunks contain `id`, and OpenRouter says `X-Generation-Id` is returned in response headers for all chat completions, completions, Responses, and Messages endpoints ([Streaming — Additional information](https://openrouter.ai/docs/api_reference/streaming#additional-information)). STT and TTS also document the header ([STT response headers](https://openrouter.ai/docs/guides/overview/multimodal/stt#response-headers), [TTS response headers](https://openrouter.ai/docs/guides/overview/multimodal/tts#response-format)).

**Engineering requirement.** Persist the header ID as soon as response headers arrive, before consuming body bytes or notifying the Customer. Confirm every subsequent body ID matches it. The current installed high-level SDK does not expose successful response headers, so SDK/header access must be proven before implementation; “wait for first chunk” is insufficient.

**Unknown.** Public docs do not say whether a generation ID is present on every non-2xx response, whether it is assigned before provider dispatch, or whether an HTTP/network failure before headers can still represent a billed dispatch. The Anthropic error-envelope documentation says some post-router errors carry a `gen-` request ID, but that is not a complete cross-endpoint recovery contract ([Anthropic error format](https://openrouter.ai/docs/api_reference/errors-and-debugging#anthropic-messages-apiv1messages)). There is no documented client-supplied idempotency key for chat inference and no list-generations-by-local-correlation endpoint in the current OpenAPI ([OpenAPI paths](https://openrouter.ai/openapi.json)). An ambiguous dispatch with no ID is therefore not publicly recoverable per request.

### 5.2 Lookup availability and shape

**Documented guarantee.** After a request is complete, its returned ID can query `/api/v1/generation` for token counts and cost; OpenRouter describes this as useful for asynchronous stats and auditing historical usage ([API overview](https://openrouter.ai/docs/api_reference/overview#querying-cost-and-stats), [Usage Accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting#alternative-getting-usage-via-generation-id)).

The current generation record includes, among other fields:

- `id`, `request_id`, model, provider, router, service tier, API type, and BYOK status;
- `streamed`, nullable `cancelled`, nullable normalized/native finish reasons;
- prompt/completion/reasoning/cache/media/search/fetch counters;
- `total_cost`, `usage`, nullable `upstream_inference_cost`, and cache discount; and
- provider responses/fallback attempts

([generation API](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation), [OpenAPI](https://openrouter.ai/openapi.json)).

**Observed current schema.** The installed 0.13.50 SDK maps those cost fields to `number`, cancellation to `boolean | null`, finish reasons to `string | null`, and `totalCost` to required `number` (`node_modules/.pnpm/@openrouter+sdk@0.13.50/node_modules/@openrouter/sdk/esm/models/generationresponse.d.ts:36-204`; [OpenRouter-maintained 0.13.50 source](https://github.com/OpenRouterTeam/typescript-sdk/blob/v0.13.50/src/models/generationresponse.ts)). It has no generation status or finality timestamp. Because no authenticated key was available, early-lookup behavior was not observed in this research.

The API reference lists `401`, `402`, `404`, `429`, `500`, `502`, `524`, and `529` responses ([generation API](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation)). A retry policy must distinguish authentication/payment/permanent not-found from transient rate/provider/infrastructure errors; the repository currently retries all three attempts alike.

### 5.3 What is not guaranteed

**Unknown — written confirmation and testing required.** No reviewed OpenRouter source promises:

1. record creation for every dispatched request and every abort/error path;
2. lookup visibility latency or a maximum eventual-consistency delay;
3. whether `404` for a newly returned ID is retryable and for how long;
4. a terminal-status predicate using `cancelled` and `finish_reason`;
5. when `total_cost` is final, whether it can change, or a correction process;
6. retention duration for generation metadata;
7. lookup rate limits or recommended polling cadence beyond generic `429` behavior;
8. equality of response `usage.cost`, generation `total_cost`, and generation `usage`;
9. whether account-credit debit is transactionally committed before/with/after lookup publication; or
10. an itemized account ledger/list API capable of finding a generation whose ID ModelPass failed to capture.

**Decision.** Generation lookup is the best documented reconciliation candidate, but public docs establish it as an audit/statistics endpoint—not an explicitly final, immutable billing ledger. ModelPass may not release or post a Usage Charge from a guessed timeout. Written confirmation must define the authoritative field and terminal/finality rule.

## 6. Numeric wire representation, precision, rounding, and finality

### 6.1 Documented schema

**Documented/observed schema.** Catalog pricing fields are decimal strings in USD per token/request/unit. Current schema fields include prompt, completion, request, image, image output/token, audio input/output/cache, cache read/write/one-hour write, internal reasoning, web search, discount, and conditional overrides ([Models pricing](https://openrouter.ai/docs/guides/overview/models#pricing-object), [OpenAPI `PublicPricing`](https://openrouter.ai/openapi.json)). OpenRouter's provider-integration guide says provider `cost_usd` values are strings specifically to avoid floating-point precision issues ([Provider Integration](https://openrouter.ai/docs/guides/community/for-providers#model-pricing)).

Settled costs are different: response `usage.cost`, generation `total_cost`/`usage`, and upstream cost are JSON numbers with OpenAPI `format: double`; the official TypeScript SDK exposes JavaScript `number` ([OpenAPI](https://openrouter.ai/openapi.json), [TypeScript generation type](https://openrouter.ai/docs/agent-sdk/typescript/api-reference/models/generationresponsedata)). No decimal string alternative is documented.

### 6.2 Current catalog observations, not promises

The public, unauthenticated `GET /api/v1/models?output_modalities=all` returned 559 models on 2026-08-23 ([live Models API](https://openrouter.ai/api/v1/models?output_modalities=all)). In that response:

- every observed price value was a JSON string;
- observed base keys were `prompt`, `completion`, `audio`, `audio_output`, `image`, `image_output`, `image_token`, `input_audio_cache`, `input_cache_read`, `input_cache_write`, `input_cache_write_1h`, `internal_reasoning`, and `web_search`;
- 59 models had conditional `overrides`;
- the longest observed base fractional representation was 22 places (`0.0000000833333333333333`, cache write);
- `image_output`/`image_token` examples reached 20 fractional places;
- no model in this particular response carried `request`, despite the public schema and FAQ supporting per-request pricing; and
- dynamic router records such as `openrouter/auto` and `openrouter/fusion` used `-1` prompt/completion sentinels, whose meaning is not defined by the Models pricing documentation.

These counts can change continuously. OpenRouter's `v1` API evolves continuously, and non-breaking fields/variants can be added without prior notice ([API Versioning](https://openrouter.ai/docs/api_reference/versioning#how-the-api-evolves)).

### 6.3 Missing monetary contract

**Unknown — written confirmation required.** Public sources do not state:

- maximum decimal places/significant digits for a settled cost;
- whether settled cost is rounded per token component, per provider attempt, or only on total;
- rounding mode;
- minimum billable unit;
- whether scientific notation can be emitted;
- whether a zero, negative, or subnormal settled value is possible;
- whether binary-double round-trip is considered exact account settlement;
- whether `total_cost` includes every auxiliary charge; or
- whether a posted value is immutable.

**Wallet requirement.** Capture the raw response/lookup payload and parse monetary JSON tokens with a lossless arbitrary-precision decimal parser before arithmetic. Never derive Provider Cost by multiplying catalog rates when a settled account-charge field exists. Never store Provider Cost, Balance, Deposit, or Usage Charge solely as JavaScript/MongoDB binary double. The exact 5% multiplication must occur in decimal arithmetic; display rounding must be separate from ledger value. The final storage scale and any rounding policy are blocked until OpenRouter supplies a maximum settled precision or ModelPass adopts a conservative arbitrary-scale representation.

## 7. Pricing components and routing variance

### 7.1 Model and endpoint fields

The Models API says model-level `pricing` is from the **top provider**, while the endpoint API returns each provider endpoint's pricing, context, max completion/prompt tokens, supported parameters, and status ([Models schema](https://openrouter.ai/docs/guides/overview/models#model-object-schema), [endpoint API](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model)). Default routing load-balances among stable low-cost providers and can fall back; provider endpoints can have different prices ([Provider routing](https://openrouter.ai/docs/guides/routing/provider-selection#price-based-load-balancing-default-strategy)). Therefore model-level pricing is not a bound on the selected endpoint.

**Observed current endpoint response, not a promise.** On 2026-08-23, the public [`openai/gpt-4o-mini` endpoint response](https://openrouter.ai/api/v1/models/openai/gpt-4o-mini/endpoints) included OpenAI/Azure endpoints at `$0.00000015` prompt and `$0.0000006` completion per token and a separate Azure region at `$0.000000165`/`$0.00000066`; the former endpoints also differed on whether `max_tokens` or `max_completion_tokens` appeared in `supported_parameters`. This is direct evidence that the route can change both effective rates and usable controls even for one model ID.

| Cost component | Public field/behavior | Budget implication |
|---|---|---|
| Text prompt/input | `pricing.prompt`, USD per input token | Include endpoint rate and all applicable override windows/thresholds. |
| Text completion/output | `pricing.completion`, USD per output token | Include visible output plus reasoning when reasoning uses output-token billing. |
| Fixed request charge | optional `pricing.request`, USD per request; FAQ confirms some models charge per request ([FAQ](https://openrouter.ai/docs/faq#how-do-i-get-billed-for-my-usage-on-openrouter)) | Add even for small token counts; establish whether retries/fallback attempts incur more than one. |
| Input images | `pricing.image` per image and `pricing.image_token` per image token | Exclude multimodal input unless count/size/tokenization is bounded. |
| Output images | `pricing.image_output`; dedicated Image API exposes per-image/megapixel/token billable lines and variants ([Image endpoint discovery](https://openrouter.ai/docs/guides/overview/multimodal/image-generation#endpoint-discovery)) | Exclude until `n`, resolution, variants, and selected endpoint are bounded. Dedicated image cancellation is all-or-nothing, not token-partial. |
| Audio | `audio`, `audio_output`, `input_audio_cache`; STT may be duration- or token-priced and TTS is character-priced ([STT pricing](https://openrouter.ai/docs/guides/overview/multimodal/stt#pricing), [TTS pricing](https://openrouter.ai/docs/guides/overview/multimodal/tts#pricing)) | Token formula does not cover seconds or characters. Exclude. |
| Reasoning | `internal_reasoning` exists for separately priced internal reasoning; otherwise reasoning tokens are treated as output and charged accordingly ([Reasoning billing](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens#provider-specific-reasoning-implementation)) | Use the endpoint's actual rule. Do not assume visible text tokens equal billable output. Exclude separate internal-reasoning endpoints until semantics are confirmed. |
| Prompt cache read | `input_cache_read`; cached tokens are reported post hoc | Usually discounted but still a distinct component; response caching is different and can be free. |
| Prompt cache write | `input_cache_write` and `input_cache_write_1h`; some providers charge cache writes above base input rate, and some automatic caching needs no opt-in ([Prompt caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching)) | A prompt-rate cap alone may not cap writes. Disable/exclude or include worst TTL-specific write rate. |
| Response cache | Current response-cache hits are free with billable counters zero; only the miss is billed ([Response caching](https://openrouter.ai/docs/guides/features/response-caching#billing)) | Useful observation, not a reason to reserve zero before hit/miss is known. |
| Web search | `pricing.web_search` and engine/provider-specific per-search/per-result fees; server tool can execute 0-to-N searches ([Web Search pricing](https://openrouter.ai/docs/guides/features/server-tools/web-search#pricing)) | Exclude unless engine, max searches, total results, native behavior, and all fees are hard bounded. `provider.max_price` has no web-search field. |
| Web fetch | Exa/Parallel charge per fetch; some engines have no hard request limit; fetched text also adds model tokens ([Web Fetch](https://openrouter.ai/docs/guides/features/server-tools/web-fetch#pricing)) | Exclude. `max_content_tokens` limits returned context, not necessarily fetch count/fee. |
| PDF/file parsing | Mistral OCR is charged per page even for BYOK; native parsing is input-token priced; Cloudflare option is currently free ([PDF pricing](https://openrouter.ai/docs/guides/overview/multimodal/pdfs#pricing)) | Exclude file/PDF inputs unless pages, engine, image extraction, and downstream token cost are bounded. |
| Image-generation server tool | Underlying image-model cost is added to outer LLM token cost ([Image tool pricing](https://openrouter.ai/docs/guides/features/server-tools/image-generation#pricing)) | Exclude nested generation. |
| Advisor/subagent/fusion | These tools make one or multiple inner model calls; subagent costs fold into the request's usage and Fusion can run up to eight panel models plus an analyst with search/fetch ([Subagent](https://openrouter.ai/docs/guides/features/server-tools/subagent), [Fusion](https://openrouter.ai/docs/guides/features/server-tools/fusion)) | Outer `max_completion_tokens` is not a whole-workflow cost cap. Exclude all nested model tools/routers/plugins. |
| No-separate-charge tools | Apply Patch, Datetime, Files, and Search Models currently say no extra tool charge beyond standard token usage ([Apply Patch](https://openrouter.ai/docs/guides/features/server-tools/apply-patch#pricing), [Datetime](https://openrouter.ai/docs/guides/features/server-tools/datetime#pricing), [Files](https://openrouter.ai/docs/guides/features/server-tools/files#pricing), [Search Models](https://openrouter.ai/docs/guides/features/server-tools/search-models#pricing)) | Still increases prompt/output/tool-loop tokens. “Currently” is not a permanent price promise. |
| Other beta/plugin behavior | Shell, response healing, context compression, moderation, presets, and future server tools can transform requests or add work; beta tools may change ([Server Tools](https://openrouter.ai/docs/guides/features/server-tools)) | Exclude unless an explicit current price and hard quantity bound are captured. Silence is not zero. |
| Video | Dedicated async API exposes provider SKU pricing and a final usage cost ([Video generation](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)) | Different asynchronous lifecycle; exclude from chat-wallet formula. |

### 7.2 Conditional/tiered pricing

**Documented guarantee.** `pricing.overrides` can change rates above prompt-token thresholds or during UTC windows. All conditions on an entry must match; later matching entries win per key; absent keys inherit base pricing. Top-level rates represent default/current conditions, not every possible condition ([Models — Pricing Overrides](https://openrouter.ai/docs/guides/overview/models#pricing-overrides)). Endpoint `discount` multiplies prices by `1 - discount` ([OpenAPI](https://openrouter.ai/openapi.json)). Service-tier billing follows the endpoint actually used and can differ when routing falls back ([Service Tiers](https://openrouter.ai/docs/guides/features/service-tiers)).

**Engineering inference.** A strict bound uses the maximum applicable rate across every override and permitted service tier, never only the top-level current price and never a discount that can disappear. Dynamic routers with `-1` catalog prices cannot be admitted to preflight.

### 7.3 Provider routing and failed attempts

OpenRouter defaults to load balancing and fallback; `order`, `only`, `allow_fallbacks`, sorting, privacy, parameter support, and service tier change eligible endpoints ([Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection)). Before the first token, fallback can transparently attempt another endpoint; after the first token, it cannot ([Errors](https://openrouter.ai/docs/api_reference/errors-and-debugging#streaming-error-formats)).

**Unknown.** Public docs do not explicitly guarantee whether fixed request fees, search/parser work, or other non-token components from failed pre-token provider attempts are excluded from the final account charge. Zero-completion insurance covers model inference under its conditions, but explicitly permits already-executed auxiliary charges. Strict launch routing should set `allow_fallbacks: false` and use one approved provider path until this is tested and confirmed.

## 8. Token, context, output, and price controls

### 8.1 `max_tokens` and `max_completion_tokens`

**Documented guarantee.** Both parameters set an upper limit on generated tokens; the model will not produce more, and the maximum allowed is context length minus prompt length. `max_tokens` is deprecated in the current SDK/OpenAPI in favor of `max_completion_tokens`; some providers enforce a minimum of 16 ([Parameters](https://openrouter.ai/docs/api_reference/parameters#max-tokens), [OpenAPI](https://openrouter.ai/openapi.json)). Reasoning tokens are billable output tokens, and tool-specific docs describe max completion as including reasoning ([Reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [Fusion parameters](https://openrouter.ai/docs/guides/features/server-tools/fusion#parameters)).

**Caveat.** Unsupported parameters can be ignored by default. `provider.require_parameters: true` filters to providers supporting supplied parameters; endpoint `supported_parameters` is the exact discovery surface ([Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection#requiring-providers-to-support-all-parameters)). ModelPass must use `max_completion_tokens`, require support, and reject any endpoint where the bound is not honored in integration tests.

### 8.2 Context and endpoint maximums

- Model `context_length` is the model's maximum context window.
- Model `top_provider.max_completion_tokens` is only the top provider's maximum.
- Endpoint records expose provider-specific `context_length`, `max_prompt_tokens`, and nullable `max_completion_tokens` ([Models schema](https://openrouter.ai/docs/guides/overview/models#top-provider-object), [endpoint API](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model)).

**Engineering inference.** `top_provider.max_completion_tokens` is not a routing-wide cap. A preflight calculation must enumerate every eligible endpoint and use each endpoint's limits, then take the maximum possible charge. Null means absent/unknown, not unlimited or zero; OpenRouter's versioning guide explicitly says not to substitute defaults for null ([API Versioning](https://openrouter.ai/docs/api_reference/versioning#nullable-response-fields)).

### 8.3 Tokenizer and count endpoint

**Documented guarantee.** Final token counts use the selected model/provider's native tokenizer, and billing is based on those native counts ([API overview](https://openrouter.ai/docs/api_reference/overview#querying-cost-and-stats), [Models](https://openrouter.ai/docs/guides/overview/models#supported-parameters)). Different tokenizers produce different costs for the same content.

**Observed current schema.** `architecture.tokenizer` is a tokenizer-family/name field. The current OpenAPI and SDK have `/models/count`, but it returns the number of available models; it is not a text-token counter ([Models docs](https://openrouter.ai/docs/guides/overview/models#output-modalities), [OpenAPI](https://openrouter.ai/openapi.json)). No reviewed public endpoint accepts the prospective messages and returns the authoritative billed prompt-token count before inference.

**Decision.** UTF-8 bytes, character counts, local generic tokenizers, and model-family labels are estimates only. They may be useful after endpoint-specific validation but cannot be called an OpenRouter-guaranteed preflight count.

### 8.4 `provider.max_price`

**Documented guarantee.** `provider.max_price` filters out endpoints above accepted rates and can prevent a request from running. Public fields cap prompt/completion prices per million tokens and request/image prices; the current SDK/OpenAPI also exposes audio ([Provider max price](https://openrouter.ai/docs/guides/routing/provider-selection#max-price), [OpenAPI](https://openrouter.ai/openapi.json)).

It is **not a total-cost cap** because:

- it caps unit rates, not token/image/request quantities;
- it has no fields for web search, web fetch, PDF OCR, cache reads/writes, internal reasoning, output image, output audio, nested models, or general plugin/tool fees;
- it does not give an authoritative prompt count; and
- catalog/feature semantics can vary by endpoint.

Workspace/key/guardrail budgets are also not strict per-request caps. OpenRouter says budget checks happen before routing, in-flight requests complete, and actual spend may exceed the configured budget ([Workspace Budgets](https://openrouter.ai/docs/guides/features/workspaces/workspace-budgets#spend-tracking)). They cannot enforce one Customer's Balance reservation.

## 9. Strict-budget analysis

### 9.1 Conditional token-only formula

For one eligible, ordinary OpenRouter-funded, text-only endpoint `e`, define exact decimal values:

- `C_e`: endpoint context length;
- `M`: ModelPass-requested `max_completion_tokens`;
- `O_e = min(M, endpoint.max_completion_tokens, C_e)` (an absent endpoint max requires confirmation/test, not substitution);
- `P_e`: worst permitted USD prompt-token rate across all pricing overrides/tiers;
- `Q_e`: worst permitted USD completion-token rate across all pricing overrides/tiers; and
- `R_e`: worst permitted fixed request fee.

If the only billable dimensions are one prompt-token charge, one completion-token charge, and one fixed request fee, and successful request tokens satisfy `i + o <= C_e` and `o <= O_e`, then a prompt-count-independent upper bound is:

```text
EndpointProviderCostUpper(e)
  = R_e + max(i·P_e + o·Q_e)
      subject to i >= 0, o >= 0, i + o <= C_e, o <= O_e

  = R_e + C_e·P_e + O_e·max(Q_e - P_e, 0)
```

Across routing candidates:

```text
ProviderCostHold = max_e EndpointProviderCostUpper(e)
UsageChargeHold  = ProviderCostHold × 1.05
```

If an authoritative preflight prompt count `I_e` becomes available, the tighter endpoint formula is:

```text
R_e + I_e·P_e + min(O_e, C_e - I_e)·Q_e
```

All arithmetic must be exact decimal and must round **up**, if any finite storage quantization is unavoidable. Final Usage Charge remains actual settled Provider Cost × 1.05, not the hold estimate.

### 9.2 Necessary restrictions

The formula is defensible only if all of these premises are enforced:

1. non-BYOK, one plain text chat generation;
2. no model routers, model fallback list, provider fallback, presets, nested model tools, or service tier that changes price beyond the enumerated set;
3. no images, audio, video, files/PDFs, response/image generation, STT/TTS, embeddings, rerank, or other non-token units;
4. no web search/fetch, externally billed credentials, or other auxiliary services;
5. no separate internal-reasoning rate and no cache-write/read charge beyond the chosen `P_e`, unless separately included and bounded;
6. all pricing overrides and fixed request charges known and nonnegative;
7. endpoint supports and honors `max_completion_tokens`, enforced with `require_parameters: true`;
8. context accounting includes every transformed message/tool definition and generated reasoning token;
9. `provider.max_price` is set for every field it can enforce and all eligible endpoints are in the allowlist;
10. no catalog sentinel (`-1`), null limit, missing cost component, beta pricing, or unknown unit; and
11. the catalog/routing snapshot and max-price filter cannot race to a more expensive unbounded component before dispatch.

### 9.3 Why this is not yet a production guarantee

**Unknown/decision.** Public material does not establish a transactional “quote then execute at no more than quote” API. `max_price` helps enforce several unit rates but not every relevant dimension. It also does not provide settled-cost precision/finality or recovery for a dispatched request with no captured generation ID. Consequently:

- there is **no defensible universal strict upper bound** for every model/endpoint/feature currently exposed by `src/models/catalog.ts`;
- the conditional formula can be used only for an allowlisted token-only product after provider confirmation and adversarial integration testing; and
- if ModelPass cannot establish those premises, it must reject the request rather than apply an arbitrary safety factor.

OpenRouter's documented account/workspace budgets may overrun due to in-flight requests, so they are defense in depth, not the Customer Balance invariant ([Workspace Budgets](https://openrouter.ai/docs/guides/features/workspaces/workspace-budgets#spend-tracking)).

## 10. Explicit unknowns

The following are not answered by reviewed public primary sources:

1. Generation lookup publication SLA, eventual-consistency semantics, and retention.
2. A documented terminal/final predicate and whether `total_cost` is immutable.
3. Correction/refund behavior when OpenRouter later changes a generation charge.
4. Guaranteed equality among response `usage.cost`, generation `total_cost`, generation `usage`, account-credit debit, and Activity UI.
5. Maximum cost precision, rounding, and minimum debit increment.
6. Complete billing of failed fallback attempts and fixed/auxiliary fees.
7. Guaranteed generation-ID availability for every dispatched/error/abort path and a recovery API when the ID is lost.
8. Exact cancellation detection latency and whether the published supported-provider list is contractual/current per endpoint.
9. Meaning of nullable `cancelled` and combinations with `finish_reason`; no chat generation status enum exists.
10. Whether prompt cache read/write and `internal_reasoning` are mutually exclusive replacements for base rates or additive in every provider case.
11. Whether `provider.max_price.prompt/completion/request` is evaluated against conditional overrides, cache/internal-reasoning rates, discounts, and selected service tier exactly as needed for a strict bound.
12. Whether fixed request price is charged once per OpenRouter request or once per upstream attempt.
13. A first-party preflight tokenizer/count API matching final native billing.
14. Price/quantity contract for beta tools with no explicit pricing section, including hosted shell, and for future additive tools/plugins.
15. A supported sandbox; OpenRouter production inference APIs do not document a billing sandbox equivalent to Polar's.

## 11. Concrete wallet-spec requirements

### Identity and dispatch

- Create a durable request intent and Customer Balance hold before dispatch.
- Persist Customer ID, local request ID, exact model/permaslug, requested endpoint/provider constraints, feature flags, `max_completion_tokens`, exact rate caps, catalog version/fetch time, and hold formula inputs.
- Capture and durably link `X-Generation-Id` at headers time; verify all body chunk IDs match. A request must not be considered safely unlinked merely because no body chunk arrived.
- Treat “dispatch outcome unknown and no generation ID” as an operational incident. Do not release automatically after 15 minutes. Stop new spending if necessary until account reconciliation/provider support resolves it.
- Do not automatically retry an ambiguous inference POST. OpenRouter does not document chat inference idempotency; retry can create another billable generation.

### Reservation and eligibility

- Replace the broad catalog with a versioned wallet allowlist of tested model **endpoints**, not merely model IDs.
- Initial allowlist: ordinary OpenRouter-funded, text-only, no BYOK, no dynamic router, no model/provider fallbacks, no optional service tier, no media/files, no server tools/plugins, no response caching, no separate internal-reasoning price, and no endpoint that can incur unbounded or implicit prompt-cache charges. Merely omitting explicit cache controls is insufficient where provider caching is automatic.
- Require finite nonnegative decimal prompt/completion/request bounds, known context/output limits, supported `max_completion_tokens`, and `provider.require_parameters: true`.
- Set `provider.max_price` for prompt, completion, and request as defense in depth, but never label it a total cap.
- Compute and atomically hold `1.05 × ProviderCostHold`. Reject if available Balance is below that exact Usage Charge hold.
- Never cap settled Provider Cost/Usage Charge to the hold as the current code does. A bound violation is a launch-blocking incident: preserve the provider liability, quarantine Customer settlement under the approved no-debt policy, disable the endpoint, and investigate.

### Settlement

- `usage.cost` is the immediate normal-completion Provider Cost candidate; `generation.total_cost` is the reconciliation candidate. Never use `upstream_inference_cost`.
- Do not finalize solely from token counts/catalog multiplication.
- Define provider-confirmed finality and polling states before coding. Until then, keep the hold pending for cancelled, disconnected, locally interrupted, and errored streams.
- Post exactly one immutable Usage Charge per generation ID using an external key such as `openrouter:generation:{id}:usage`. Use separate adjustment keys if OpenRouter supports later corrections; never mutate or duplicate the original journal entry.
- Calculate `Usage Charge = Provider Cost × 1.05` in arbitrary-precision decimal. Preserve raw payload, received timestamp, source (`terminal_usage` or `generation_lookup`), and all compared amount fields.
- Release only the difference between the exact hold and final Usage Charge after finality. Zero Provider Cost can release the whole hold only after the provider-terminal rule is met.
- Reconcile repeated lookup results and account-level credits/Activity independently. Alert on any field mismatch, negative/sentinel amount, amount above hold, missing record beyond SLA, or changed amount after posting.

### Customer-facing behavior

- Disclose that cancellation is best-effort/provider-dependent and that already-produced text can remain billable.
- A Customer disconnect must trigger an explicit upstream abort where supported; merely stopping writes to the browser is insufficient.
- Preserve partial assistant content with a terminal reason (`cancelled`, `provider_error`, `customer_disconnect`, etc.) separately from monetary status.
- Never tell the Customer “not charged” from an HTTP error or local exception. Display pending settlement until Provider Cost is resolved.

## 12. Required test matrix

### 12.1 Contract and numeric tests

- Losslessly parse catalog decimal strings and settled JSON numbers at 0, very small values, 20+ fractional places, exponent notation, and values around every Balance storage boundary.
- Reject negative router sentinels, null limits, unknown pricing keys, unknown override conditions, and non-finite/overflowing values.
- Property-test the formula over all integer `(i,o)` satisfying context/output constraints; assert computed actual cost never exceeds the hold.
- Verify exact `× 1.05` arithmetic and presentation/ledger separation.
- Snapshot installed SDK 0.13.50 schemas for `ChatUsage`, `GenerationResponseData`, `PublicPricing`, `ProviderPreferences.MaxPrice`, and `ChatRequest`; fail deliberately when schemas add cost dimensions requiring review.

### 12.2 Real OpenRouter integration tests for each allowlisted endpoint

Capture raw headers, SSE bytes, terminal body, lookup responses, account-credit deltas, and timestamps for:

1. normal stream completion and non-stream completion;
2. output ending exactly at `max_completion_tokens` and below it;
3. explicit abort before response headers, after headers/before first body chunk, after one token, halfway through, and immediately before the final usage chunk;
4. downstream Customer disconnect while ModelPass keeps/aborts the upstream connection;
5. a provider documented as cancellation-supported and one unsupported (test-only, not launch allowlist);
6. pre-stream provider failure with fallback disabled;
7. pre-stream fallback attempt in a separate research account to determine fee behavior;
8. induced mid-stream provider disconnect/error with partial content;
9. zero-token/null-finish and error-finish insurance;
10. content-filter and context/output-limit terminal paths;
11. cache read/write disabled and attempted implicit caching;
12. response usage versus repeated generation lookup (`cost`, `total_cost`, `usage`, cancellation and finish fields);
13. response-header ID versus every chunk/body ID;
14. immediate lookup followed by backoff polling to measure `404` visibility delay;
15. repeated lookup over the provider-confirmed finality window to detect mutation; and
16. account credit before/after under isolated serial traffic to compare the actual debit.

### 12.3 Pricing/routing tests

- Enumerate every endpoint for an allowlisted model; verify model-level top-provider price is not used as the bound.
- Exercise every long-context threshold boundary (`threshold - 1`, threshold, `threshold + 1`) and UTC pricing window boundary.
- Prove `provider.max_price` rejects prompt, completion, and request rates above each cap and determine its behavior with conditional overrides/service tiers.
- Attempt an unsupported max-output parameter with and without `require_parameters`; verify the launch path cannot route when unsupported.
- Change/expire a catalog fixture between reservation and dispatch; prove fail-closed behavior.
- Verify concurrent Customer requests cannot reserve more than Balance and an OpenRouter budget does not substitute for the local hold.

### 12.4 Excluded-feature characterization tests

Before any later feature is admitted, separately test all quantities and final costs for images/image tokens/megapixels, audio/STT/TTS, video, web search and extra results, web fetch count/content, PDF pages/OCR, cache TTLs, internal reasoning, response cache, image-generation tool, advisor, subagent, Fusion, shell, presets, and service tiers. A successful test is necessary but not a substitute for a documented bound.

## 13. Questions for written OpenRouter confirmation

Send OpenRouter the exact ModelPass wallet use case and ask for written answers:

1. **Account charge:** For non-BYOK inference, is response `usage.cost` exactly the OpenRouter-credit debit for the request, inclusive of every model, request, cache, search, parser, tool, plugin, media, service-tier, and fallback charge? Is generation `total_cost` the same amount? Is generation `usage` guaranteed equal to it?
2. **Authority/finality:** Which field is the authoritative settled amount for customer reconciliation? What event/field proves it is final and immutable? Can costs later be corrected, refunded, or re-rated; if so, how is that exposed?
3. **Precision:** What maximum scale/significant digits and numeric range can settled cost have? What rounding mode and stage are used? Can JSON exponent notation occur? Is there or will there be a decimal-string settled field?
4. **Generation publication:** Is a generation record created for every provider-dispatched request, including client abort, network disconnect, provider error, zero-token insurance, and failure before first token? What is the maximum publication delay?
5. **Lookup retries:** Is an early `404` eventually consistent? What retry/backoff/cutoff is recommended? Which errors are transient? What rate limit applies?
6. **Retention:** For how long is generation cost metadata queryable? Is retention contractual and independent of prompt/output logging settings? Can a Customer/account deletion remove billing metadata earlier?
7. **Status:** How should `cancelled: true/false/null`, `finish_reason`, and `native_finish_reason` be combined into a terminal state? Why is there no settlement/status field?
8. **Lost ID:** Is `X-Generation-Id` guaranteed whenever provider dispatch can create a charge? How can a caller recover a billed generation if the connection fails before the ID arrives? Is there a list/filter endpoint by caller request/session/user metadata?
9. **Idempotency:** Is there a supported idempotency key for chat/completion inference so an ambiguous POST can be retried without a duplicate charge?
10. **Cancellation:** Is the provider support list an endpoint-level guarantee? What does “immediately” mean, how quickly is disconnect detected, and is only work generated before detection billed? Does generation lookup always expose the final cancelled charge?
11. **Errors:** Confirm that every `finish_reason: error` receives zero model inference charge even after partial text, while auxiliary charges may remain. Enumerate auxiliary charges that can survive each failure path.
12. **Fallbacks/request fees:** Are token and fixed request charges from failed upstream attempts ever billed? Is `pricing.request` once per OpenRouter request or once per attempted endpoint?
13. **Pricing caps:** Does `provider.max_price` evaluate conditional override and service-tier rates? Can it cap cache read/write, internal reasoning, web search/fetch, output media, and all auxiliary fees through any undocumented fields?
14. **Token preflight:** Is there a supported endpoint that returns the exact native prompt-token count and transformed request OpenRouter will bill before inference? If not, does OpenRouter endorse a context-window worst-case formula?
15. **Context/output:** Does `max_completion_tokens` include all hidden reasoning and media output tokens for every supporting endpoint? Is `i + o <= endpoint.context_length` a guaranteed billable-token invariant after OpenRouter transforms/plugins?
16. **Catalog consistency:** Is there a quote/version/ETag or transactional price lock between model/endpoint discovery and dispatch? How should clients handle catalog changes mid-request?
17. **BYOK/external tools:** Confirm exactly what `usage.cost` includes for BYOK and separately billed plugin keys. Is `upstream_inference_cost` informational rather than an OpenRouter debit?
18. **Sandbox:** Is there a non-billable test environment or supported fault-injection procedure for aborts, mid-stream errors, fallback attempts, delayed lookup, price overrides, and charge corrections?

## 14. Acceptance gates for #17

### Provider-contract gates

- [ ] OpenRouter confirms in writing that normal `usage.cost`/generation `total_cost` is the complete OpenRouter account charge and defines their equality/finality.
- [ ] OpenRouter documents settled numeric precision, rounding, range, and correction behavior.
- [ ] OpenRouter supplies generation publication latency, retry semantics, retention, terminal-state interpretation, and lookup rate limits.
- [ ] OpenRouter supplies a recovery/idempotency answer for ambiguous dispatch before generation-ID capture.
- [ ] OpenRouter confirms cancellation billing for supported/unsupported providers and error-finish/auxiliary-charge interactions.
- [ ] OpenRouter confirms pricing-cap behavior for overrides, service tiers, request fees, cache/reasoning, fallback attempts, and auxiliary features.

### Product/engineering gates

- [ ] BYOK, external tool credentials, dynamic routers, fallbacks, optional tiers, multimodal endpoints, files, server tools/plugins, nested model calls, and unbounded/non-token prices are excluded from initial launch.
- [ ] A versioned endpoint allowlist has finite nonnegative exact-decimal prices and known token limits.
- [ ] `X-Generation-Id` is durably captured before body consumption; ambiguous no-ID dispatch cannot auto-release or auto-retry.
- [ ] `max_completion_tokens`, `require_parameters`, provider allowlist, `allow_fallbacks: false`, and all available `max_price` caps are enforced.
- [ ] The strict formula is implemented with exact decimal arithmetic and proven against every allowlisted endpoint/override.
- [ ] Balance holds include exact 5% markup and are atomic across concurrent requests.
- [ ] Settlement uses account-charge fields, never catalog multiplication or `upstream_inference_cost`, and never silently caps actual cost to the hold.
- [ ] Provider finality polling and immutable, generation-idempotent Usage Charge journal behavior are specified.
- [ ] All real integration matrices in section 12 pass with retained redacted evidence.
- [ ] Monitoring disables an endpoint on missing/mutating lookup, field mismatch, unknown price component, precision violation, or actual-over-bound event.
- [ ] Customer terms/UI accurately disclose cancellation and partial-output billing.

## 15. Decision

**The field question is resolved:** for ordinary OpenRouter-funded inference, ModelPass Provider Cost is the OpenRouter account charge in terminal `usage.cost`, reconciled using generation `total_cost`; it is not `upstream_inference_cost`.

**The strict-wallet guarantee is not resolved by public documentation alone.** OpenRouter documents useful cancellation, usage, model pricing, endpoint, and generation primitives, but does not publicly guarantee generation lookup latency/retention/finality, settled decimal precision/rounding, recovery of a charged request whose ID was never received, or a total-cost cap spanning all routed pricing components. `max_completion_tokens` caps generated tokens and `provider.max_price` caps selected unit rates; neither independently caps dollars.

The wallet may proceed to a controlled integration phase using the restricted formula and exclusions in section 9. Production must remain blocked until the provider-contract gates and real integration tests pass. The current broad model catalog, binary-number ledger, byte-count estimate, safety factor, first-body-chunk ID linkage, 15-minute unlinked release, and reservation-capped settlement are not acceptable foundations for the ModelPass Balance specification.
