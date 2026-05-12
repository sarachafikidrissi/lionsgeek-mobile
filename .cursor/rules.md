## LionsGeek Mobile + Backend — Do Not Break Rules

This file lists **invariants** (contracts) that existing features depend on.
When adding new features or refactoring, **do not change these without updating both backend + mobile in the same PR**.

---

## 1) Auth + session persistence (highest priority)

- **AsyncStorage keys are contracts** (used across `context/`, `app/loading.jsx`, tab guard):
  - `auth_token`
  - `auth_user`
  - `onboarding_seen`
- **Token format**: Mobile uses **Laravel Sanctum personal access tokens** and sends them as:
  - `Authorization: Bearer <token>`
- **Login endpoint contract**:
  - `POST /api/mobile/login`
  - Must return JSON with **exact shape**:
    - `{ token: string, user: object }`
- **Token verification endpoint must remain valid**:
  - `GET /api/mobile/profile`
  - This is the gatekeeper used by `app/loading.jsx`.

---

## 2) API base URL + environment

- **Do not rename** `EXPO_PUBLIC_APP_URL`.
- **Do not hardcode API URLs** in screens/components.
  - Use the shared API wrapper (`api/index.jsx`) and `API.APP_URL`.

---

## 3) Navigation / routes invariants (expo-router)

- **Keep these routes stable** (existing code navigates to them directly):
  - `/loading`
  - `/auth/login`
  - `/(tabs)`
  - `/(tabs)/profile`
  - `/(tabs)/search`
  - `/(tabs)/notifications`
  - `/(tabs)/chat`
- **Do not rename the existing tab screens**:
  - `index`, `reservations`, `chat`, `training`, `leaderboard`, `more`

---

## 4) Shared user object contract

Many components assume these fields exist on `user`:

- **Identity**: `id`, `name`, `email`
- **Avatar**: `image` and/or `avatar` (can be filename or full URL)
- **Roles**: `roles` should behave like an array (ex: `['admin']`, `['coach']`)

If backend changes user shape, update:
- `context/index.jsx` (stored user)
- `components/layout/Navbar.jsx` (avatar normalization)
- feed, notifications, chat components (they read `user.*` and build image URLs)

---

## 5) Always use the shared API wrapper

- For authenticated requests, prefer:
  - `API.getWithAuth(endpoint, token)`
  - `API.postWithAuth(endpoint, data, token)`
- Avoid calling axios directly from new screens.

Reason: this wrapper standardizes headers, token handling, and some response parsing.

---

## 6) Chat contracts (very easy to break)

Existing chat UI depends on these endpoint paths + response shapes:

- `GET /api/mobile/chat` → `{ conversations: [...] }`
- `GET /api/mobile/chat/following-ids` → `{ following_ids: number[] }`
- `GET /api/mobile/chat/conversation/{userId}` → `{ conversation: {...} }`
- `GET /api/mobile/chat/conversation/{conversationId}/messages` → `{ messages: [...] }`
- `POST /api/mobile/chat/conversation/{conversationId}/send`
  - Must support **`multipart/form-data`**
  - Fields used by the app:
    - `body` (string)
    - `attachment` (file)
    - `attachment_type` in `{ image, video, file, audio }`
- `POST /api/mobile/chat/conversation/{conversationId}/read`
- `DELETE /api/mobile/chat/message/{messageId}`
- `DELETE /api/mobile/chat/conversation/{conversationId}`

Attachment objects in RN are treated as:
- `{ uri, name, type, size }`

---

## 7) Notifications + push

- Push token registration contract:
  - Mobile sends: `POST /api/mobile/push-token` with `{ expo_push_token: string }`
  - Backend must save token for the authenticated user.
- Notifications screen expects:
  - `GET /api/notifications` returning `{ notifications: [...] }`
  - `POST /api/notifications/mark-all-read`

---

## 8) Reservations + training endpoint stability

Mobile currently calls a mix of `/api/mobile/*` and `/api/*` endpoints.
When refactoring backend routes, **preserve these paths** (or change mobile at the same time):

- Training:
  - `GET /api/mobile/trainings`
  - `GET /api/mobile/trainings/{id}`
  - `POST /api/mobile/attendances`
  - `POST /api/mobile/attendance/save`
- Reservations:
  - `GET /api/mobile/reservations`
  - `GET /api/mobile/reservationsCowork`
  - `GET /api/places`
  - `GET /api/users`
  - `GET /api/equipment`
  - `POST /api/reservations/store`
  - `POST /api/cowork/reserve`

---

## 9) “Change management” rule (how to refactor safely)

If you must break an invariant:
- Update backend + mobile together.
- Add a short note in the PR describing:
  - Old behavior
  - New behavior
  - Migration/compat layer (if any)
  - How to test

