# ModelPass Master Plan

## 1. Product Goal

ModelPass is a credit-based AI chat application. Users authenticate with WorkOS, purchase prepaid credits through Polar.sh, choose from multiple OpenRouter models, chat through a responsive Svelte interface, and track usage until they need to buy more credits.

The first release should prioritize a smooth end-to-end experience:

1. A user can sign up, log in, and log out.
2. A user can view and edit basic profile preferences.
3. A user can purchase credits and see their current credit balance.
4. A user can start or resume chats.
5. A user can select a model before sending a message.
6. A message request is sent to OpenRouter, stored in MongoDB, and charged against the user's credits.

## 2. Current Starting Point

The backend currently has a basic Express server with MongoDB connection test routes. The frontend is a Vite + Svelte starter app. The project still needs production app structure, route definitions, auth integration, billing integration, chat APIs, data models, and deployment configuration.

## 3. Technology Stack

- Backend: Express, TypeScript, MongoDB, MongoDB Node driver.
- Frontend: Vite, Svelte, TypeScript.
- Authentication: WorkOS.
- Billing and credit purchases: Polar.sh.
- AI provider: OpenRouter.
- Hosting: Netlify for frontend, backend hosting to be chosen or configured separately.
- Source control and project tracking: GitHub, Git, Trello, MS Teams.

## 4. Core User Flows

### Authentication Flow

1. User opens the app.
2. App checks whether a valid WorkOS session exists.
3. If not authenticated, user can choose login or sign up.
4. WorkOS handles authentication.
5. Backend receives or verifies the authenticated WorkOS user.
6. Backend creates or updates the local MongoDB user record.
7. User lands on the chat page or dashboard.

### Credit Purchase Flow

1. User opens the credit or billing page.
2. App requests current balance and available credit packages.
3. User chooses a credit package.
4. Backend creates a Polar.sh checkout session.
5. User completes payment through Polar.sh.
6. Polar.sh sends webhook event to backend.
7. Backend verifies the webhook and adds purchased credits to the user's balance.
8. User returns to the app and sees the updated balance.

### Chat Flow

1. User starts a new chat or opens an existing chat.
2. User selects an AI model.
3. User enters a prompt.
4. Frontend sends the message to the backend.
5. Backend verifies the user has enough credits.
6. Backend sends the request to OpenRouter.
7. Backend receives the model response.
8. Backend calculates token usage and credit cost.
9. Backend stores the user message, model response, model slug, tokens used, credits used, and timestamps.
10. Backend decrements the user's credit balance.
11. Frontend displays the response and updated balance.

### Profile Management Flow

1. User opens the profile page.
2. App loads profile data from WorkOS and MongoDB.
3. User reviews account details, default model, and reply style.
4. User updates editable preferences.
5. Backend validates and saves profile preferences.
6. App confirms the changes and uses them as defaults in chat.

## 5. Data Model Plan

### Users Collection

Purpose: stores application-specific user data that WorkOS and Polar.sh do not own.

Fields:

- `_id`: MongoDB object id.
- `workosUserId`: stable user id from WorkOS.
- `polarCustomerId`: customer id from Polar.sh, nullable until first billing setup.
- `email`: copied from WorkOS for display and lookup convenience.
- `name`: copied from WorkOS when available.
- `creditBalance`: current prepaid credit balance.
- `defaultModel`: preferred model slug.
- `replyStyle`: preferred model response style.
- `tokensUsed`: total lifetime tokens used.
- `creditsUsed`: total lifetime credits used.
- `createdAt`: date user record was created.
- `updatedAt`: date user record was last changed.

Indexes:

- Unique index on `workosUserId`.
- Optional unique sparse index on `polarCustomerId`.
- Index on `email` for support and debugging.

### Chats Collection

Purpose: stores chat metadata and ordered chat messages.

Fields:

- `_id`: MongoDB object id.
- `workosUserId`: owner id from WorkOS.
- `title`: user-facing chat title.
- `model`: current or last-used model slug.
- `messages`: ordered message array.
- `createdAt`: date chat was created.
- `updatedAt`: date chat was last updated.

Message fields:

- `id`: generated message id.
- `timestamp`: message timestamp.
- `issuer`: `user` or `model`.
- `text`: message body.
- `model`: model slug used for model messages.
- `tokensUsed`: token count for the message or response.
- `creditsUsed`: charged credit amount.

Indexes:

- Compound index on `workosUserId` and `updatedAt`.
- Optional index on `workosUserId` and `_id` for ownership checks.

### Models Collection

Purpose: stores supported OpenRouter model metadata and local pricing rules.

Fields:

- `_id`: MongoDB object id.
- `modelSlug`: OpenRouter model identifier.
- `displayName`: user-facing model name.
- `description`: short explanation of the model.
- `cost`: local credit cost rule or multiplier.
- `enabled`: whether the model is available in the selector.
- `createdAt`: date model was added.
- `updatedAt`: date model metadata was changed.

Indexes:

- Unique index on `modelSlug`.
- Index on `enabled`.

### Credit Transactions Collection

Purpose: provides an auditable record of credit changes.

Fields:

- `_id`: MongoDB object id.
- `workosUserId`: user id from WorkOS.
- `polarCustomerId`: billing customer id when available.
- `type`: `purchase`, `usage`, `refund`, `adjustment`, or `bonus`.
- `credits`: positive or negative credit amount.
- `balanceAfter`: user balance after transaction is applied.
- `source`: `polar`, `openrouter-usage`, `admin`, or `system`.
- `externalId`: Polar event id, checkout id, or related provider id.
- `metadata`: provider-specific details.
- `createdAt`: transaction timestamp.

Indexes:

- Compound index on `workosUserId` and `createdAt`.
- Unique sparse index on `externalId` for idempotent webhook processing.

## 6. API Endpoint Plan

All protected API routes should require a valid WorkOS session or token. The backend should never trust a user id sent directly from the client when it can derive the user from the authenticated session.

### Auth

- `GET /login`: redirects user to WorkOS login.
- `GET /sign-up`: redirects user to WorkOS sign-up.
- `POST /logout`: clears session and logs user out.
- `GET /api/session`: returns authenticated user summary and app profile state.
- `POST /api/auth/callback`: handles WorkOS callback if the selected WorkOS integration requires a backend callback.

### Profile

- `GET /api/profile`: returns account details, preferences, usage totals, and billing customer state.
- `PATCH /api/profile`: updates editable preferences such as default model and reply style.

### Credits and Billing

- `GET /api/billing`: returns credit balance, available packages, and recent credit transactions.
- `POST /api/billing/checkout`: creates a Polar.sh checkout session for the selected package.
- `POST /api/billing/webhook`: receives Polar.sh billing events and applies credit purchases.

### Models

- `GET /api/models`: returns enabled model list for the model selector.

### Chats

- `GET /api/chats`: returns the user's chat list.
- `POST /api/chats`: creates a new chat.
- `GET /api/chats/:chatId`: returns one chat and its messages after ownership validation.
- `PATCH /api/chats/:chatId`: updates chat title or selected model.
- `DELETE /api/chats/:chatId`: deletes or archives a chat.
- `POST /api/chats/:chatId/messages`: sends a user message to the selected model and stores the response.

## 7. Backend Implementation Steps

### Step 1: Project Setup

1. Add standard backend scripts: `dev`, `build`, `start`, and `typecheck`.
2. Create a backend source structure:
   - `src/server.ts`
   - `src/config.ts`
   - `src/db.ts`
   - `src/middleware/auth.ts`
   - `src/routes`
   - `src/services`
   - `src/types`
3. Load required environment variables:
   - `MONGODB_URI`
   - `MONGODB_DB_NAME`
   - `WORKOS_API_KEY`
   - `WORKOS_CLIENT_ID`
   - `WORKOS_COOKIE_PASSWORD` or session secret.
   - `POLAR_ACCESS_TOKEN`
   - `POLAR_WEBHOOK_SECRET`
   - `OPENROUTER_API_KEY`
   - `FRONTEND_URL`
4. Add startup validation so the server fails fast when required configuration is missing.

### Step 2: Database Foundation

1. Replace the temporary `sleepOutside` database name with the ModelPass database name from config.
2. Create collection helpers for users, chats, models, and credit transactions.
3. Create an index setup function that runs on startup.
4. Add reusable helper functions for converting MongoDB documents into API response objects.

### Step 3: Authentication Integration

1. Choose the exact WorkOS flow for the project: AuthKit or custom redirect flow.
2. Add login, sign-up, logout, callback, and session routes.
3. Create middleware that verifies the authenticated user.
4. Create `getOrCreateUserProfile()` so every authenticated user has a local `users` document.
5. Return a safe user object to the frontend without exposing secrets or provider internals.

### Step 4: Profile API

1. Implement `GET /api/profile`.
2. Implement `PATCH /api/profile`.
3. Validate editable fields:
   - `defaultModel` must be an enabled model.
   - `replyStyle` must be one of the supported values.
4. Ensure profile updates cannot modify WorkOS-owned fields such as authentication id.
5. Add error responses for unauthenticated requests and invalid preference values.

### Step 5: Model Catalog

1. Decide the initial OpenRouter models to support.
2. Seed the `models` collection with model slug, display name, description, and cost.
3. Implement `GET /api/models`.
4. Use the enabled model list in both profile defaults and the chat model selector.

### Step 6: Billing and Credits

1. Define credit packages, prices, and package ids.
2. Implement `GET /api/billing`.
3. Implement `POST /api/billing/checkout`.
4. Create or reuse the Polar customer linked to the current user.
5. Implement Polar webhook verification.
6. Handle successful purchase events idempotently.
7. Add credit purchase transactions and update `users.creditBalance`.
8. Add recent transaction history for display on the credit page.

### Step 7: Chat Storage

1. Implement chat list, chat creation, chat detail, chat update, and chat deletion routes.
2. Validate chat ownership on every chat id.
3. Generate a default title from the first user message or use `New Chat`.
4. Store messages in timestamp order.
5. Update `updatedAt` whenever a chat changes.

### Step 8: OpenRouter Message Sending

1. Implement an OpenRouter service wrapper.
2. Validate selected model is enabled.
3. Check the user's credit balance before sending.
4. Send user prompt and previous chat context to OpenRouter.
5. Parse response text and token usage.
6. Convert token usage to credit cost using local pricing rules.
7. Store the user message and model response.
8. Decrement user credit balance and create a usage transaction.
9. Return the new messages and updated balance to the frontend.

### Step 9: Error Handling and Security

1. Add centralized error handling middleware.
2. Return consistent JSON error shapes.
3. Add Helmet and CORS configuration for the deployed frontend origin.
4. Avoid logging full prompts, secrets, payment data, or auth tokens.
5. Validate request bodies before using them.
6. Make Polar webhook processing idempotent.
7. Prevent negative credit balances.

### Step 10: Backend Testing

1. Add tests for config validation.
2. Add tests for profile update validation.
3. Add tests for credit transaction idempotency.
4. Add tests for chat ownership checks.
5. Add tests for insufficient-credit message sending.
6. Add manual test scripts for WorkOS, Polar sandbox, and OpenRouter requests.

## 8. Frontend Implementation Steps

### Step 1: App Structure

1. Add a simple client-side routing approach or decide whether to introduce a router package.
2. Create route-level pages:
   - Chat page.
   - Profile page.
   - Credit page.
   - Login or landing page.
3. Create shared layout components:
   - App shell.
   - Header.
   - Navigation.
   - Loading state.
   - Error message.
4. Create API helpers for backend requests.

### Step 2: Session State

1. Add a session store that calls `GET /api/session`.
2. Track loading, authenticated, unauthenticated, and error states.
3. Hide protected pages when the user is not logged in.
4. Show login and sign-up actions for unauthenticated users.

### Step 3: Chat Interface

1. Build responsive chat layout.
2. Add chat list sidebar.
3. Add message display area.
4. Add prompt input area.
5. Add model selector.
6. Show current credit balance.
7. Disable sending when there are no credits, no model, or empty prompt.
8. Show streaming or loading state while waiting for the backend response.

### Step 4: Profile Page

1. Implement the profile page from `profile-page-spec.md`.
2. Load profile and model options.
3. Save editable preferences.
4. Reflect updated defaults in the chat experience.

### Step 5: Credit Page

1. Implement the credit page from `credit-page-spec.md`.
2. Load credit balance, packages, and recent transactions.
3. Start Polar checkout from package cards.
4. Refresh balance after returning from checkout.

### Step 6: Styling and Responsiveness

1. Define global design tokens for colors, spacing, typography, and borders.
2. Use responsive layouts for mobile, tablet, and desktop.
3. Keep chat, profile, and credit pages visually consistent.
4. Ensure key actions are accessible by keyboard.
5. Add empty, loading, success, and error states.

### Step 7: Frontend Validation

1. Run Svelte type checks.
2. Test login and logout manually.
3. Test protected route behavior.
4. Test profile preference save.
5. Test credit checkout initiation.
6. Test chat message sending with enough and not enough credits.

## 9. Deployment Plan

### Frontend

1. Configure Netlify project for `modelPassFrontEnd`.
2. Set build command to `npm run build` or the package manager equivalent.
3. Set publish directory to the Vite output directory.
4. Configure environment variable for backend API base URL.
5. Add redirect rules if using client-side routing.

### Backend

1. Choose backend hosting that supports a persistent Express server.
2. Configure environment variables.
3. Configure allowed CORS origin for the deployed Netlify URL.
4. Configure WorkOS redirect URLs for deployed frontend/backend URLs.
5. Configure Polar webhook URL.
6. Verify MongoDB network access from the backend host.

## 10. Milestone Plan

### Milestone 1: Foundation

Goal: app runs locally with clean structure and database access.

Deliverables:

- Backend scripts and config validation.
- MongoDB connection helper.
- Basic frontend app shell.
- API helper setup.

Exit criteria:

- Backend starts locally.
- Frontend starts locally.
- Frontend can call a backend health endpoint.

### Milestone 2: Authentication and Profile

Goal: users can authenticate and manage profile preferences.

Deliverables:

- WorkOS login, sign-up, logout, and session handling.
- Local user creation.
- Profile API.
- Profile page.

Exit criteria:

- New user can sign up and receive a local user record.
- Logged-in user can view and update profile preferences.

### Milestone 3: Billing and Credits

Goal: users can buy and track credits.

Deliverables:

- Credit package definitions.
- Polar checkout route.
- Polar webhook handler.
- Credit transaction collection.
- Credit page.

Exit criteria:

- Sandbox purchase adds credits exactly once.
- User can view current balance and recent transactions.

### Milestone 4: Chat and Models

Goal: users can chat with selected AI models and spend credits.

Deliverables:

- Model catalog.
- Chat CRUD endpoints.
- OpenRouter service.
- Message sending endpoint.
- Responsive chat UI.

Exit criteria:

- User can create a chat, select a model, send a prompt, receive a response, and see credits decrease.

### Milestone 5: Polish, Testing, and Deployment

Goal: app is ready for demo or release.

Deliverables:

- Error handling pass.
- Responsive UI pass.
- Security review of auth, billing, and secret handling.
- Manual QA checklist.
- Netlify frontend deployment.
- Backend deployment.

Exit criteria:

- Core flows work in deployed environment.
- No known blocker bugs remain for the planned demo.

## 11. Suggested Trello Work Breakdown

- Backend foundation and config.
- MongoDB collections and indexes.
- WorkOS authentication routes.
- Session middleware.
- Profile API.
- Profile page UI.
- Model catalog and seed data.
- Polar checkout route.
- Polar webhook route.
- Credit transaction ledger.
- Credit page UI.
- Chat CRUD API.
- OpenRouter integration.
- Message sending and credit charging.
- Chat UI.
- Responsive styling pass.
- Deployment configuration.
- End-to-end manual QA.

## 12. Acceptance Criteria for First Release

- Users can sign up, log in, and log out.
- The app creates a local user profile linked to WorkOS.
- Users can view and edit default model and reply style.
- Users can view credit balance.
- Users can purchase credits through Polar.sh sandbox or production checkout.
- Credit purchases update the local balance through verified webhooks.
- Users can create and reopen chats.
- Users can choose from enabled OpenRouter models.
- Users can send messages only when they have enough credits.
- Chat messages and usage data are stored in MongoDB.
- The frontend is responsive on phone, tablet, and desktop widths.
- Secrets are stored in environment variables, not committed files.

