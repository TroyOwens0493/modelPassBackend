# ModelPass Billing

The billing context defines how customers prepay for and consume access to AI models.

## Language

**Customer**:
An individual authenticated WorkOS user who owns and spends a personal Balance.
_Avoid_: Organization, team, shared account

**Balance**:
The USD-denominated amount of prepaid funds available to one Customer.
_Avoid_: Credits, credit balance, tokens

**Deposit**:
The Customer-chosen, pre-tax USD amount successfully paid to add to their Balance. It excludes any Funding Fee and tax charged at checkout.
_Avoid_: Credit purchase, package, top-up

**Funding Fee**:
A separately disclosed, non-Balance checkout charge that recovers Polar's confirmed base percentage and fixed transaction fee for a Deposit.
_Avoid_: Processing deduction, Balance fee, hidden fee

**Deposit Intent**:
A Customer-authorized funding attempt that fixes the chosen Deposit and Funding Fee before payment. It is not a Deposit and creates no Balance until its matching Polar Order is validated as paid.
_Avoid_: Pending Deposit, Checkout, payment attempt

**Provider Cost**:
The actual USD amount OpenRouter charges ModelPass for a completed model request.
_Avoid_: Token estimate, listed model price

**Usage Charge**:
The amount deducted from a customer's Balance for a completed model request, equal to the Provider Cost plus a 5% markup.
_Avoid_: Credit cost, model multiplier

**Hold**:
An amount temporarily removed from a Customer's available Balance for an in-progress model request, then captured as a Usage Charge or released when that request is finalized.
_Avoid_: Charge, authorization fee

**Request Budget**:
The validated maximum Usage Charge that an authorized model request can incur, used as its Hold.
_Avoid_: Estimate, spending target, token allowance

**Ledger Entry**:
An immutable record of one Balance event, its exact monetary effect, and the resulting Balance for that Customer.
_Avoid_: Editable transaction, balance snapshot

**Refund Hold**:
An amount temporarily removed from a Customer's available Balance while a voluntary Polar refund is pending, then permanently reversed when the refund succeeds or restored if it fails or is canceled.
_Avoid_: Refund debit, pending refund charge

**Dispute Hold**:
The remaining Balance attributable to a disputed Deposit, made non-spendable until Polar resolves the dispute.
_Avoid_: Chargeback debit, Usage Hold

**Payment Shortfall**:
The portion of a forced Deposit refund or reversal that cannot be removed because its attributable Balance was already spent. It is tracked outside Balance and never creates a negative Balance or an automatic claim on a later Deposit.
_Avoid_: Negative Balance, customer debt

**Usage Bound Shortfall**:
The portion of an authoritative Usage Charge that exceeds its validated Hold. It is absorbed by ModelPass, tracked outside Balance, and never creates Customer debt or a claim on a later Deposit.
_Avoid_: Overage charge, negative Balance, recoverable debt

**Reconciliation**:
The automated comparison of Polar and OpenRouter evidence with ModelPass Holds and Ledger Entries, including idempotent replay of missing local processing only when provider truth is authoritative.
_Avoid_: Balance correction, best-effort sync

**Billing Freeze**:
A restriction that prevents new monetary activity for one Customer when Reconciliation cannot prove their billing state is complete and consistent; their posted Balance remains readable.
_Avoid_: Account suspension, Balance seizure

**Flow Pause**:
A provider-wide restriction that stops new Deposits or model dispatch when the corresponding Reconciliation evidence is stale or unavailable, without changing posted Balances.
_Avoid_: Outage write-off, global Billing Freeze

**Audit Record**:
A restricted internal record linking provider evidence, processing attempts, idempotency decisions, Ledger Entries, Reconciliation outcomes, and freeze transitions without storing secrets or unnecessary prompt or response content.
_Avoid_: Customer activity history, support note
