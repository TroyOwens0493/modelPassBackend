# Credit Page Specification

## 1. Purpose

The credit page lets users understand their current prepaid balance, buy more credits through Polar.sh, and review recent credit activity. It should make the billing flow simple while keeping sensitive payment handling inside Polar.sh.

## 2. Primary Goals

1. Show the current credit balance clearly.
2. Show available credit purchase packages.
3. Send the user to Polar.sh checkout for purchases.
4. Show recent credit transactions.
5. Explain how credits are used when chatting with models.

## 3. Users and Permissions

- Only authenticated users can access the credit page.
- A user can only view their own balance and transactions.
- Payment details are handled by Polar.sh and should not be stored or displayed directly by ModelPass.

## 4. Page Route

Frontend route:

- `/credits`

Backend endpoints:

- `GET /api/billing`
- `POST /api/billing/checkout`
- `POST /api/billing/webhook`

## 5. User Stories

1. As a logged-in user, I want to see my credit balance so I know whether I can keep chatting.
2. As a logged-in user, I want to buy a package of credits so I can continue using AI models.
3. As a logged-in user, I want to see recent credit activity so I understand where my credits went.
4. As a logged-in user, I want checkout to happen through a trusted billing provider so I do not enter card details directly into ModelPass.
5. As a logged-in user, I want clear feedback after returning from checkout so I know whether my balance updated.

## 6. Layout Requirements

### Desktop Layout

Use a focused billing layout with these sections:

1. Page header.
2. Balance summary card.
3. Credit package cards.
4. Recent transaction history.
5. Credit usage explanation.

The purchase packages should be visually prominent and easy to compare.

### Mobile Layout

Stack sections vertically. Package cards should become full-width cards with clear price, credit amount, and purchase button.

## 7. Page Sections

### Header

Content:

- Title: `Credits`
- Short description: `Buy credits and track your ModelPass usage.`

Actions:

- Optional secondary action: `Back to chat`

### Balance Summary Card

Purpose: show the most important billing value immediately.

Fields:

- Current credit balance.
- Optional low-balance warning if balance is below a chosen threshold.
- Optional lifetime credits used.

Suggested states:

- Healthy balance: neutral message.
- Low balance: `Your balance is running low. Add credits before your next long chat.`
- Zero balance: `You are out of credits. Buy credits to send more messages.`

### Credit Package Cards

Purpose: let users select a package and start checkout.

Each package should show:

- Package name.
- Credit amount.
- Price.
- Optional best-value label.
- Purchase button.

Suggested starter packages:

- Starter: 100 credits.
- Plus: 500 credits.
- Pro: 1,200 credits.

The final prices should match Polar.sh product configuration.

Behavior:

- Packages load from `GET /api/billing` or shared backend config.
- Clicking purchase calls `POST /api/billing/checkout`.
- Backend returns a checkout URL.
- Frontend redirects the browser to the checkout URL.
- Purchase buttons show loading state while checkout is being created.
- Disable duplicate clicks while checkout request is in progress.

### Recent Transactions

Purpose: show a short ledger of credit changes.

Fields:

- Date.
- Transaction type.
- Credit amount.
- Optional description.
- Balance after transaction.

Transaction types:

- Purchase.
- Usage.
- Refund.
- Adjustment.
- Bonus.

Display rules:

- Positive credit amounts should be visually distinct from negative usage amounts.
- Do not rely on color alone; include plus or minus signs.
- Show newest transactions first.
- Limit initial list to the most recent 10 or 20 transactions.

### Credit Usage Explanation

Purpose: reduce confusion about how credits are consumed.

Content should explain:

- Credits are prepaid.
- Different models may cost different amounts.
- Longer prompts and responses may use more tokens and therefore more credits.
- Payment information is handled by Polar.sh.

## 8. Data Contract

### `GET /api/billing` Response

Expected response:

```json
{
  "balance": {
    "creditBalance": 100,
    "creditsUsed": 25,
    "tokensUsed": 12000
  },
  "packages": [
    {
      "id": "starter",
      "name": "Starter",
      "credits": 100,
      "price": "$5.00",
      "polarProductId": "polar_product_id",
      "highlight": false
    },
    {
      "id": "plus",
      "name": "Plus",
      "credits": 500,
      "price": "$20.00",
      "polarProductId": "polar_product_id",
      "highlight": true
    }
  ],
  "transactions": [
    {
      "id": "transaction_id",
      "type": "purchase",
      "credits": 100,
      "balanceAfter": 100,
      "description": "Starter credit package",
      "createdAt": "2026-07-02T00:00:00.000Z"
    }
  ]
}
```

Notes:

- `polarProductId` can be omitted from the frontend response if the backend maps package ids internally.
- Prefer using package ids from the app in checkout requests instead of exposing provider ids.

### `POST /api/billing/checkout` Request

Expected request:

```json
{
  "packageId": "starter"
}
```

Rules:

- `packageId` must match a configured active package.
- Backend must derive the user from the authenticated session.
- Backend must create or reuse the user's Polar customer.

### `POST /api/billing/checkout` Response

Expected response:

```json
{
  "checkoutUrl": "https://checkout.polar.sh/..."
}
```

### `POST /api/billing/webhook`

Purpose:

- Receive Polar.sh events.
- Verify webhook signature.
- Apply credit purchases.
- Avoid double-applying the same event.

Important behavior:

- The route should not require normal user session auth because Polar.sh calls it server-to-server.
- It must verify the Polar webhook signature.
- It must store the external event id in the credit transaction ledger.
- It must ignore or safely handle duplicate events.

## 9. Credit Accounting Rules

### Balance Updates

- Purchases add credits.
- Chat usage subtracts credits.
- Refunds subtract credits or create a correcting transaction, depending on desired business rule.
- Adjustments may add or subtract credits.
- Balance must never become negative.

### Transaction Ledger

Every credit balance change should create a transaction record. The transaction record is the audit trail for support, debugging, and user-facing history.

Required transaction fields:

- User id.
- Type.
- Credit amount.
- Balance after.
- Source.
- External id when available.
- Created date.

### Idempotency

Polar webhooks can be retried. The backend must ensure one purchase event only adds credits once. Use a unique external event id or checkout id in the `creditTransactions` collection.

## 10. Checkout Flow Details

### Before Checkout

1. User opens credit page.
2. Frontend calls `GET /api/billing`.
3. User selects a package.
4. Frontend calls `POST /api/billing/checkout` with the selected package id.
5. Backend creates a Polar checkout session.
6. Frontend redirects user to Polar checkout URL.

### After Successful Checkout

1. Polar.sh processes payment.
2. Polar.sh sends webhook to backend.
3. Backend verifies webhook.
4. Backend applies credits and stores transaction.
5. User returns to ModelPass success URL.
6. Frontend refreshes `GET /api/billing`.
7. Updated balance appears.

### After Canceled Checkout

1. User returns to ModelPass cancel URL.
2. Frontend shows a non-error message: `Checkout was canceled. No credits were added.`
3. Balance remains unchanged.

### Delayed Webhook State

Sometimes the user may return before the webhook finishes. If the balance has not updated:

- Show message: `Payment received. Your credits may take a moment to appear.`
- Provide a refresh button.
- Optionally poll `GET /api/billing` briefly after return.

## 11. Loading and Empty States

### Initial Loading

Show page-level loading while balance, packages, and transactions load.

### No Transactions

Show:

- `No credit activity yet.`
- Keep package cards visible so the user can buy credits.

### Package Load Failure

Show:

- `We could not load credit packages.`
- Retry button.

## 12. Error States

### Unauthenticated

If the API returns unauthorized:

- Redirect to login or show a login prompt.
- Do not show cached balance.

### Checkout Creation Failure

Show inline error near package cards:

- `We could not start checkout. Please try again.`

### Invalid Package

If backend rejects package id:

- Refresh billing data.
- Show: `That credit package is no longer available.`

### Webhook Failure

Webhook failures should be logged server-side and return a correct error status to Polar.sh. The frontend should not expose raw webhook errors.

## 13. Accessibility Requirements

- Credit package cards must have clear button labels such as `Buy Starter package`.
- The current balance should be readable by screen readers.
- Loading and checkout states should be announced.
- Transaction amounts must include plus or minus text, not only color.
- Buttons must be keyboard accessible.

## 14. Security Requirements

- Never collect or store credit card details in ModelPass.
- Verify Polar webhook signatures.
- Store API keys and webhook secrets only in environment variables.
- Derive user identity from WorkOS session on checkout creation.
- Do not allow the client to choose arbitrary credit amounts.
- Prevent users from viewing transactions for another account.
- Use HTTPS in deployed environments.

## 15. Implementation Steps

### Backend

1. Define credit packages in backend config.
2. Create `creditTransactions` collection helper.
3. Add indexes for user/date and external id idempotency.
4. Implement `GET /api/billing`.
5. Implement `POST /api/billing/checkout`.
6. Integrate Polar customer creation or lookup.
7. Configure checkout success and cancel URLs.
8. Implement `POST /api/billing/webhook`.
9. Verify webhook signatures.
10. Map successful purchase events to configured credit packages.
11. Apply credits in a way that keeps user balance and transaction ledger consistent.
12. Add tests for valid checkout, invalid package, duplicate webhook, and unauthorized access.

### Frontend

1. Add credit page route.
2. Add API helper functions:
   - `getBillingSummary()`
   - `createCheckoutSession()`
3. Render balance summary card.
4. Render package cards.
5. Render recent transactions.
6. Add checkout loading state per package.
7. Redirect to returned checkout URL.
8. Detect success or cancel query params after checkout return.
9. Refresh billing data after checkout return.
10. Test mobile and desktop layout.

## 16. Acceptance Criteria

- Authenticated users can open the credit page.
- Unauthenticated users cannot view billing data.
- Current credit balance is visible at the top of the page.
- Available packages are displayed with credit amount, price, and purchase action.
- User can start Polar checkout for a valid package.
- Duplicate checkout button clicks are prevented while checkout is loading.
- Successful Polar webhook adds credits to the user balance.
- Duplicate Polar webhook events do not add credits twice.
- Recent transactions show purchases and usage with correct plus or minus amounts.
- Canceled checkout does not add credits and shows a clear non-error message.
- Layout works on mobile and desktop.

## 17. Out of Scope for First Release

- Storing credit card details in ModelPass.
- Subscriptions or recurring billing.
- Promo codes.
- Admin credit adjustments UI.
- Downloadable invoices inside ModelPass.
- Detailed analytics charts.

