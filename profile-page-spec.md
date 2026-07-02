# Profile Page Specification

## 1. Purpose

The profile page gives authenticated users a clear place to view account information and manage app-specific preferences. WorkOS remains the source of truth for authentication identity, while MongoDB stores ModelPass preferences and usage totals.

## 2. Primary Goals

1. Show the user's account identity from WorkOS.
2. Show ModelPass usage summary information.
3. Let the user update default AI model preference.
4. Let the user update reply style preference.
5. Keep billing and payment details out of the profile page except for a link to the credit page.

## 3. Users and Permissions

- Only authenticated users can access the profile page.
- A user can only view and edit their own profile.
- Admin-only controls are out of scope for the first release.

## 4. Page Route

Frontend route:

- `/profile`

Backend endpoints:

- `GET /api/profile`
- `PATCH /api/profile`
- `GET /api/models`

## 5. User Stories

1. As a logged-in user, I want to see which account I am signed into so I know I am using the correct account.
2. As a logged-in user, I want to choose my default model so new chats start with my preferred model.
3. As a logged-in user, I want to choose a reply style so the app can guide model responses toward my preference.
4. As a logged-in user, I want to see my lifetime usage so I understand how much I have used the service.
5. As a logged-in user, I want a quick link to manage credits so I can add more credits when needed.

## 6. Layout Requirements

### Desktop Layout

Use a centered content layout with clear sections:

1. Page header.
2. Account card.
3. Preferences card.
4. Usage summary card.
5. Billing link card or callout.

The page should not feel like a dense settings screen. Each card should have one clear purpose.

### Mobile Layout

Stack all cards vertically. Buttons and form controls should be full width or easy to tap. Avoid multi-column layouts on small screens.

## 7. Page Sections

### Header

Content:

- Title: `Profile`
- Short description: `Manage your ModelPass preferences and account details.`

Actions:

- Optional secondary action: `Back to chat`

### Account Card

Purpose: display WorkOS-owned identity information.

Fields to show:

- Name, if available.
- Email address.
- Account creation date, if available from local user record.
- WorkOS user id should not be shown by default, but can be useful in a hidden debug-only view later.

Editable:

- No account identity fields are editable in the first release.

Helper text:

- Explain that login identity is managed by WorkOS.

### Preferences Card

Purpose: let users control app-specific defaults.

Fields:

- Default model selector.
- Reply style selector.

Default model selector:

- Options come from `GET /api/models`.
- Only enabled models should be selectable.
- Display model name and short description if space allows.
- Store the selected value as the model slug.

Reply style selector:

- Initial supported values:
  - `balanced`
  - `concise`
  - `detailed`
  - `creative`

Behavior:

- Load current values from `GET /api/profile`.
- Save changes through `PATCH /api/profile`.
- Disable save button until a value changes.
- Show saving state while request is in progress.
- Show success confirmation after save.
- Show validation or network error if save fails.

### Usage Summary Card

Purpose: give a quick read on app usage without replacing the credit page.

Fields:

- Current credit balance.
- Lifetime credits used.
- Lifetime tokens used.
- Optional total chats count if the backend exposes it.

Actions:

- Link button: `Manage credits`
- Link target: `/credits` or the final credit page route selected by the frontend.

### Sign Out Area

Purpose: let users leave the authenticated session.

Action:

- Button: `Log out`
- Calls `POST /logout` or navigates to the configured WorkOS logout flow.

Confirmation:

- A separate confirmation modal is optional. For the first release, a direct logout button is acceptable.

## 8. Data Contract

### `GET /api/profile` Response

Expected response:

```json
{
  "user": {
    "email": "user@example.com",
    "name": "ModelPass User",
    "createdAt": "2026-07-02T00:00:00.000Z"
  },
  "preferences": {
    "defaultModel": "openai/gpt-4o-mini",
    "replyStyle": "balanced"
  },
  "usage": {
    "creditBalance": 100,
    "creditsUsed": 25,
    "tokensUsed": 12000
  },
  "billing": {
    "hasPolarCustomer": true
  }
}
```

### `PATCH /api/profile` Request

Allowed body:

```json
{
  "defaultModel": "openai/gpt-4o-mini",
  "replyStyle": "concise"
}
```

Rules:

- Both fields are optional, but at least one editable field must be present.
- Unknown fields should be ignored or rejected consistently. Rejecting with a clear validation error is preferred.
- `defaultModel` must match an enabled model.
- `replyStyle` must match the supported reply style list.

### `PATCH /api/profile` Response

Expected response:

```json
{
  "preferences": {
    "defaultModel": "openai/gpt-4o-mini",
    "replyStyle": "concise"
  },
  "updatedAt": "2026-07-02T00:00:00.000Z"
}
```

## 9. Loading and Empty States

### Initial Loading

Show a page-level loading state while profile and models are loading.

### Missing Name

If no name exists, show the user's email as the primary account label.

### No Models Available

If no enabled models are returned:

- Disable the default model selector.
- Show message: `No models are available yet.`
- Disable save if changing model is impossible.

## 10. Error States

### Unauthenticated

If the API returns unauthorized:

- Redirect to login or show a login prompt.
- Do not render stale profile data.

### Profile Load Failure

Show:

- Message: `We could not load your profile.`
- Retry button.

### Save Failure

Show inline error near the preferences card:

- Validation error: show backend-provided field message.
- Network error: `We could not save your preferences. Please try again.`

## 11. Accessibility Requirements

- Every input must have a visible label.
- Save and logout buttons must be keyboard accessible.
- Loading and success messages should be announced in a way screen readers can detect.
- Error messages should identify the affected field when possible.
- Color should not be the only indicator of success or error.

## 12. Implementation Steps

### Backend

1. Create profile route file.
2. Add auth middleware to all profile routes.
3. Implement `GET /api/profile`.
4. Implement `PATCH /api/profile`.
5. Validate `defaultModel` against enabled models.
6. Validate `replyStyle` against supported values.
7. Return consistent error responses.
8. Add tests for valid update, invalid model, invalid reply style, and unauthenticated access.

### Frontend

1. Add profile page route.
2. Add API helper functions:
   - `getProfile()`
   - `updateProfilePreferences()`
   - `getModels()`
3. Add local state for loading, saving, success, and error.
4. Render account card from profile response.
5. Render preferences form from profile and model responses.
6. Render usage summary.
7. Add logout action.
8. Test mobile and desktop layout.

## 13. Acceptance Criteria

- Authenticated users can open the profile page.
- Unauthenticated users cannot view profile data.
- Profile page displays email, name when available, credit balance, lifetime credits used, and lifetime tokens used.
- Default model options come from the backend model catalog.
- User can save a new default model.
- User can save a new reply style.
- Invalid profile updates return a clear error.
- Save button shows a loading state and prevents duplicate submissions.
- Successful save shows confirmation.
- Profile page includes a path to the credit page.
- Layout works on mobile and desktop.

## 14. Out of Scope for First Release

- Editing name, email, or password inside ModelPass.
- Profile avatar upload.
- Account deletion.
- Admin profile management.
- Detailed usage charts.
- Team or organization profiles.

