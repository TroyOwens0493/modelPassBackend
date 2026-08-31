# Issue #15 research: Verify Polar support for customer-chosen USD deposits

**Issue:** [#15 — Verify Polar support for customer-chosen USD deposits](https://github.com/TroyOwens0493/modelPassBackend/issues/15)<br>
**Researched:** 2026-08-09 (AKDT)<br>
**Status:** Provider-capability briefing and recorded product decision, not legal advice<br>
**Decision:** Use one dashboard-created, one-time Polar product with a catalog custom/pay-what-you-want USD price. The Customer chooses the Deposit in Polar checkout within configured minimum and maximum bounds; ModelPass credits the verified order's net amount.

## Executive summary

**Technical capability: yes. Provider/use-case approval: not established.** Polar's dashboard custom/pay-what-you-want price is designed to let a Customer choose an amount at checkout. It supports a minimum, optional maximum, and preset amount in integer currency minor units. This is the selected ModelPass route: the backend creates checkout for the dedicated catalog product and links the authenticated Customer, Polar collects the chosen amount, and ModelPass learns the final amount from the paid Order. Polar documents the custom-price fields in its [checkout API reference](https://polar.sh/docs/api-reference/checkouts/create-checkout-session) and identifies `amount_type: custom` as pay-what-you-want.

The production launch is nevertheless **blocked**:

1. Polar's current Acceptable Use Policy lists software/SaaS as acceptable, but also prohibits “Trading and Financial Services,” including “services facilitating transactions, investments, or balances for customers.” The public text does not decide whether a personal, non-transferable, non-withdrawable Balance usable only for ModelPass AI service falls inside that prohibition. Written Polar approval is required; technical API support is not approval of the business model ([Polar AUP, effective March 25, 2026](https://polar.sh/legal/acceptable-use-policy)).
2. Polar generally calculates, presents, collects, and remits US sales tax as Merchant of Record, but no reviewed Polar source characterizes a prepaid ModelPass Balance top-up. Polar must confirm in writing what it is selling as reseller, whether tax applies at Deposit or later consumption, and how the checkout product should be configured ([Merchant of Record](https://polar.sh/docs/merchant-of-record/introduction), [tax behavior](https://polar.sh/docs/features/tax-inclusive-pricing)).
3. Polar's current webhook catalog has order and refund events but **no dispute event**. The current versioned OpenAPI has list/get/accept dispute endpoints and dispute statuses, so ModelPass would need API polling/reconciliation unless Polar supplies another supported notification path ([Webhook events](https://polar.sh/docs/integrate/webhooks/events), [OpenAPI 2026-04](https://polar.sh/docs/openapi.json)).
4. Polar's published Starter fee is 5% + $0.50 of transaction value. A Balance spent at exactly Provider Cost + 5% generates only 4.7619% of the deposited face amount as gross usage margin. Starter payment fees therefore exceed the entire usage margin for every positive Deposit even before refunds, disputes, tax-on-fee effects, or payout fees ([Polar fees](https://polar.sh/docs/merchant-of-record/fees)).

**Decision:** proceed with the dashboard custom-price design for planning and implementation. Credit the signature-verified `order.paid` Order's `net_amount`; this is the amount after discounts and before tax. Configure explicit minimum and maximum amounts, disable discounts, and build refund plus dispute reconciliation before production. Do not credit `total_amount`, silently deduct Polar fees from the Customer's Balance, fulfill from the browser success redirect, or rely on webhook delivery order. Written Polar use-case and tax confirmation remain launch gates rather than blockers to resolving this research ticket.

## 1. Scope, terms, and evidence standard

Issue #15 asks what Polar supports for a US Customer depositing an arbitrary USD amount into a prepaid ModelPass Balance. It was open with no comments at initial research time and was closed after the custom-price decision was recorded. “Customer,” “Balance,” “Deposit,” “Provider Cost,” and “Usage Charge” have the meanings in `CONTEXT.md`; in particular, this document does not use “credits” for the future ModelPass Balance.

Here, “arbitrary USD amount” means a Customer-selected **positive integer number of cents within explicit ModelPass and Polar bounds**. It does not mean arbitrary decimal precision or an unbounded amount.

Evidence is limited to this repository and Polar-owned primary material: current Polar documentation and OpenAPI, the installed Polar SDK schemas, current Polar source, and statements by Polar maintainers/contributors in the Polar repository. Where public sources do not promise behavior, this document says so rather than converting an inference into a guarantee.

### Evidence labels used below

- **Confirmed** — stated or encoded by a cited Polar primary source or this repository.
- **Engineering inference** — recommended ModelPass behavior derived from confirmed primitives; it is not a Polar promise.
- **Needs written Polar confirmation** — public sources are absent, ambiguous, or raise a policy/product-classification conflict.

## 2. Current repository baseline

**Confirmed — repository behavior.** The existing integration sells three fixed packages and cannot fulfill a chosen USD Deposit:

- `src/billing/packages.ts:10-35` defines three application packages and maps each to a configured Polar product ID.
- `src/routes/billing.ts:47-101` accepts a package ID, creates a checkout from the catalog product, links the authenticated WorkOS user through `externalCustomerId`, and sends package/credit metadata. It does not accept a USD amount, create an ad-hoc price, disable discount codes, or forward `customerIpAddress`.
- `src/app.ts:26-31` correctly puts `express.raw({ type: "application/json" })` before JSON parsing for the Polar route. `src/billing/webhook.ts:17-79` uses the SDK's `validateEvent`, but processes only `order.paid`; it maps `productId` to a fixed package, credits that package's fixed integer amount, and merely records `order.totalAmount` as metadata.
- `src/billing/webhook.ts:28-31` acknowledges every non-`order.paid` event without handling it. Refunds, partial refunds, disputes, and checkout state therefore have no Balance effect.
- `src/scripts/reconcilePolarOrders.ts:26-62` lists paid orders and reapplies known fixed packages. It cannot reconcile chosen amounts, refund resources, or disputes.
- Purchases are transactionally applied and deduplicated by `polar:order:{order.id}` (`src/billing/creditLedger.ts:318-390`), backed by a unique `externalId` index (`src/billing/model.ts:29-35`). Those are useful foundations to retain.
- Money-like fields are JavaScript `number`, while purchases must be positive integer “credits” (`src/billing/types.ts:10-52`, `src/billing/creditLedger.ts:365-390`). This is not yet a USD Balance model.

**Confirmed — tests.** `unit-tests/polarWebhook.spec.ts:80-147` covers paid fixed packages, duplicate order handling, unknown products, and invalid signatures using mocks. `unit-tests/packages.spec.ts:15-38` covers package mapping. `unit-tests/billingRoutes.spec.ts:64-94` covers only authenticated billing reads, not real checkout creation. There are no provider integration tests for custom prices, amount/tax fields, refunds, retry ordering, or disputes.

**Confirmed — dependency version.** `package.json:28` declares `@polar-sh/sdk` `^0.48.1`, and `pnpm-lock.yaml:213-215,461-462` resolves 0.48.1. The npm registry reported stable 0.49.0 at research time, while current Polar docs use the versioned `@polar-sh/sdk/2026-04` interface in examples ([npm registry metadata](https://registry.npmjs.org/@polar-sh%2fsdk), [sandbox SDK example](https://polar.sh/docs/integrate/sandbox#api-and-sdk)). The implementation should choose and pin a current version/API surface before coding rather than mixing this briefing's current OpenAPI with assumptions from 0.48.1.

## 3. Checkout and pricing capabilities

### 3.1 Confirmed Polar primitives

Polar supports ad-hoc prices passed in `prices`, keyed by product ID. They exist only for that checkout and are marked `source: "ad_hoc"`; catalog prices remain unchanged. Supported types include fixed, custom/pay-what-you-want, free, seat-based, and metered ([Checkout API — ad-hoc prices](https://polar.sh/docs/features/checkout/session#ad-hoc-prices)). Polar completed its own “override prices at checkout” work as an ad-hoc pricing feature ([Polar issue #7799](https://github.com/polarsource/polar/issues/7799)).

| Price path | Confirmed behavior | Suitability for ModelPass |
|---|---|---|
| **Ad-hoc fixed** | `amount_type: fixed`, integer `price_amount`, and `price_currency`; the documented example uses cents. A paid nonzero USD price is subject to the $0.50 currency floor. Current Polar source applies the shared USD ceiling of 99,999,999 cents ($999,999.99) to fixed prices, although the public fixed-price field description does not state that maximum ([checkout API reference](https://polar.sh/docs/api-reference/checkouts/create-checkout-session), [price validation source](https://github.com/polarsource/polar/blob/e3fc593745de64c8742442162251cd1c0cf9ebbf/server/polar/product/schemas.py#L85-L166), [currency limits source](https://github.com/polarsource/polar/blob/e3fc593745de64c8742442162251cd1c0cf9ebbf/server/polar/kit/currency.py#L364-L418)). | Alternative when ModelPass must validate and lock the amount before redirect. Not selected. |
| **Custom / pay what you want** | `minimum_amount`, optional `maximum_amount`, and optional `preset_amount` are integer minor units. The USD minimum defaults to 50 cents; `minimum_amount: 0` permits free-or-pay-what-you-want; the documented USD maximum is $999,999.99. Checkout `amount` initializes the displayed custom price ([checkout API reference](https://polar.sh/docs/api-reference/checkouts/create-checkout-session), [OpenAPI](https://polar.sh/docs/openapi.json)). | **Selected.** Configure this catalog price in the dashboard. The Customer intentionally chooses the final amount in Polar checkout; ModelPass treats the paid Order as authoritative. |
| **Polar-native dynamic Balance grant** | Polar's own requested feature to convert a PWYW payment proportionally into meter credits was closed with the statement that it was not possible through Polar yet; the planned Wallets feature was later closed as not planned ([Polar issue #8336](https://github.com/polarsource/polar/issues/8336#issuecomment-4303571529), [Wallets #7001](https://github.com/polarsource/polar/issues/7001)). | **Do not depend on it.** ModelPass must own its Balance ledger and fulfillment if Polar approves that use case. |

The provider floor is not a sensible ModelPass product minimum by itself. A higher minimum and a much lower maximum must be chosen from fee economics, fraud/chargeback risk, Balance limits, and the compliance work in issues #16 and #18.

### 3.2 Selected dashboard custom-price checkout contract

**Product decision.** Subject to written Polar approval and tax configuration, use one dedicated **one-time ModelPass Balance Deposit product** whose catalog price is configured in the Polar dashboard as custom/pay-what-you-want USD pricing.

Configure the catalog price with:

- a nonzero minimum amount;
- an explicit product-level maximum amount;
- a useful preset amount; and
- location-based tax presentation, pending Polar's product-specific tax confirmation.

The backend creates a checkout for that catalog product, passes the authenticated Customer's external ID, disables discount codes, and records an internal Deposit intent containing Customer ID, product ID, checkout ID, USD currency, and policy version. The intent does **not** contain an authoritative chosen amount because the Customer chooses that amount inside Polar checkout.

**Known trade-off:** a catalog custom price has a product-level maximum, not a maximum derived from the Customer's current Balance. Repeated or concurrent checkouts can therefore cross a future per-Customer Balance cap. If issue #16 requires such a cap, the specification must define checkout gating plus immediate handling of an over-cap paid Order, or revisit a per-checkout ad-hoc price. This does not affect Polar's ability to report what was paid, but it prevents treating the dashboard setting as a complete dynamic-cap control.

Polar says that setting `customer_id` or `external_customer_id` pre-fills and disables checkout email, and the resulting `customer.external_id` is available in webhooks ([Checkout API — External Customer ID](https://polar.sh/docs/features/checkout/session#external-customer-id)). Forward only an IP obtained from a trusted proxy configuration: Polar explains that backend-created sessions otherwise see the server's IP, which can make country/currency pre-detection wrong; billing country drives taxes ([Checkout API — Customer IP address](https://polar.sh/docs/features/checkout/session#customer-ip-address)).

Treat the return URL as display/navigation only. Polar's checkout schema distinguishes `confirmed` (the Customer clicked Pay) from `succeeded` (payment succeeded), while `order.paid` means the order is fully processed and payment has been received ([OpenAPI checkout status](https://polar.sh/docs/openapi.json), [`order.paid`](https://polar.sh/docs/api-reference/orderpaid)).

### 3.3 Amount credited and order validation

**Engineering inference.** Credit exactly the chosen Deposit face value only after a verified `order.paid`, and define that face value as the order's **`net_amount`**:

- `subtotal_amount`: before discount and tax.
- `discount_amount`: discount.
- `net_amount`: after discount, before tax.
- `tax_amount`: sales tax.
- `total_amount`: after discount and tax.

Polar defines these as integer cents on the order, alongside `refundable_amount`, `refunded_amount`, Customer, product, checkout, currency, and metadata ([Get Order](https://polar.sh/docs/api-reference/orders/get-order), [OpenAPI Order schema](https://polar.sh/docs/openapi.json)). For the selected custom price, the verified Order is authoritative for the Customer's choice. With discounts disabled, credit `net_amount` and require `discount_amount === 0`. Tax is not spendable ModelPass Balance, so do not credit `total_amount`. Polar fees are ModelPass's expense, so do not silently reduce the credited amount by fees either.

Before posting a Deposit, verify all of the following against the durable server-side intent and configured product policy, not merely against echoed metadata:

- event signature valid and event type `order.paid`;
- order `paid === true` and status `paid`;
- known `checkout_id` and unused `depositIntentId`;
- dedicated `product_id`;
- `currency === "usd"`;
- `customer.external_id === authenticated WorkOS Customer ID`, and stable Polar `customer_id` matches any prior mapping;
- final billing country is United States if the launch is US-only;
- `net_amount` is within the configured Deposit minimum/maximum and resulting Balance policy, `discount_amount === 0`, `applied_balance_amount === 0`, and subtotal/total/tax/due arithmetic is internally consistent (quarantine any Polar customer-balance application unless Polar explicitly approves how to account for it);
- order metadata's intent and purpose match the stored intent; and
- the order ID has not posted before.

Any mismatch should be quarantined for reconciliation/support, not guessed into a Balance amount. Metadata is useful for correlation because Polar copies checkout metadata to the resulting order/subscription and permits at most 50 pairs, 40-character keys, and 500-character string values ([checkout API reference](https://polar.sh/docs/api-reference/checkouts/create-checkout-session)). It is not a substitute for the stored checkout intent and provider IDs.

## 4. Fees and economics

### 4.1 Confirmed published fees

Polar's current public plan schedule is ([Polar fees](https://polar.sh/docs/merchant-of-record/fees)):

| Plan | Monthly fee | Per transaction |
|---|---:|---:|
| Starter | $0 | 5% + $0.50 |
| Pro | $20 | 3.8% + $0.40 |
| Growth | $100 | 3.6% + $0.35 |
| Scale | $400 | 3.4% + $0.30 |

Organizations created before May 27, 2026 may retain the Early Member rate (4% + $0.40, plus 0.5% for subscriptions) until they move to a paid plan. A non-US card adds 1.5%, even if the Customer is in the United States. Polar's fee example calculates the percentage on total transaction value including collected tax. The organization's actual plan and any account-specific terms must therefore be recorded rather than inferred.

Refunds do not return the original transaction fee. A formal dispute costs $15 regardless of outcome. Stripe payout charges are additional; Polar says it adds no payout markup ([fees — refunds, disputes, and payouts](https://polar.sh/docs/merchant-of-record/fees#refunds)).

### 4.2 Consequence for a 5%-markup Balance

**Engineering calculation from confirmed rates.** If a Customer deposits and later spends `$D`, issue #14 requires:

```text
D = 1.05 × Provider Cost
Provider Cost = D / 1.05
Gross usage margin = D - D/1.05 = D/21 ≈ 4.7619% × D
```

On Starter, ignoring tax and all other costs:

```text
Polar payment fee = 5% × D + $0.50
Operating loss before other costs = fee - usage margin
                                  ≈ 0.2381% × D + $0.50
```

For a $10 Deposit, the gross usage margin is about $0.476, while the Starter fee is $1.00. For $100, the margin is about $4.762 and the fee is $5.50. Tax and an international card only worsen this comparison. **No positive minimum Deposit makes Starter self-funding under an exact 5% usage markup.**

Paid plans can have a positive per-transaction contribution above some amount, but their monthly fees, tax-inclusive fee base, refund loss, disputes, and actual Deposit distribution must be modeled. This issue cannot choose a viable minimum without the product decision in #18.

**Recommendation:** preserve the meaning of Deposit—chosen dollars become the same dollars of Balance—and choose explicitly among absorbing payment cost, separately and clearly charging a funding fee, changing processor/plan, or revisiting the usage markup. Do not tell the Customer they deposited `$D` and then credit less than `$D` without an explicit separately agreed product specification.

### 4.3 Settlement and liquidity

**Confirmed.** Polar applies a seven-day settlement delay before transaction funds become available for payout by default for organizations created on or after May 12, 2026; older organizations retain instant payout availability. Polar may extend the delay or hold transactions for refund-policy, risk, or compliance reasons. Withdrawals are manual, processed in batches after initiation, typically take 4–7 business days, have minimum thresholds, and incur Stripe payout fees ([Polar payouts](https://polar.sh/docs/features/finance/payouts)). The ModelPass organization's actual settlement terms are unknown.

**Engineering implication.** Posting Balance at `order.paid` makes the Customer's value usable before Polar cash necessarily reaches ModelPass. ModelPass must model the working capital needed to pay OpenRouter during settlement, payout, review, refund, and dispute holds; `order.paid` confirms the Customer payment, not merchant liquidity. Delaying Customer credit until payout would avoid that mismatch but would be a materially different product experience and is not required by Polar's order lifecycle.

## 5. United States tax and product acceptance

### 5.1 What Polar confirms generally

Polar states that, as Merchant of Record/reseller, it handles calculation, collection, and remittance of sales taxes, including US sales tax ([Merchant of Record](https://polar.sh/docs/merchant-of-record/introduction)). Its tax presentation has three options:

- location-based (default),
- inclusive, or
- exclusive.

Location-based presentation is exclusive in the United States, Canada, and India: tax is added on top of the listed price. Polar says tax is itemized at checkout and on receipts, and tax behavior changes presentation—not taxability or the effective rate ([Tax Inclusive Pricing](https://polar.sh/docs/features/tax-inclusive-pricing)). The current checkout schema also says US Customers always provide their full billing address, regardless of the generic `require_billing_address` setting ([checkout API reference](https://polar.sh/docs/api-reference/checkouts/create-checkout-session)).

Polar's merchant balance excludes captured tax and Polar fees; the finance ledger shows associated fees ([Polar account balance](https://polar.sh/docs/features/finance/balance)). Thus, for an approved tax-exclusive US flow, the intended presentation is:

```text
Chosen Deposit / order net amount:  $D
Sales tax, if applicable:            $T
Customer card total:                 $D + $T
ModelPass Balance credited:          $D
```

### 5.2 What is not confirmed

**Needs written Polar confirmation.** Polar's AUP also places “AI Content Generation tools (text, image, video, voice)” in a restricted category requiring closer review and says those businesses may not be accepted; it separately prohibits marketplaces that sell others' products or services for upfront payment ([Polar AUP](https://polar.sh/legal/acceptable-use-policy)). Public documentation does not answer any of these ModelPass-specific questions:

1. Whether the intended personal, reloadable, non-transferable, non-withdrawable Balance is acceptable under the AUP clause covering services that facilitate “balances for customers,” and whether ModelPass's multi-provider AI service is accepted under the AI-review and marketplace clauses.
2. Whether Polar treats a Deposit as the sale of ModelPass AI service at funding, stored value/gift-like value, or another product.
3. Whether US sales tax is due at Deposit, at AI-service consumption, or under a state-specific rule; what Polar product/tax code will be used; and whether ModelPass must report later consumption to Polar.
4. Whether any later Usage Charge could be viewed as a second taxable sale after tax was collected on the Deposit.
5. Whether refunds/cash-redemption required by applicable law are supported for this product structure.

The AUP simultaneously recognizes software/SaaS as generally acceptable and contains the balance-related prohibition; this briefing does not interpret that contract or provide legal advice. A written, account-specific approval should describe the exact facts: USD-denominated Balance, usable only by the authenticated Customer for ModelPass AI inference, no transfer, no withdrawal except required/refund cases, no interest, no peer-to-peer payments, and ModelPass—not Polar—maintaining the usage ledger.

## 6. Webhook lifecycle, verification, retries, ordering, and idempotency

### 6.1 Confirmed lifecycle and delivery behavior

Relevant public webhook events are ([Webhook Events](https://polar.sh/docs/integrate/webhooks/events)):

- `checkout.created`, `checkout.updated`, `checkout.expired`;
- `order.created`, `order.updated`, `order.paid`, `order.refunded`; and
- `refund.created`, `refund.updated`.

`order.paid` is the Deposit fulfillment trigger because Polar defines it as fully processed with payment received ([`order.paid`](https://polar.sh/docs/api-reference/orderpaid)). `order.refunded` fires for both full and partial refunds; `refund.created` fires regardless of refund status, and `refund.updated` carries status changes ([`order.refunded`](https://polar.sh/docs/api-reference/orderrefunded), [`refund.created`](https://polar.sh/docs/api-reference/refundcreated), [`refund.updated`](https://polar.sh/docs/api-reference/refundupdated)).

Polar follows Standard Webhooks and its SDK validates and parses a webhook from the **raw body**, headers, and endpoint secret. The current Express example uses `express.raw` and `validateEvent`, matching this repository's basic setup ([webhook validation](https://polar.sh/docs/integrate/webhooks/delivery#validate--parse-webhooks)).

On delivery failure, Polar retries up to 10 times with exponential backoff. It times out after 10 seconds, recommends responding within 2 seconds and queuing background work, treats redirects as failures, and disables an endpoint after 10 consecutive failed deliveries; organization members are emailed when disabled ([webhook failure handling](https://polar.sh/docs/integrate/webhooks/delivery#failure-handling)). The dashboard retains delivery history/payloads and permits redelivery.

### 6.2 Ordering is unspecified

**Confirmed absence of a guarantee.** No reviewed Polar documentation, OpenAPI, SDK schema, or source documentation promises ordering across event types or retry attempts. Some docs describe logical state sequences, but that is not a delivery-order guarantee. ModelPass must therefore accept duplicates, stale events, a refund update before an order-refunded delivery, and delivery after API reconciliation.

### 6.3 Recommended receiver and idempotency model

**Engineering inference.** The HTTP handler should only:

1. retain the raw body;
2. validate the signature;
3. durably enqueue/store the validated payload and relevant Standard Webhooks headers under a unique receipt key; and
4. return 2xx within two seconds.

A worker should fetch current provider state when needed and transact Balance/journal changes. A verified but permanently mismatched payload should be acknowledged after durable quarantine and alerted; repeatedly returning 422, as the current paid-order handler does for unknown identity/product (`src/billing/webhook.ts:39-51`), consumes retries and can contribute to endpoint disablement without making the payload valid.

Use provider business resources—not arrival order—as monetary idempotency keys:

| Resource/state | Suggested key and effect |
|---|---|
| Paid order | `polar:order:{orderId}:deposit`; post the Deposit once. The current unique external-ID index already supports this shape. |
| Refund | Persist provider state by `refundId`; post a compensating Balance reversal only once when status becomes `succeeded`, e.g. `polar:refund:{refundId}:succeeded`. `pending`, `failed`, and `canceled` are not monetary reversals. |
| Order refund total | Treat `order.refunded_amount` and `refundable_amount` as cumulative reconciliation state, not as a new delta on every duplicate `order.refunded`. Reconcile them against succeeded refund resources. |
| Dispute | Persist by `disputeId` and status; use separate keys for any opened hold/suspension, final loss, and won release/reinstatement. Exact local policy belongs to #21. |

Run scheduled reconciliation of checkouts/orders, refunds, and disputes even when webhooks appear healthy. Webhook retries and endpoint disabling make provider API state—not a delivery log—the final recovery source.

## 7. Refund behavior and ModelPass implications

### 7.1 Confirmed Polar refund behavior

Polar supports full and partial refunds from the dashboard and API. The API accepts an integer **net** amount in cents with minimum 1 and links the refund to an order. Current refund statuses are `pending`, `succeeded`, `failed`, and `canceled` ([Create Refund](https://polar.sh/docs/api-reference/refunds/create-refund), [OpenAPI Refund schemas](https://polar.sh/docs/openapi.json)).

The maximum refundable amount is the order's net amount minus previous refunds, accounting for any Polar customer balance applied to the order. Polar automatically refunds the corresponding tax: all remaining tax on a full refund, proportional tax on a partial refund. The initial payment fee is not returned ([Manage Refunds](https://polar.sh/docs/features/refunds#whats-refundable)). Order status becomes `partially_refunded` or `refunded`, and order/refund resources expose refunded net and tax separately ([Orders](https://polar.sh/docs/features/orders#order-status), [Get Order](https://polar.sh/docs/api-reference/orders/get-order)).

Polar reserves the right to issue refunds within 60 days to prevent chargebacks, even if ModelPass says “no refunds.” It may automatically refund lower-value transactions after an early chargeback signal ([Manage Refunds](https://polar.sh/docs/features/refunds)).

### 7.2 Recommended Balance treatment

**Engineering inference.** Because only `net_amount` was credited, a succeeded Polar refund of `refund.amount` should create an immutable compensating entry reducing Balance by exactly that net refund amount. `refund.tax_amount` returns tax to the card and must not alter Balance. Never delete or mutate the original Deposit.

ModelPass-controlled refunds should be limited to attributable, unspent, unheld Deposit value. Before calling Polar, reserve the local refundable amount; only finalize its reversal on provider `succeeded`, and release the reservation on `failed`/`canceled`. Multiple partial refunds require one local reversal per refund ID and a reconciliation invariant:

```text
sum(succeeded Polar refund.amount for order)
  == order.refunded_amount
  == sum(ModelPass compensating Deposit reversals for order)
```

Polar can force a refund after Balance has been spent. In that case, do not create spendable negative Balance and do not undo settled Usage Charges. Suspend further spending as policy requires, reverse only available/held value atomically, and record the unrecovered portion as a separate payment shortfall for #21 to define. ModelPass bears both that shortfall and the non-returned transaction fee.

## 8. Disputes and chargebacks

### 8.1 Confirmed Polar behavior

- Customers can file chargebacks up to **120 days** after a transaction. Polar monitors a 0.4% merchant chargeback threshold and may refund transactions, hold payouts through the chargeback window, pause future payments, or block an account if risk is not reduced ([Account reviews — Chargeback Management](https://polar.sh/docs/merchant-of-record/account-reviews#chargeback-management)).
- A formal dispute costs **$15 regardless of outcome**, deducted from the merchant balance ([Polar fees — Dispute/Chargeback Fees](https://polar.sh/docs/merchant-of-record/fees#disputechargeback-fees)).
- Current dispute statuses are `prevented`, `early_warning`, `needs_response`, `under_review`, `lost`, and `won`. The dispute resource has amount, tax amount, currency, reason, order/payment IDs, `evidence_due_by`, `past_due`, Customer, and resolved/closed flags. The API can list/filter disputes, get one, and accept one (concede it as lost) ([Polar OpenAPI 2026-04](https://polar.sh/docs/openapi.json)). The case-specific `evidence_due_by` is the authoritative response deadline; no single fixed evidence period is promised.
- A prevented dispute is represented by a proactive refund; Polar's Refund resource can include the associated dispute. Current Polar source records a withdrawal for a resolved dispute and reinstates the disputed amount when status is won; a lost dispute reverses organization balance. The dispute fee remains independently charged ([current dispute transaction source](https://github.com/polarsource/polar/blob/e3fc593745de64c8742442162251cd1c0cf9ebbf/server/polar/transaction/service/dispute.py#L66-L203), [Refund schema](https://polar.sh/docs/openapi.json)).

### 8.2 No public dispute webhook

**Confirmed.** The current public `WebhookEventType` enum and webhook-event guide contain no dispute-created, dispute-updated, or dispute-closed event. The repository's installed 0.48.1 webhook parser likewise recognizes order/refund events but no dispute event (`node_modules/.pnpm/@polar-sh+sdk@0.48.1/node_modules/@polar-sh/sdk/src/webhooks.ts:85-108`). Dispute list/get APIs exist, so periodic polling is technically possible, but detection latency and rate limits need an operational specification.

**Needs written Polar confirmation:** ask whether there is an account notification, support-case workflow, webhook roadmap, recommended polling cadence, API rate limit, evidence-submission workflow, and sandbox procedure for each dispute status. Do not invent a notification guarantee.

### 8.3 Recommended local response

**Engineering inference.** Until #21 decides the exact policy:

1. Poll disputes by modification/creation time and reconcile by `disputeId`; alert immediately on `early_warning` or `needs_response`.
2. A prevented dispute follows the normal succeeded-refund path.
3. On a formal dispute, prevent the disputed Customer from consuming the at-risk Deposit amount—by hold, suspension, or compensating pending-reversal policy—rather than waiting silently for `lost` after Balance can be spent.
4. On `lost`, make the reversal final and record any amount already spent as a shortfall; do not rewrite Usage Charges.
5. On `won`, release the dispute hold or post a compensating reinstatement once. Do not assume Polar returns the $15 fee; its fee page says the fee applies regardless of outcome.
6. Reconcile `dispute.amount`, `dispute.tax_amount`, order `net_amount`, and prior refunds. Quarantine partial or inconsistent mappings instead of assuming every chargeback equals the original full Deposit.

## 9. Sandbox and testability

### 9.1 Confirmed sandbox support

Polar provides a dedicated sandbox isolated from production, with separate accounts, organizations, API base URL, and access tokens. It supports the checkout funnel and Stripe test cards; the webhook setup guide specifically says sandbox can test purchases, subscriptions, cancellations, and refunds without real money ([Sandbox Environment](https://polar.sh/docs/integrate/sandbox), [Setup Webhooks](https://polar.sh/docs/integrate/webhooks/endpoints)). The Polar CLI can relay local webhook deliveries.

The repository already defaults to sandbox unless `POLAR_SERVER === "production"` (`src/billing/packages.ts:46-48`) and refuses unsafe production checkout without webhook configuration (`src/billing/packages.ts:50-56`). That guard should remain.

### 9.2 Required provider integration matrix

**Engineering inference.** Before production, run real sandbox tests—not only mocked SDK tests—for:

- dashboard custom/PWYW USD at ModelPass minimum, typical amounts, maximum, and attempted values outside both bounds;
- verify that the preset is only an initial value and the Customer can edit it within configured bounds;
- US billing addresses in taxing and non-taxing outcomes; verify amount, net, tax, total, receipt, metadata, product, Customer, and currency fields;
- discount code attempts with `allow_discount_codes: false`;
- success redirect before and after webhook processing; no redirect-based credit;
- duplicate/redelivered `order.paid`, delayed delivery, temporary 500, and stale/reordered events;
- one partial refund, multiple partial refunds, full remaining refund, failed/canceled refund if the sandbox can induce them, and Polar-side proactive refund if support can trigger it;
- webhook signature failure and raw-body mutation;
- reconciliation after intentionally dropping order/refund deliveries; and
- dispute creation, win, loss, deadline, fee, and notification **only if Polar provides a documented sandbox method**.

**Needs written Polar confirmation.** The reviewed sandbox docs do not promise a dispute simulator or state transitions. A Stripe dispute test card is not automatically a promise that Polar's sandbox exposes Polar dispute resources/events correctly; obtain a Polar-supported procedure.

## 10. Confirmed facts vs. inferences vs. open provider questions

### Confirmed facts

- Ad-hoc fixed and custom prices can be created per checkout.
- USD paid-price floor is 50 cents; custom prices have documented min/preset/max fields and a $999,999.99 USD maximum. Current Polar source enforces that ceiling for fixed prices too, but the public fixed-price field description does not promise it.
- `order.paid` is the correct confirmed-payment event; order fields separate net, tax, total, refunds, Customer, product, checkout, and metadata.
- Polar handles tax generally as MoR and US location-based presentation is tax-exclusive and itemized.
- Current published fees, non-refundable original transaction fees, $15 dispute fee, and up-to-120-day chargeback window apply as described above.
- Full and partial refunds, automatic proportional tax refunds, refund statuses, signed webhooks, ten retry attempts, delivery timeout, and endpoint disablement are documented.
- The current public webhook catalog has no dispute event; the current API does have dispute resources.
- The repository currently fulfills fixed packages only and ignores refund/dispute effects.

### Engineering inferences/recommendations

- Use one dashboard-created catalog **custom/pay-what-you-want** USD price; the Customer chooses in Polar checkout within configured bounds.
- Credit verified `net_amount` as the authoritative chosen Deposit and never credit tax/total or silently net fees.
- Disable discounts, forward trusted Customer IP, persist a server-side intent, and validate Customer/product/currency/amount/metadata before posting.
- Queue webhooks, process idempotently without relying on order, and periodically reconcile provider APIs.
- Use immutable compensating entries for refunds/disputes and a separate shortfall concept if value was spent.
- Do not launch on Starter economics without an explicit subsidy/fee/business-model decision.

### Questions requiring written Polar confirmation

Send Polar the exact product description and request written answers to:

1. **AUP/acceptance:** Is ModelPass allowed to use Polar checkout for a personal USD-denominated Balance that is reloadable, non-transferable, non-interest-bearing, nonwithdrawable except refunds/legal requirements, and usable only for the Customer's ModelPass AI inference across third-party model providers? Do the AUP's “balances for customers,” AI-content-generation review, or marketplace provisions apply?
2. **MoR product:** What precisely will Polar be reselling on the order/receipt—Balance value, future AI service, or another approved digital product—and what product description must ModelPass show?
3. **US tax:** Which tax category/code applies; is tax due at Deposit or consumption; is exclusive checkout presentation correct; and does ModelPass need to report later Usage Charges or location changes?
4. **Limits/risk:** What account-specific minimum/maximum, velocity, reserve, or fraud controls will Polar impose on customer-chosen Deposits? Are the configured custom-price bounds fully enforced in production?
5. **Fees:** Which plan/rates apply to the ModelPass organization, is the percentage assessed on tax-inclusive card total in all cases, and are there reserves or account-specific fees?
6. **Refunds:** Does Polar support ModelPass's intended unspent-Balance refund policy and any legally required cash redemption? Confirm proactive-refund notification and refund status semantics.
7. **Disputes:** What notification and evidence workflow should be used without dispute webhooks; what polling cadence/rate limit is supported; and exactly what amount/tax/fee is withdrawn and reinstated on open/lost/won states?
8. **Sandbox:** How can ModelPass induce proactive refunds, failed/canceled refunds, early warnings, formal disputes, wins, losses, and the $15 fee in sandbox?
9. **SDK/API:** Which versioned TypeScript SDK/API should a new integration target, and for how long is the current webhook payload contract supported?

## 11. Decision and acceptance checklist for issue #15

### Provider gates — all required before production approval

- [ ] Polar gives written, account-specific approval for the exact prepaid ModelPass Balance use case under its current AUP.
- [ ] Polar gives written US tax/product characterization, including the tax point and receipt/product wording.
- [ ] The organization plan, transaction fee base, international-card treatment, reserves, refund economics, and payout costs are recorded.
- [ ] Polar confirms supported custom-price amount limits and any velocity/risk controls.
- [ ] Polar documents the refund and dispute operations/notification path, including a supported polling cadence if dispute webhooks remain absent.
- [ ] Issue #16's legal/compliance work independently approves the product constraints. Polar's MoR role is not a substitute for ModelPass's own prepaid-balance analysis.

### Engineering acceptance

- [ ] A current Polar SDK/API version is pinned; generated checkout/order/refund/dispute schemas are captured in tests.
- [ ] One dedicated one-time product uses a dashboard-created custom/pay-what-you-want USD catalog price with explicit minimum, maximum, and preset amounts.
- [ ] Checkout uses that product; discount codes are disabled; trusted Customer IP and external Customer ID are sent.
- [ ] A durable Deposit intent exists before redirect and binds Customer, checkout, product, currency, metadata, and policy version; the paid Order supplies the authoritative chosen amount.
- [ ] Only a signature-verified `order.paid` can post a Deposit; success/return URLs cannot.
- [ ] Posting validates paid status, Customer, US eligibility, product, checkout, USD, configured amount bounds, resulting Balance policy, zero discount, and zero Polar customer-balance application; Balance credits net only.
- [ ] Webhook ingestion durably queues within two seconds, tolerates duplicate/stale/reordered delivery, and alerts before endpoint disablement.
- [ ] Order posting is idempotent by order ID; refund and dispute transitions have separate idempotent provider keys.
- [ ] Full, multiple partial, forced, failed, and canceled refund paths are implemented with immutable compensating entries and tax excluded from Balance.
- [ ] Dispute polling/reconciliation handles prevented/open/lost/won states, deadlines, suspension/holds, and spent-value shortfalls without mutating Usage Charges.
- [ ] Scheduled order/refund/dispute reconciliation can recover deliberately dropped webhooks.
- [ ] The full sandbox matrix in section 9 passes with captured payloads and amount/tax/fee assertions.
- [ ] Product policy explicitly states whether ModelPass absorbs payment fees, adds a disclosed funding fee, changes plan/processor, or revisits the 5% markup.

### Decision

**Issue #15's technical question is answered and the checkout path is selected: use a dashboard-created custom/pay-what-you-want USD product, treat the signature-verified paid Order's `net_amount` as the Customer's Deposit, and exclude tax and Polar fees from Balance. Polar has the required checkout, order, tax-display, and refund primitives; disputes require API reconciliation because there is no public dispute webhook. Written use-case approval and product-specific US tax characterization remain production launch gates tracked by the planning map rather than reasons to leave this research ticket open.**
