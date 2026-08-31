# Issue #14 research: Replace credits with a 5%-markup USD wallet

**Issue:** [#14 — Replace credits with a 5%-markup USD wallet](https://github.com/TroyOwens0493/modelPassBackend/issues/14)<br>
**Researched:** 2026-08-09<br>
**Status:** Research briefing, not an implementation specification or legal advice

## Executive summary

Issue #14 is a planning map, not a single implementation ticket. Its destination is an implementation-ready specification for a prepaid, personal, non-transferable US-dollar Balance for authenticated United States Customers. Each Usage Charge must equal OpenRouter's final Provider Cost plus 5%; interrupted or partially delivered requests remain billable; and request authorization must prevent debt by reducing output rather than demanding an unaffordable fixed maximum hold. Existing balances are test data and need no migration. These requirements and the canonical terms Customer, Balance, Provider Cost, and Usage Charge come directly from [issue #14](https://github.com/TroyOwens0493/modelPassBackend/issues/14) and `CONTEXT.md:1-16`.

The map is not ready to become an implementation ticket. Its nine child issues are all open: [#15 Polar capabilities](https://github.com/TroyOwens0493/modelPassBackend/issues/15), [#16 US prepaid-balance constraints](https://github.com/TroyOwens0493/modelPassBackend/issues/16), [#17 OpenRouter settlement](https://github.com/TroyOwens0493/modelPassBackend/issues/17), [#18 deposit rules](https://github.com/TroyOwens0493/modelPassBackend/issues/18), [#19 precision and invariants](https://github.com/TroyOwens0493/modelPassBackend/issues/19), [#20 request-authorization prototype](https://github.com/TroyOwens0493/modelPassBackend/issues/20), [#21 reversals](https://github.com/TroyOwens0493/modelPassBackend/issues/21), [#22 reconciliation](https://github.com/TroyOwens0493/modelPassBackend/issues/22), and [#23 customer-experience prototype](https://github.com/TroyOwens0493/modelPassBackend/issues/23). GitHub's first-party [sub-issues API](https://api.github.com/repos/TroyOwens0493/modelPassBackend/issues/14/sub_issues) shows this decomposition; issue #14 and its children currently have no comments.

**Recommendation:** keep #14 as a planning map and resolve its dependencies in the intended order: provider/compliance facts (#15–#17), accounting and authorization decisions (#18–#21), controls (#22), then the end-to-end customer flow (#23). Do not implement until Polar confirms that this stored-value use case is acceptable and correctly taxed, US counsel resolves state cash-redemption/unclaimed-property exposure, and OpenRouter's cost precision plus a strict per-request cost bound are established.

## 1. Current repository baseline

The existing system is a useful prototype but is not a USD wallet:

- Customer state and ledger entries use JavaScript `number` fields; Balance and credits are treated as integers while `costUsd` is floating-point, and reservations are embedded in the user document (`src/billing/types.ts:3-52`, `src/billing/creditLedger.ts:73-93,264-268,366-369`). A unique `externalId` index protects ledger idempotency, and a user/date index supports history (`src/billing/model.ts:15-37`).
- A paid OpenRouter request is converted to credits by dividing by `USD_PER_CREDIT` (default $0.01), rounding up, and imposing a one-credit minimum (`src/billing/creditLedger.ts:73-84`; tests at `unit-tests/creditLedger.spec.ts:15-36`). This does not implement Provider Cost plus exactly 5%: a $0.0001 Provider Cost becomes a $0.01 charge under the default configuration.
- Authorization estimates input tokens from UTF-8 byte length, adds a fixed overhead, uses the model-level prompt/completion/request prices, multiplies by a configurable safety factor (default 2), and reserves the entire estimate before requesting a fixed output cap (`src/billing/openRouterUsage.ts:29-35,53-103,151-173`). This is the conservative maximum hold that #14 explicitly asks to replace.
- Finalization charges no more than the reservation, even when the requested charge is larger (`src/billing/creditLedger.ts:264-268`). That preserves a nonnegative credit balance but can fail #14's requirement to recover every settled Provider Cost plus markup.
- The service prefers streamed `usage.cost` and otherwise queries `generation.data.totalCost`; linked interrupted streams stay reserved and are reconciled (`src/billing/openRouterUsage.ts:106-149,178-224,227-257`). The process runs at startup and every minute (`src/server.ts:15-18`). This is a sound seam to retain, but the three generation-lookup attempts span only 1.5 seconds and are not a durable retry policy (`src/billing/openRouterUsage.ts:126-146`).
- Polar checkout currently offers three fixed packages (`src/billing/packages.ts:10-35`). The paid-order webhook maps `productId` back to a fixed credit amount, records `totalAmount`, ignores every event except `order.paid`, and therefore does not handle amount-based Deposits, partial refunds, full refunds, or disputes (`src/billing/webhook.ts:25-70`).
- Deposit and usage application already use MongoDB transactions and external-ID checks (`src/billing/creditLedger.ts:225-315,318-390`). MongoDB documents that distributed transactions are atomic and supported on replica sets and sharded clusters, so production configuration must provide a transaction-capable deployment rather than a standalone server ([MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/)).

The billing history confirms the present design was introduced as credits and later refactored around OpenRouter reservations: commits `6c2a737` ("added credits functionality, connected to chat") and `d975367` ("simplify credit usage handling"). No legacy-value conversion is needed because issue #14 explicitly identifies these balances as development/test data.

## 2. Polar can express a chosen amount, but acceptance and economics remain gates

### Verified provider capabilities

Polar supports temporary ad-hoc prices on a checkout session, including fixed prices and custom/pay-what-you-want prices ([Polar checkout sessions — ad-hoc prices](https://polar.sh/docs/features/checkout/session#ad-hoc-prices)). The installed `@polar-sh/sdk` 0.48.1 also exposes `CheckoutCreate.prices`, `CheckoutCreate.amount`, and a custom-price schema with minimum, maximum, and preset minor-unit amounts; its USD custom-price floor defaults to 50 cents (`node_modules/.pnpm/@polar-sh+sdk@0.48.1/node_modules/@polar-sh/sdk/src/models/components/checkoutcreate.ts`, `.../productpricecustomcreate.ts`).

A safer flow is for the Customer to choose cents in ModelPass, then for the backend to validate the amount and create an **ad-hoc fixed-price** checkout for exactly that amount. A pay-what-you-want checkout lets the Customer edit the amount after ModelPass's balance/cap check, while an ad-hoc fixed price preserves the Customer's choice and the backend's invariant. This is a design inference from Polar's documented fixed and custom ad-hoc price types, not an explicit Polar guarantee.

Credit a Deposit only after [`order.paid`](https://polar.sh/docs/api-reference/orderpaid), which Polar defines as fully processed with payment received. Store the order ID as the idempotency key and verify that the order's currency, customer external ID, product, and net amount match the server-created checkout. Polar's order model separately reports subtotal, discount, net, tax, total, refundable amount, and refunded amount ([Order API](https://polar.sh/docs/api-reference/orders/get-order)); the installed schema confirms these are integer minor-unit fields (`node_modules/.pnpm/@polar-sh+sdk@0.48.1/node_modules/@polar-sh/sdk/src/models/components/order.ts`).

For a US-dollar Balance, the Deposit's face value should be the validated order **net amount**, not tax-inclusive `totalAmount`, and discounts should be disabled. Polar's default US presentation is tax-exclusive, and Polar calculates, itemizes, collects, and remits transaction tax as Merchant of Record ([tax-inclusive pricing](https://polar.sh/docs/features/tax-inclusive-pricing), [Merchant of Record](https://polar.sh/docs/merchant-of-record/introduction)). This recommendation still requires Polar to confirm that a ModelPass Balance top-up is an acceptable product and how it classifies the top-up for US tax; the public docs establish general MoR behavior, not the tax characterization of this particular stored-value product.

Customer Balance should become available on `order.paid`, not when Polar pays ModelPass. Polar documents a default seven-day payout settlement delay for newer organizations and says it may extend holds; that delay concerns merchant payout availability, not whether the customer order is paid ([Polar payouts — payout delay](https://polar.sh/docs/features/finance/payouts#payout-delay)).

### The 5% markup does not fund Polar Starter fees

Polar's current Starter fee is 5% + $0.50 per transaction; paid plans have lower variable/fixed rates, and refunds do not return the initial transaction fee ([Polar fees](https://polar.sh/docs/merchant-of-record/fees), [Polar refunds](https://polar.sh/docs/features/refunds)). If a $D Balance is completely spent, `D = 1.05 × Provider Cost`, so the gross usage margin is `D / 21 ≈ 4.7619% of D`. Starter's `5% × D + $0.50` payment fee is therefore greater than the entire usage margin for every positive D. Raising the minimum Deposit cannot make Starter self-funding under an exactly 5% usage markup.

The specification must consequently choose and disclose one of these policies:

1. ModelPass absorbs payment fees as customer-acquisition/operating cost.
2. Checkout adds a separately disclosed funding fee, calculated so the net receipt still funds the chosen Balance.
3. ModelPass uses a lower-cost payment rail or a Polar paid plan and separately models monthly/fixed costs.
4. The product revisits the fixed 5% markup requirement.

Crediting less than the chosen face value silently is not recommended. It would make "Deposit" ambiguous and would complicate refunds, tax presentation, and customer disclosures. No minimum/maximum should be declared "implementation-ready" until this product decision and Polar's account-specific fee plan are known.

### Refund and dispute implications

Polar can issue full or partial refunds, may proactively refund within 60 days to prevent chargebacks, automatically returns proportional tax, and does not return payment fees ([Polar refunds](https://polar.sh/docs/features/refunds)). It emits [`order.refunded`](https://polar.sh/docs/api-reference/orderrefunded), [`refund.created`](https://polar.sh/docs/api-reference/refundcreated), and [`refund.updated`](https://polar.sh/docs/api-reference/refundupdated); the installed SDK's webhook validator recognizes these event types (`node_modules/.pnpm/@polar-sh+sdk@0.48.1/node_modules/@polar-sh/sdk/src/webhooks.ts:91-108`). Polar also documents a $15 dispute fee and monitoring of chargebacks that can arrive up to 120 days after payment ([Polar fees](https://polar.sh/docs/merchant-of-record/fees), [account reviews — chargeback management](https://polar.sh/docs/merchant-of-record/account-reviews#chargeback-management)).

Therefore a payment reversal cannot be modeled by deleting a Deposit. It needs an immutable compensating entry. Self-service refunds should be limited to unspent, unheld Deposit value. If Polar forces a refund after funds were spent, cap available Balance at zero, suspend further usage, and record the unrecovered amount in a separate shortfall/receivable concept rather than creating spendable negative Balance. This is precisely the kind of additional domain concept anticipated by issue #14's "Not yet specified" section.

## 3. United States compliance is a launch blocker, not a disclosure-only task

Federal FinCEN rules define prepaid access as access to value paid in advance and retrievable later through an electronic device or vehicle, and define closed-loop prepaid access as usable only for goods or services at a defined merchant. An arrangement providing no more than $2,000 of closed-loop value on any day is excluded from the federal definition of a "prepaid program" ([31 CFR 1010.100(ff)(4)(iii)(A), (ww), and (kkk)](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-A/section-1010.100)). A conservative product constraint is therefore `posted Balance + active holds <= $1,999.99` per Customer until counsel confirms a different limit; Deposits must be rejected or reduced when they would cross that cap.

Federal gift-card rules exclude a device that is reloadable and not marketed or labeled as a gift card, while covered products generally cannot expire earlier than five years and face restrictions on dormancy/service fees ([15 USC 1693l-1(a)(2)(D)(ii), (b), and (c)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section1693l-1&num=0&edition=prelim); [Regulation E §1005.20(b)(2)](https://www.consumerfinance.gov/rules-policy/regulations/1005/20/#b-2)). ModelPass should therefore make the Balance reloadable, personal, non-giftable, and never market it as a gift. That reduces federal gift-card exposure but does not resolve state law.

State rules materially differ:

- California includes electronic gift cards in its definition, generally prohibits expiration/service fees, and—effective April 1, 2026—requires cash redemption for a covered certificate with value under $15 ([California Civil Code §§1749.45 and 1749.5](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&chapter=&part=4.&lawCode=CIV&title=1.4A.)).
- Washington generally prohibits expiration and fees and requires cash redemption on demand when a covered certificate's post-purchase remainder is under $5 ([RCW 19.240.020](https://app.leg.wa.gov/RCW/default.aspx?cite=19.240.020)).
- New York defines a gift certificate to include an electronic pre-funded record for future goods/services, generally prohibits fees, permits expiration no earlier than nine years after issue or last load, requires cash redemption below $5 for covered closed-loop certificates, and expressly leaves unclaimed-property law applicable ([NY General Business Law §396-i](https://www.nysenate.gov/legislation/laws/GBS/396-I)).

These statutes do not by themselves establish that ModelPass's account Balance is a "gift certificate" in each state; classification is a legal question. They do establish that the intended nationwide, non-withdrawable design conflicts with plausible state obligations if it is classified that way. Before US launch, qualified counsel must provide a state-by-state classification, cash-redemption, expiration, fee, unclaimed-property, and disclosure matrix. The resulting specification may need state exclusions, mandatory small-balance cash-out, or a different product structure. Do not promise "non-withdrawable" or "never expires" terms before that review.

## 4. OpenRouter settlement is authoritative after the request, but preflight cost is not

OpenRouter automatically includes usage in every response; for streaming, it arrives in the last SSE event. Its `usage.cost` is "the total amount charged to your account," while `cost_details.upstream_inference_cost` is the upstream provider's cost ([OpenRouter usage accounting](https://openrouter.ai/docs/use-cases/usage-accounting)). Under ModelPass vocabulary, **Provider Cost should therefore use OpenRouter's `usage.cost` / generation `total_cost`, not `upstream_inference_cost`**: the latter is not what OpenRouter charges ModelPass.

The same documentation permits asynchronous audit by generation ID. The generation API reports `total_cost`, token counts, provider, cancellation status, and other metadata ([Get a generation](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation)); SDK 0.13.50 types `totalCost` and streamed `cost` as JavaScript numbers (`node_modules/.pnpm/@openrouter+sdk@0.13.50/node_modules/@openrouter/sdk/esm/models/generationresponse.d.ts`, `.../chatusage.d.ts`). OpenRouter's streaming documentation also states that every endpoint returns the generation ID in the `X-Generation-Id` response header ([OpenRouter streaming](https://openrouter.ai/docs/api_reference/streaming)). The future implementation should persist that header before consuming SSE instead of waiting for the first chunk as the current code does (`src/billing/openRouterUsage.ts:181-190`).

Cancellation does not erase already incurred chat cost. OpenRouter says aborting a stream immediately stops processing and billing only for listed supported providers; other providers do not support immediate cancellation ([OpenRouter streaming — cancellation](https://openrouter.ai/docs/api_reference/streaming#stream-cancellation)). OpenRouter separately states that a cancelled chat stream is billed for tokens produced before cancellation ([image-generation billing comparison](https://openrouter.ai/docs/guides/overview/multimodal/image-generation#billing-and-cancellation)). Thus client disconnect should abort upstream to limit cost, but the hold must remain and final Provider Cost must still be reconciled by generation ID.

`max_tokens`/`max_completion_tokens` limits generated tokens, and provider `max_price` is a hard routing ceiling for prompt, completion, per-request, and image prices; if no endpoint meets it, the request does not run ([OpenRouter parameters](https://openrouter.ai/docs/api_reference/parameters#max-tokens), [provider selection — max price](https://openrouter.ai/docs/guides/routing/provider-selection#max-price)). These controls are necessary but do not constitute a documented maximum-total-cost API. Public model pricing also includes non-token fields and conditional overrides; the official model API currently returns decimal price strings as fine as `0.0000000833333333333333` ([first-party Models API](https://openrouter.ai/api/v1/models)). OpenRouter's docs give no fixed decimal-precision guarantee for settled `cost`/`total_cost`.

This leaves two facts that #17 must settle with first-party confirmation or executable provider tests:

1. the maximum precision and finality/availability delay of settled `cost`/`total_cost`; and
2. a strict upper-bound formula covering native prompt tokenization, endpoint-specific/conditional pricing, request fees, caching, reasoning, and any enabled tools.

Without a strict bound, "charge every Provider Cost plus 5%" and "never create debt" cannot both be guaranteed for arbitrary models. Models/features without a verified bound should be unavailable in the wallet launch.

## 5. Recommended request-authorization contract

Subject to the unresolved OpenRouter facts, #20 should prototype this contract:

1. Create a durable billable-operation ID, choose only endpoints with known pricing and output-limit support, and send a hard `provider.max_price` ceiling.
2. Calculate the unavoidable prompt/request upper bound including 5% markup. Reject only if available Balance cannot cover that unavoidable amount.
3. Atomically place a hold up to the Customer's available Balance (or their chosen per-request cap), then derive `max_completion_tokens = floor((hold / 1.05 - prompt/request bound) / max completion price)`. This lets a small Balance buy a shorter answer rather than failing a fixed global maximum.
4. Persist the `X-Generation-Id` before streaming content. Show available and held amounts separately.
5. On normal completion, post `Provider Cost` and `Usage Charge`, release unused hold, and key the posting by generation ID.
6. On disconnect, abort upstream but retain the hold. Poll/retry generation lookup durably until settled or escalated; never release merely because a short retry window elapsed.
7. If final cost exceeds the verified hold bound, treat it as a pricing-control incident: do not debit the Customer below zero, disable the affected endpoint/model, and record ModelPass's shortfall separately. Do not silently label the capped debit as the full Usage Charge.

Concurrency requires holds: two simultaneous requests must atomically see available Balance after existing holds. A customer-facing "Balance" should remain the amount available to spend, with `posted balance`, `held amount`, and `available balance = posted balance - active holds` explicitly distinguished in the storage/API specification.

## 6. Monetary representation and ledger invariants

JavaScript binary `number` plus whole-credit rounding cannot represent the requested accounting (`src/billing/types.ts:10-43`, `src/billing/creditLedger.ts:73-84`). MongoDB's BSON Decimal128 provides 34 decimal digits of precision and is intended for exact decimal monetary arithmetic ([MongoDB monetary data — Decimal128](https://www.mongodb.com/docs/manual/tutorial/model-monetary-data/#using-the-decimal-bson-type)).

Recommended representation, pending OpenRouter's precision answer:

- Polar order amounts: integer cents exactly as Polar supplies them.
- Provider Cost and Usage Charge: Decimal128, preserving OpenRouter's settled decimal value rather than recomputing cost from token prices.
- Markup: `Usage Charge = Provider Cost × 105 / 100` in decimal arithmetic, with no intermediate binary-float conversion.
- Display: dollars and cents for Deposits/checkout; enough fractional dollars for Usage Charges that the displayed entries sum to the displayed Balance. Any display rounding is presentation only, not a second ledger amount.

Do not choose a microdollar/nanodollar integer scale until OpenRouter states its maximum settled-cost precision. The current first-party model catalog already contains prices with 22 fractional decimal places, so an assumed six- or nine-decimal scale would discard provider pricing information ([Models API](https://openrouter.ai/api/v1/models)).

The implementation-ready specification should require these invariants:

1. The journal is append-only; corrections, refunds, reversals, and support adjustments are compensating entries.
2. Each Polar order/refund/dispute action and OpenRouter generation posts at most once under a unique external key.
3. `Usage Charge = Provider Cost × 1.05` in the canonical decimal representation.
4. Available Balance and held Balance are never negative; total active holds never exceed posted Balance.
5. A settled Usage Charge never exceeds its hold. A violation is a provider-pricing incident, not Customer debt.
6. Cached balance/usage totals equal the journal plus active holds and can be rebuilt by reconciliation.
7. A Deposit posts only from a verified paid order whose Customer, USD currency, product, and net amount match the server-created checkout.
8. Refunds/reversals never mutate or delete the original Deposit or already-settled Usage Charges.
9. Balance mutation and journal insertion commit atomically. Unique external IDs remain the final defense against webhook/job retries (`src/billing/model.ts:29-35`, `src/billing/creditLedger.ts:225-315,318-390`).

The journal needs explicit concepts for Deposit, Usage Charge, Hold/hold release, Deposit reversal/refund, usage adjustment, and payment shortfall. These additions should be made through domain modeling rather than reusing the current `purchase`, `usage`, and generic `adjustment` labels (`src/billing/types.ts:3-8`).

## 7. Reconciliation, observability, and support requirements

The current unique external-ID index and transactional writes are a good foundation (`src/billing/model.ts:15-37`; `src/billing/creditLedger.ts:225-315,318-390`). The current Polar reconciliation command only lists paid orders and reapplies known fixed packages; it does not reconcile arbitrary net amounts, refunds, disputes, or ledger mismatches (`src/scripts/reconcilePolarOrders.ts:26-62`).

The final specification should require:

- **Polar:** webhook signature verification, fast acknowledgement/queued processing, all paid/refund/update events, periodic order/refund API reconciliation, and alerts for unknown customer/product/currency/amount. Polar retries failed webhook delivery up to ten times and can disable an endpoint after ten consecutive failures, which makes idempotency and alerting mandatory ([Polar webhook endpoints](https://polar.sh/docs/integrate/webhooks/endpoints)).
- **OpenRouter:** durable operations keyed by generation ID, final-cost polling beyond process restarts, comparison of ledger Provider Cost to generation `total_cost`, stuck-hold aging, and model/endpoint circuit breaking when actual cost breaches its bound ([generation API](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation)).
- **Ledger:** scheduled recomputation of cached balances, checks for duplicate/missing external IDs, negative/over-held balances, markup mismatches, and reversal shortfalls.
- **Support:** search by WorkOS Customer ID, Polar order/refund ID, OpenRouter generation ID, or internal operation ID; view immutable source payload references and calculation components; apply reason-coded compensating adjustments with actor/time/audit metadata.
- **Metrics/alerts:** paid orders not posted, refunds not reversed, generation lookups failing, holds older than threshold, bound breaches, balance-cache mismatches, webhook verification failures, and dispute/shortfall totals.

## 8. Customer-facing specification requirements

The sibling frontend is out of scope for this repository's implementation, but #23 must validate the full experience specified by #14. At minimum, Customers need to see:

- available Balance and temporarily held amount;
- chosen Deposit amount, tax, funding fee (if any), and total charged before leaving checkout;
- pending/succeeded/failed return states driven by backend order status, not the success URL alone;
- each Usage Charge with model, timestamp, Provider Cost, 5% markup, total, and resulting Balance;
- an explicit warning when low Balance shortens maximum output, plus a distinct rejection when even unavoidable prompt cost is unaffordable;
- interrupted-response charges and released/pending holds;
- refund eligibility based on unspent funds and required state cash-redemption terms; and
- non-transferability, permitted use, expiration policy, refund policy, tax treatment, dispute effects, and support contact.

These are derived from issue #14's requested customer experience, Polar's itemized tax/order behavior ([tax-inclusive pricing](https://polar.sh/docs/features/tax-inclusive-pricing)), OpenRouter's partial-stream billing behavior ([streaming](https://openrouter.ai/docs/api_reference/streaming#stream-cancellation)), and the state-law risks listed above. Exact legal wording must follow counsel's classification rather than this engineering research.

## 9. Decision gates and recommended sequence

1. **#15 Polar:** obtain written confirmation that prepaid ModelPass Balance top-ups are acceptable; sandbox an ad-hoc fixed USD checkout; verify order net/tax/total, refund, dispute, metadata, and webhook payloads; record the organization's actual fee plan.
2. **#16 compliance:** obtain the state matrix and decide whether California/other cash redemption is supported, whether any states are excluded, whether Balance expires, and whether the $1,999.99 cap is adopted.
3. **#17 OpenRouter:** establish final cost precision/latency and a strict endpoint-specific cost bound; produce an allowlist of supported models/features.
4. **#18–#19 accounting:** choose Deposit minimum, funding-fee policy, Decimal128 precision contract, markup treatment, and ledger concepts/invariants.
5. **#20 authorization prototype:** test small balances, concurrent requests, long prompts, cancellation, generation-delay, and bound-breach scenarios.
6. **#21 reversals:** decide unspent refund allocation, forced-refund shortfalls, suspension/recovery, and support adjustments.
7. **#22 controls:** turn the reconciliation and observability requirements above into acceptance criteria.
8. **#23 UX prototype:** validate deposit, held/available Balance, low-Balance output limiting, exact charge history, interrupted charges, and disclosures.
9. Only then consolidate the resolved decisions into #14's implementation-ready specification and begin migration work.

## Conclusion

The repository already demonstrates atomic reservation/finalization and idempotent provider IDs, but its whole-credit conversion, conservative fixed hold, package checkout, capped final debit, short generation retry, and paid-only webhook cannot satisfy #14 as written. Polar has the technical primitives for server-validated customer-chosen amounts, and OpenRouter exposes authoritative final charged cost, but three blockers remain: Polar acceptance/tax characterization and unfavorable fee economics; state-law conflict with a universally nonwithdrawable Balance; and the absence of a documented OpenRouter total-cost bound/precision contract. Resolve those gates before treating #14 as implementation-ready.
