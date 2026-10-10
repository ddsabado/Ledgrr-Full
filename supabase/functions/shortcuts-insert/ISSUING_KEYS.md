# Issuing iOS Shortcut API Keys (Manual Runbook)

This iteration has **no in-app key-generation UI** — keys are issued manually by the
operator against the Supabase database. The raw key is generated locally, hashed, and
only its **SHA-256 hex hash** is ever persisted. The raw key exists only in your
terminal (once) and in the iOS Shortcut.

> Placed alongside `shortcuts-insert/index.ts` so this runbook travels with the code
> that enforces the hash contract (`sha256Hex`). The same contract is used by
> `shortcuts-data/index.ts`.

---

## Prerequisites

- Access to the Supabase project (SQL Editor in the dashboard, or `psql`).
- The **target user's UUID** — the user whose connected Google Sheet the Shortcut will
  read from and append to (see below).
- `openssl` available locally (ships with macOS and most Linux distros).

### Finding the target user's UUID

The `api_keys.user_id` column references `auth.users(id)`. Get the UUID from either:

- **Supabase dashboard → Authentication → Users** — copy the user's `UID`.
- **SQL**, by email:
  ```sql
  select id, email from auth.users where email = 'user@example.com';
  ```

---

## Step 1 — Generate a high-entropy raw key locally

```bash
RAW_KEY=$(openssl rand -base64 32)
echo "Give this to the Shortcut (shown once): $RAW_KEY"
```

This is the value that goes into the iOS Shortcut's `X-API-Key` header. It is shown
**once** — it is never stored server-side, so if you lose it you must issue a new key.

## Step 2 — Compute the SHA-256 hex hash

The stored hash **must** match the function's `sha256Hex`: the **SHA-256 of the UTF-8
bytes of the raw string**, output as **lowercase hex**.

```bash
HASH=$(printf '%s' "$RAW_KEY" | openssl dgst -sha256 -hex | awk '{print $NF}')
echo "$HASH"
```

> **IMPORTANT:** use `printf '%s'`, **not** `echo`. `echo` appends a trailing newline,
> which changes the hashed bytes and produces a hash that will never match — every
> request then fails with **401**. `printf '%s'` emits the raw string with no newline,
> matching `new TextEncoder().encode(raw)` in the function.

## Step 3 — Insert the row (hash only — raw key never persisted)

Run against the Supabase DB (SQL Editor or `psql`). The `api_keys` table is
**RLS-locked to the service role**, so this insert must be done with database-level /
service-role access, not from a browser client.

```sql
insert into public.api_keys (user_id, token_hash, label)
values ('<target-user-uuid>', '<HASH>', 'iphone-shortcut');
```

- `user_id` — the target user's UUID from the prerequisites step.
- `token_hash` — the `$HASH` from Step 2 (never the raw key).
- `label` — optional free-text tag to identify the key later (e.g. `iphone-shortcut`).

A manually issued key is functionally identical to any future in-app-issued key — both
endpoints authenticate it the same way, with no difference based on issuance method.

## Step 4 — Paste the raw key into the iOS Shortcut

Paste `RAW_KEY` into the Shortcut's `X-API-Key` request header (see below). This is the
only place, besides your terminal in Step 1, that the raw key ever lives.

---

## iOS Shortcut request setup

Both endpoints require **two headers** that serve different purposes:

- `X-API-Key: <RAW_KEY>` — **authentication.** The per-user secret from Step 1.
- `apikey: <project anon/publishable key>` — **project routing only.** This is the
  public Supabase anon/publishable key. It is *not* authentication and is safe to embed
  in the Shortcut; it only tells Supabase's edge gateway which project to route to. The
  real auth boundary is `X-API-Key`.

### `shortcuts-data` (GET) — fetch reference data

- **Method:** `GET`
- **URL:** `https://hsbetdcoqachtwniuhpl.supabase.co/functions/v1/shortcuts-data`
- **Headers:**
  - `X-API-Key: <RAW_KEY>`
  - `apikey: <project anon/publishable key>`
- **Response (200):** reference-data JSON with keys `transaction_categories`,
  `accounts`, `acct_meta`, `transactionTypes`, and `currencies`. Use this to populate
  the Shortcut's menus of valid categories, accounts, types, and currencies.

### `shortcuts-insert` (POST) — append a transaction

- **Method:** `POST`
- **URL:** `https://hsbetdcoqachtwniuhpl.supabase.co/functions/v1/shortcuts-insert`
- **Headers:**
  - `X-API-Key: <RAW_KEY>`
  - `apikey: <project anon/publishable key>`
  - `Content-Type: application/json`
- **Body (JSON):**

  | Field             | Required | Notes |
  |-------------------|----------|-------|
  | `date`            | optional | `M/D/YYYY`; defaults to today when absent/empty. |
  | `account`         | yes      | Account name. |
  | `amount`          | yes      | Transaction amount. |
  | `currency`        | optional | Defaults to `PHP` when absent/empty. |
  | `target_account`  | optional | For transfers. |
  | `type`            | yes      | e.g. `Expense`, `Income`, `Transfer`. |
  | `category`        | yes      | Category name. |
  | `subcategory`     | optional | Subcategory name. |
  | `note`            | optional | Free-text note. |
  | `resolved_amount` | optional | Base-currency (PHP) value for non-PHP transactions; must be a positive finite number when supplied for a non-PHP currency. |

  Example:
  ```json
  {
    "date": "3/9/2026",
    "account": "Visa",
    "amount": "1200",
    "currency": "TWD",
    "type": "Expense",
    "category": "Food",
    "subcategory": "Dining",
    "note": "lunch",
    "resolved_amount": "2100"
  }
  ```

- **Response (201):** `{ "ok": true }` on success.
- **No `sheet_id` in the body** — the target sheet is resolved from the authenticated
  key's user. Any sheet identifier in the body is ignored.

---

## Revoking a key

To disable a key (e.g. lost phone or compromised Shortcut), soft-revoke it — the
functions reject any key whose `revoked_at` is non-null. The row is kept, preserving
`last_used_at` history.

```sql
update public.api_keys set revoked_at = now() where id = '<key-id>';
```

Find the `id` by `label` or `user_id`:

```sql
select id, user_id, label, created_at, last_used_at, revoked_at
from public.api_keys
where label = 'iphone-shortcut';
```

To issue a replacement, revoke the old key and repeat Steps 1–4 with a fresh `RAW_KEY`.

---

## Security notes

- **Store the raw key only in the iOS Shortcut.** Do not paste it into notes, chat,
  password managers shared with the project, or any file in this repo.
- **The database holds only the hash.** There is no column for the raw key; it is never
  written to any persistent store, at any point during manual issuance.
- **Never log the raw key.** The functions never log the `X-API-Key` value or its hash.
- **Keys are revocable** at any time via `revoked_at` — no hard delete needed.
- **The `apikey` header is public routing, not auth.** Do not treat it as a secret and
  do not rely on it for access control; `X-API-Key` is the authentication boundary.
