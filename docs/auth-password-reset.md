# Staff password reset (forgot password)

This document describes **email / administrator–assisted** password reset for **staff** accounts (same users as `POST /auth/login` with email or phone and password).

---

## Summary

- Staff (or the app on their behalf) calls **`POST /auth/forgot-password`** with their **registered email**.
- A **6-digit code** is generated and stored in the database table **`StaffPasswordReset`**, column **`code`**, in **plain text** (so an **administrator** can look it up and tell the staff member until **SMTP** is configured).
- When **SMTP** is configured later, the same code is **emailed** automatically; the DB row remains the source of truth for validation.
- Staff completes reset with **`POST /auth/reset-password`** (email + code + new password).

---

## Operational flow (no SMTP yet)

1. User submits forgot-password with their **staff email** (must match an **active** staff record with that email).
2. A row appears in **`StaffPasswordReset`** (see [Database](#database)): note **`code`**, **`staffId`**, **`expiresAt`**, **`usedAt`** (null until used).
3. **Administrator** looks up the latest row for that staff member (e.g. Prisma Studio, SQL, or internal admin UI) and communicates the **6-digit `code`** to the staff member out of band.
4. User enters the code and new password in the client; the app calls **`POST /auth/reset-password`**.

Until SMTP is connected, the API **does not send email**. Server logs may also mention the code when `SMTP_HOST` is unset (for convenience in development); treat production logs as sensitive if that line is enabled.

---

## API endpoints

Both routes are **public** (no JWT).

### 1. Request a reset code

- **Method / path:** `POST /auth/forgot-password`
- **Body (JSON):**

```json
{
  "email": "staff@hospital.org"
}
```

- **Success:** `200 OK` with a **generic** message (same whether or not the email exists), to avoid **email enumeration**:

```json
{
  "message": "If an account exists for this email, a verification code has been issued."
}
```

- **Notes:**
  - Only **active** staff with a **non-null** email that matches **case-insensitively** receive a new row.
  - Each new request **deletes** previous **unused** reset rows for that staff member, then creates one new row.
  - Code **TTL:** **15 minutes** from creation.

### 2. Confirm code and set new password

- **Method / path:** `POST /auth/reset-password`
- **Body (JSON):**

```json
{
  "email": "staff@hospital.org",
  "code": "482910",
  "newPassword": "atLeast6Chars"
}
```

- **Validation:**
  - `email`: valid email format.
  - `code`: **exactly 6 digits** (string of digits).
  - `newPassword`: **minimum length 6**.

- **Success:** `200 OK` example:

```json
{
  "message": "Password has been updated. You can sign in with your new password."
}
```

- **Failure:** `401 Unauthorized` — generic message for wrong email, wrong code, expired code, or already used code.

- **Other:** If **SMTP is configured** (`SMTP_HOST` set) but sending fails, `POST /auth/forgot-password` may respond with **503** and **no** reset row is saved (email is attempted **before** the DB write).

---

## Email / SMTP (optional, later)

Documented in `.env.example`.

| Variable       | Purpose |
|----------------|---------|
| `SMTP_HOST`    | If empty, **no email** is sent; code exists only in **`StaffPasswordReset.code`** (and optional server logs). |
| `SMTP_PORT`    | Default treated as **587** if omitted. |
| `SMTP_SECURE`  | Set to `true` if your provider requires it. |
| `SMTP_USER`    | SMTP auth username (if required). |
| `SMTP_PASS`    | SMTP auth password (if required). |
| `SMTP_FROM`    | From address; falls back to `SMTP_USER` if omitted when `SMTP_HOST` is set. |

When `SMTP_HOST` **is** set, from-address must be usable; send failures surface as **503** and no DB row is created for that attempt.

---

## Database

### Table: `StaffPasswordReset`

| Column      | Meaning |
|------------|---------|
| `id`       | Primary key (UUID). |
| `staffId`  | Foreign key to `Staff.id` (**cascade** on delete). |
| `code`     | **Plain** 6-digit code (for admin relay until SMTP; compare on reset). |
| `expiresAt`| When the code stops being valid. |
| `usedAt`   | Set when the code is consumed successfully; `null` until then. |
| `createdAt`| Row creation time. |

Index on `staffId` for lookups.

### Prisma

- Model **`StaffPasswordReset`** and relation **`Staff.passwordResets`**.

### Migrations

1. `prisma/migrations/20260504120000_staff_password_reset/` — initial table (historically used `codeHash`; superseded by next migration on existing DBs).
2. `prisma/migrations/20260504133000_staff_password_reset_plain_code/` — drops `codeHash`, adds plain **`code`** (and clears old rows).

Apply: `pnpm exec prisma migrate deploy` (production) or `pnpm exec prisma migrate dev` (local).

---

## Security notes

- **Plain `code` in the database** is weaker than hashing; it is intentional for your **admin handoff** workflow until SMTP exists. Restrict **database and backup access**, and **rotate codes** by issuing a new forgot-password request (invalidates prior unused rows).
- **Forgot-password** response stays generic so callers cannot confirm which emails are registered.
- **Reset** returns a single generic **401** for wrong email, wrong code, expired code, or reused code.
- **Staff passwords** are still stored **hashed** (unchanged); only the short-lived reset **code** is plain in `StaffPasswordReset`.

---

## Prompt for your client (frontend / mobile / Flutter / web)

Copy everything below the line into your client project or AI assistant.

---

You are implementing the **staff forgot-password** flow against a REST API.

**Base URL:** use the app’s configured API base.

**Important:** Until the hospital enables SMTP, **no email is sent**. After step 1 succeeds, the user must obtain the **6-digit code from an administrator** (the code is stored in the backend database for staff lookup). Your UI should say something like: “If your account was found, a code was generated. Please contact your administrator for the code, then enter it below.” Do **not** promise that an email was sent.

**Step 1 — Request code**

- Call `POST {BASE_URL}/auth/forgot-password` with JSON `{ "email": "<user email>" }`.
- On **200**, always show neutral success copy aligned with the API message, e.g. “If an account exists for this email, a verification code has been issued.” Optionally add administrator instructions as above.
- Handle **503**: email could not be sent (only when SMTP is configured but delivery failed); suggest retry later.

**Step 2 — Code + new password**

- Inputs: **email** (same as step 1), **6-digit code**, **new password** (≥ 6 characters).
- Call `POST {BASE_URL}/auth/reset-password` with JSON:
  `{ "email": "<same email>", "code": "<6 digits>", "newPassword": "<new password>" }`.
- On **200**, navigate to login and confirm they can sign in with the new password.
- On **401**, show one message such as “Invalid or expired code. Request a new code from your administrator.”
- Client-side validation: email format, code exactly 6 digits, password length ≥ 6.

**Optional UX**

- Note code expires in **15 minutes**.
- “Request new code” calls forgot-password again (invalidates the previous unused code).

**After SMTP is enabled**

- You may simplify copy to “check your email for the code” in environments where the product team confirms SMTP is live.

**Login**

- `POST {BASE_URL}/auth/login` with `emailOrPhone` and `password` (use the new password after reset).

Implement accessible forms, loading states, and robust network error handling.
