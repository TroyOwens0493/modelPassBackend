# Issue #24 research: Verify Polar funding-fee checkout representation

**Issue:** [Verify Polar funding-fee checkout representation](https://github.com/TroyOwens0493/modelPassBackend/issues/24)
**Researched:** 2026-08-24 (AKDT)
**Status:** Provider-capability decision based on Polar's current 2026-04 API

## Answer

**Polar can collect the required charge in one checkout, but it cannot represent the Deposit and Funding Fee as separate native checkout or refund line items.** A Polar Checkout selects one Product and exposes one aggregate pre-tax amount, Polar-calculated tax, and one total. The `products` array supplies alternatives the Customer can choose between; it is not an additive cart ([Checkout Session API](https://polar.sh/docs/features/checkout/session), [Create Checkout Session](https://polar.sh/docs/api-reference/checkouts/create-session)).

Use this supported structure:

1. The Customer chooses the Deposit in ModelPass, not in Polar's hosted custom-price control.
2. ModelPass calculates and displays the Deposit, Funding Fee, estimated/then Polar-calculated tax treatment, and pre-tax total before redirect.
3. ModelPass creates a dedicated server-side Deposit Intent containing the exact Deposit, Funding Fee, combined pre-tax amount, Customer, fee-policy version, and cap-capacity reservation.
4. ModelPass creates one Polar checkout with an **ad-hoc fixed price** equal to `Deposit + Funding Fee`. It sends the component amounts and Deposit Intent ID as checkout metadata.
5. Polar displays and charges the aggregate product amount plus its calculated tax.
6. On a signature-verified `order.paid`, ModelPass validates the Order against the immutable Deposit Intent and credits only the Deposit.

This changes the selected price mechanics from the dashboard custom/pay-what-you-want price researched in [Polar customer-chosen Deposits](https://github.com/TroyOwens0493/modelPassBackend/issues/15). That structure lets the Customer edit one amount inside Polar, but Polar has no documented formula field that can dynamically add the Funding Fee to that choice. Locking the choice in ModelPass and passing a per-checkout ad-hoc fixed combined amount preserves both the separately disclosed fee and the per-checkout cap decided in [Define deposit limits and credited-value rules](https://github.com/TroyOwens0493/modelPassBackend/issues/18).

## Confirmed Polar capabilities and limits

### Checkout

Polar documents ad-hoc prices as prices created only for one checkout. A checkout request can map the selected Product ID to a fixed price containing `amount_type: fixed`, integer `price_amount`, and `price_currency`. Checkout metadata is copied to the resulting Order ([Checkout Session API](https://polar.sh/docs/features/checkout/session), [Create Checkout Session](https://polar.sh/docs/api-reference/checkouts/create-session)).

The Checkout schema exposes aggregate `amount`, `discount_amount`, `net_amount`, `tax_amount`, `tax_behavior`, `total_amount`, and `currency`. It has one selected `product_id`. It has no Deposit, surcharge, Funding Fee, merchant fee, or arbitrary line-item input. Although an Order has an `items` response array, the Checkout API provides no cart or arbitrary Order-item creation input for this one-time purchase. Multiple Product IDs are choices in one hosted checkout, not items summed into one purchase ([Create Checkout Session](https://polar.sh/docs/api-reference/checkouts/create-session), [Polar OpenAPI 2026-04](https://polar.sh/docs/openapi.json)).

Therefore:

- Polar is authoritative for the aggregate pre-tax amount, tax, total charge, payment status, and provider identifiers.
- ModelPass is authoritative for allocating the aggregate pre-tax amount between Deposit and Funding Fee.
- Metadata is a machine-readable correlation copy, not an independent Polar calculation or native fee line item. The durable server-side Deposit Intent must remain the trusted source for the split.
- Do not ask the Customer to re-enter or edit the Deposit in Polar, because Polar cannot recalculate ModelPass's Funding Fee from that edited value.

### Paid Order validation

The paid Order exposes aggregate `subtotal_amount`, `discount_amount`, `net_amount`, `tax_amount`, `total_amount`, `currency`, Product/Checkout/Customer IDs, metadata, and Order items. The `order.paid` event means payment was received and the Order was fully processed ([Order paid webhook](https://polar.sh/docs/api-reference/webhooks/order.paid), [Get Order](https://polar.sh/docs/api-reference/orders/get)).

Before crediting Balance, require all of the following:

- the normal verified Customer, Product, Checkout, currency, status, cap, and idempotency checks;
- `discount_amount === 0` and discount codes disabled;
- Order `net_amount === Deposit + Funding Fee` from the stored Deposit Intent;
- Order metadata's Deposit, Funding Fee, intent ID, and fee-policy version exactly match that intent;
- the Funding Fee recomputes exactly from the confirmed policy and rounds upward to the next cent; and
- only the Deposit posts to Balance; Funding Fee and `tax_amount` do not.

Treat any mismatch as inconsistent provider evidence: credit nothing and route it through Reconciliation. Never reconstruct the split solely from editable Customer input or trust metadata without the local intent.

### Refunds

Polar accepts a Refund against one Order for a merchant-chosen positive integer pre-tax amount in cents, limited by the Order's remaining refundable amount. Polar calculates the corresponding tax refund automatically—proportionally for a partial refund and fully for a full remaining refund. Polar does not refund its payment fee ([Create Refund](https://polar.sh/docs/api-reference/refunds/create), [Manage Refunds](https://polar.sh/docs/features/refunds)).

The Refund resource records aggregate `amount`, `tax_amount`, `currency`, `order_id`, status, and metadata. It does not identify a Deposit or Funding Fee component. ModelPass must preserve that allocation in its immutable ledger and Refund metadata:

- **Voluntary unspent-Deposit refund:** request only the refundable Deposit cents; leave the Funding Fee unrefunded under the decided policy. Polar returns the proportional tax it calculates for that partial refund.
- **Exceptional rejected/over-cap payment:** request the full remaining refundable pre-tax Order amount, covering both Deposit and Funding Fee; Polar returns the remaining tax.
- Validate each succeeded Refund against its local Refund Hold/intent and provider Order totals; never infer component allocation from Polar's Refund alone.

The proportional tax behavior means Polar does not expose a separately attributable “tax on Deposit” versus “tax on Funding Fee” for the combined one-product charge. The existing written Polar tax/product-characterization launch gate must explicitly approve this combined taxable representation and its partial-refund outcome.

## Customer disclosure boundary

The current public API proves the aggregate amount/tax representation, but it does not promise that merchant-authored metadata will appear as customer-visible rows in hosted checkout, receipts, or invoices. Consequently:

- ModelPass must show `Deposit`, `Funding Fee`, and `Deposit + Funding Fee` clearly before the Customer selects **Continue to secure checkout**.
- Polar is responsible for the final hosted presentation of its calculated tax and charged total.
- The checkout Product description may explain that the pre-tax product price includes the disclosed Funding Fee, but it is not a substitute for the ModelPass breakdown.
- Before launch, verify the exact hosted checkout, receipt, Order, invoice, partial-refund, and full-refund presentation in Polar sandbox and obtain Polar's already-required written product/tax approval.

## Acceptance conclusion

The exact native three-component representation asked about in the issue is **not supported**. The product rules are nevertheless technically feasible with a **single ad-hoc fixed combined price**, a pre-redirect ModelPass disclosure, an immutable Deposit Intent, copied metadata, strict paid-Order arithmetic validation, and ModelPass-owned refund allocation. No new product decision or follow-up ticket is required; implementation belongs after the Wayfinder specification is complete.
