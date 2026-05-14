# SECURITY.md — Zface / Устал

**Audit Type:** Retroactive-STRIDE (no prior PLAN.md)
**Audit Date:** 2026-05-14
**ASVS Level:** 2
**Auditor:** Claude Sonnet 4.6 (automated)
**Scope:** React Native / Expo client + Supabase backend (auth, RLS, Edge Functions)

---

## 1. Threat Register — Built from Implementation

This register was constructed by reading the implementation files directly. There is no prior PLAN.md.

### Threat Classification Key
- **CLOSED** — mitigation confirmed present in code
- **OPEN** — mitigation absent or incomplete; counts as BLOCKER
- **ACCEPTED** — accepted risk, documented below

---

## 2. Threat Verification Table

| Threat ID | STRIDE Category | Description | Disposition | Status | Evidence / Finding |
|-----------|----------------|-------------|-------------|--------|-------------------|
| T-01 | Spoofing | Auth bypass: client uses mutable `store.userId` instead of verified server identity for DB writes | Mitigate | **OPEN** | See section 3.1 |
| T-02 | Tampering | Message deletion without server-side ownership: `deleteMessage` in ChatScreen/RoomsScreen uses only `.eq('id', item.id)` — no `sender_id` filter | Mitigate | **OPEN** | See section 3.2 |
| T-03 | Tampering | Psych test results: `user_id` field sent from client (`store.userId`), not enforced from server session | Mitigate | **OPEN** | See section 3.3 |
| T-04 | Information Disclosure | Anonymous identity leakage: Presence channel `track()` sends `user_id: store.userId` even for anonymous users | Mitigate | **OPEN** | See section 3.4 |
| T-05 | Information Disclosure | `.env` file contains live Supabase URL + anon key; hardcoded URL also in `FeedScreen.js:18` | Accept/Transfer | **OPEN** | See section 3.5 |
| T-06 | Information Disclosure | Psychological test results (`psych_test_results`) and weekly metrics (`user_metrics`) are sensitive clinical data — no confirmed RLS read restriction except Supabase default RLS flag | Accept (pending RLS audit) | ACCEPTED | See section 4 |
| T-07 | Elevation of Privilege | Edge Function `compute-weekly-profile` has no caller authentication — anyone who discovers the URL can trigger mass level recalculation for all users | Mitigate | **OPEN** | See section 3.6 |
| T-08 | Repudiation | Support messages sent with only `store.username` (not verified user ID) — identity cannot be verified for abuse investigation | Accept | ACCEPTED | See section 4 |
| T-09 | Repudiation | Report records include raw `message_text` copied from client — could be tampered before submission | Accept | ACCEPTED | See section 4 |
| T-10 | Information Disclosure | Crash logs (`crash_logs` table) capture `error.stack` with potential PII + `store.userId` | Accept | ACCEPTED | See section 4 |
| T-11 | Spoofing | Email confirmation disabled by feature flag (`EMAIL_CONFIRM_ENABLED = false`) — unverified email addresses accepted | Accept | ACCEPTED | See section 4 |
| T-12 | Tampering | Feed post delete uses `.eq('author_id', store.userId)` — correct. Feed post update also correct. | Mitigate | CLOSED | `FeedScreen.js:214, 227` |
| T-13 | Tampering | DM delete/update uses `.eq('sender_id', store.userId)` — correct | Mitigate | CLOSED | `DirectMessageScreen.js:189, 196` |
| T-14 | Information Disclosure | Test history visible to other users only when `show_history = true` — gating is present | Mitigate | CLOSED | `UserProfileScreen.js:70` |
| T-15 | Denial of Service | No client-side rate limiting on message send, post create, or friend request send | Accept | ACCEPTED | See section 4 |
| T-16 | Information Disclosure | Crisis detection keyword list exposed in client bundle (`crisis.js`) — an attacker can read exact phrases to evade detection | Accept | ACCEPTED | See section 4 |
| T-17 | Tampering | DM send checks block status before insert | Mitigate | CLOSED | `DirectMessageScreen.js:163-165` |
| T-18 | Information Disclosure | Night room messages store `sender_id: store.userId` in DB — server-side identity linkable despite UI anonymity | Mitigate | **OPEN** | See section 3.7 |
| T-19 | Spoofing | `isMe` check in global chat uses `item.username === store.username` as fallback — username is not unique-enforced at DB layer | Mitigate | **OPEN** | See section 3.8 |
| T-20 | Information Disclosure | Analytics `events` table receives `user_id + screen_name` on every navigation event | Accept | ACCEPTED | See section 4 |
| T-21 | Information Disclosure | Push token stored in `users.push_token` — readable by any authenticated user via RLS (unverified, RLS not audited here) | Accept (pending RLS audit) | ACCEPTED | See section 4 |
| T-22 | Tampering | Room access control: `enterRoom()` checks `roomId !== userLevel && roomId !== 'night'` — client-side only | Mitigate | **OPEN** | See section 3.9 |

---

## 3. Open Threats — Blockers

### 3.1 T-01: store.userId Used as Identity for DB Writes (BLOCKER)

**Files:** `ustal/store.js`, multiple screens
**Finding:** The global `store` object is a plain mutable JS object with no reactivity, persistence, or integrity guarantee. `store.userId` is populated once at login and reused across all DB write operations:
- `ThoughtsScreen.js:109` — `user_id: store.userId` in anonymous_thoughts insert
- `RoomsScreen.js:309` — `reporter_id: store.userId` in reports insert
- `FeedScreen.js:199` — `user_id: store.userId` in post_likes insert
- `UserProfileScreen.js:100, 129, 165` — multiple sensitive writes

**Risk:** If `store.userId` is tampered (e.g., via dev tools in Expo Go, or a future bug that overwrites it), the client can write data as any user ID. The Supabase anon key permits INSERT operations with any `user_id` value unless RLS enforces `auth.uid() = user_id`.

**Required mitigation:** RLS policies on all writable tables must enforce `auth.uid() = user_id` (or `sender_id`, `reporter_id`, etc.) server-side. This audit cannot confirm RLS policies are set correctly without direct DB inspection.

**Action required:** Confirm that every table with INSERT/UPDATE/DELETE from the client has a corresponding RLS policy enforcing `auth.uid()`. Until confirmed, this is a BLOCKER.

---

### 3.2 T-02: Message Delete Without Server-Side Ownership Filter (BLOCKER)

**Files:** `ustal/screens/ChatScreen.js:154`, `ustal/screens/RoomsScreen.js:283`

**Finding:** Both `deleteMessage` functions delete by `id` only:
```
await supabase.from('messages').delete().eq('id', item.id);
```
No `.eq('sender_id', store.userId)` filter is present. The UI correctly gates delete behind `isOwn`, but that check is client-side. If a user constructs a direct API call or the `isOwn` logic is circumvented, any message can be deleted by any authenticated user.

Compare to the correct pattern used in `DirectMessageScreen.js:196`:
```
await supabase.from('direct_messages').delete().eq('id', id).eq('sender_id', store.userId);
```

**Action required:** Add `.eq('sender_id', store.userId)` to all `messages` table delete calls. This must also be enforced by RLS (`auth.uid() = sender_id`).

---

### 3.3 T-03: Psych Test Results Written With Client-Supplied user_id (BLOCKER)

**Files:** `ustal/screens/PsychTestScreen.js:42-52`

**Finding:** The screen calls `supabase.auth.getUser()` correctly to get `user.id`, which is good. However, `psych_test_results` contains sensitive clinical data (anxiety, stress, attachment scores). Without confirmed RLS that restricts reads to `user_id = auth.uid()`, any authenticated user can potentially read another user's psych test history.

The write path is correct (`user.id` from verified session), but read access is unconfirmed at the RLS layer.

**Action required:** Confirm RLS policy: `SELECT` on `psych_test_results` must enforce `user_id = auth.uid()`. Also confirm for `user_metrics`.

---

### 3.4 T-04: Anonymous Identity Leaked via Presence Channel (BLOCKER)

**Files:** `ustal/screens/RoomsScreen.js:213`

**Finding:**
```js
await channel.track({ user_id: store.userId, is_anonymous: anonymous });
```

When a user enters a room anonymously, `user_id: store.userId` is still broadcast in the Presence channel. Any other connected client can subscribe to the same Presence channel and read the full presence state, which includes the real `user_id` for anonymous participants. The app only uses `is_anonymous` to increment a counter in UI, but the underlying presence object contains the identity.

**Risk:** Exposes the real identity of users who explicitly chose anonymity — a particularly serious risk given the vulnerable population (users in crisis).

**Action required:** When `anonymous = true`, omit `user_id` from the tracked object (use a random UUID or omit entirely). Only track `{ is_anonymous: true }`.

---

### 3.5 T-05: Hardcoded Supabase URL in FeedScreen (WARNING + BLOCKER)

**Files:** `ustal/screens/FeedScreen.js:18`

**Finding:**
```js
const SUPABASE_URL = 'https://yincycmdsdluueqsxtwn.supabase.co';
```

The Supabase project URL is hardcoded as a string literal in production source code, separate from the `.env` file. This creates two problems:
1. Inconsistency: if the project URL ever changes, this string will silently produce broken media URLs.
2. The `.env` file itself was confirmed to contain both `SUPABASE_URL` and `SUPABASE_ANON_KEY` in plaintext. While `.gitignore` excludes `.env`, the anon key is semi-public by design (Supabase anon key is safe to expose, but the hardcoded URL in source code is a hygiene failure).

The Supabase anon key visible in the `.env` is `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` — this is acceptable for a public anon key per Supabase's security model, but it is confirmed present in the repo's environment file.

**Action required:** Replace `FeedScreen.js:18` hardcoded URL with `process.env.SUPABASE_URL` or import from `@env`.

---

### 3.6 T-07: Edge Function compute-weekly-profile Has No Auth Guard (BLOCKER)

**Files:** `supabase/functions/compute-weekly-profile/index.ts`

**Finding:** The function body begins immediately with `Deno.serve(async () => {` with no request authentication check whatsoever. It uses `SUPABASE_SERVICE_ROLE_KEY` internally and iterates over all users, updating their `level` and writing `user_metrics`.

There is no check for:
- A secret header (e.g., `X-Cron-Secret`)
- Supabase `Authorization` header validation
- IP allowlisting

If the function URL is discovered (Supabase Edge Function URLs follow a predictable pattern), any external actor can trigger mass profile recomputation, potentially overwriting `users.level` for all users to values derived from manipulated behavioral signals.

**Action required:** Add a `CRON_SECRET` environment variable check at the top of the handler, or restrict invocation to Supabase's internal pg_cron scheduler via Supabase dashboard settings.

---

### 3.7 T-18: Night Room Messages Store Real sender_id (BLOCKER)

**Files:** `ustal/screens/RoomsScreen.js:261`

**Finding:**
```js
const username = room === 'night' ? 'Аноним' : (store.username || 'Аноним');
const payload = { username, text: text2.trim(), level: room, sender_id: store.userId };
```

The UI displays `Аноним` as username, but `sender_id: store.userId` is always included in the database insert. Any admin query or compromised RLS policy will reveal the real identity of night room participants. The app promises "никто не узнает кто ты" (nobody will know who you are), which is violated at the database layer.

**Action required:** For night room messages, either omit `sender_id` (and update RLS/delete policies to handle null sender), or use a separate table for night room messages that enforces anonymization.

---

### 3.8 T-19: Username-Based isOwn Check Spoofable (WARNING)

**Files:** `ustal/screens/ChatScreen.js:195, 287`

**Finding:**
```js
const isMe = item.sender_id === store.userId || item.username === store.username;
isOwn={menuMsg ? (menuMsg.sender_id === store.userId || menuMsg.username === store.username) : false}
```

The fallback `|| item.username === store.username` means that if two users have the same username (or a user changes their username to match another), they would be granted edit/delete UI access to that user's messages. The `validateName` function in RegisterScreen does not enforce uniqueness — it only validates format. Uniqueness must be enforced at the database level.

**Risk:** Medium. The actual server-side delete for global messages has no `sender_id` filter (T-02), making this compoundable.

**Action required:** Confirm unique constraint on `users.username` at DB level. Remove username-based fallback from `isOwn` computation.

---

### 3.9 T-22: Room Access Control Is Client-Side Only (BLOCKER)

**Files:** `ustal/screens/RoomsScreen.js:147`

**Finding:**
```js
const enterRoom = async (roomId, anonymous = false) => {
  if (roomId !== userLevel && roomId !== 'night') return;
```

This check only exists in the client. The `messages` table accepts inserts with any `level` value. A user with `level = 'green'` can directly POST to the Supabase REST API with `level = 'red'` and insert messages into the red room.

**Action required:** Add RLS policy on `messages` INSERT: `level = auth.uid_level()` (using a DB function to look up the user's level) or use a check constraint validated via trigger.

---

## 4. Accepted Risks

| Threat ID | Category | Rationale |
|-----------|----------|-----------|
| T-06 | Info Disclosure — Psych Data RLS | RLS exists on all tables per CLAUDE.md, but policies not auditable from client code. Accepting with note that an RLS audit against the live database is required before production release. |
| T-08 | Repudiation — Support Identity | Support submissions include `store.username` (not `user_id`). Acceptable for MVP: support team can cross-reference username. Username is not PII under Russian law. |
| T-09 | Repudiation — Report Tampering | `message_text` in reports is client-supplied. Accepted: reports are reviewed manually; the message_id is the canonical evidence. |
| T-10 | Info Disclosure — Crash Logs | Stack traces may include screen names and component state. `user_id` is included. Accepted for MVP: crash_logs table should have restricted access (support/admin only). Requires RLS confirmation. |
| T-11 | Spoofing — Email Verification | `EMAIL_CONFIRM_ENABLED = false` in `config.js`. Email ownership unverified. Accepted for pre-launch testing phase. Must be enabled before public release. |
| T-15 | DoS — Rate Limiting | No client-side debouncing on message send / post create. Supabase has project-level rate limits. Accepted: Supabase's default rate limits apply. |
| T-16 | Info Disclosure — Crisis Phrases | `CRISIS_PHRASES` array in `crisis.js` is bundled in the app. A determined attacker can read and evade detection. Accepted: crisis detection is a safety net, not a security control; false negatives are acceptable. |
| T-20 | Info Disclosure — Analytics | Navigation events logged with `user_id + screen_name`. Accepted: standard analytics pattern; no message content or sensitive data logged. |
| T-21 | Info Disclosure — Push Tokens | Push tokens stored in `users` table. Accepted: RLS controls access; push tokens are low-sensitivity (can be rotated). |

---

## 5. Unregistered Threat Flags

The following attack surfaces were discovered during implementation review that had no prior threat mapping:

| Flag ID | Surface | Description | Severity |
|---------|---------|-------------|----------|
| UF-01 | `SupportScreen.js:40-41` | Edge Function error silently swallowed — success shown even if the email was never sent. If `send-support-email` fails, `setDone(true)` still fires. Users believe their support request was received when it may not have been. | Medium |
| UF-02 | `UserProfileScreen.js:86` | `user_helps` query uses `helper_id` and `helped_by_id` — but schema in CLAUDE.md shows `helper_id` and `helped_id`. Possible schema/code mismatch. | Medium |
| UF-03 | `notifications.js:251-262` | Push notifications sent via `fetch('https://exp.host/...')` with no certificate pinning, no request signing, and no retry/error handling. A MitM or Expo service outage causes silent failure. For a mental health app sending crisis-adjacent messages, this is notable. | Low |
| UF-04 | `compute-weekly-profile/index.ts:114` | `self_esteem` behavioral score is computed as `100 - norm(helpsCount, 0, 5)` — meaning users who help others score *lower* self-esteem. This appears to be an inversion bug, not a security issue, but it causes incorrect level assignment for the most socially active users. | Low (logic bug) |
| UF-05 | `store.js` | Global mutable store is shared across all screens with no session invalidation on auth state change. If a session expires mid-session, `store.userId` remains stale; subsequent DB calls use an invalid session but still send stale `store.userId`. | Medium |

---

## 6. Summary

| Status | Count |
|--------|-------|
| CLOSED | 4 |
| OPEN (BLOCKER) | 8 |
| ACCEPTED | 9 |
| Unregistered Flags | 5 |
| **Total Threats** | **21** |

**Threats Closed:** 4/21
**Blockers:** 8 open threats prevent safe production release.

### Critical Priority Order

1. **T-04** — Anonymous identity in Presence channel — immediately exposes vulnerable users
2. **T-18** — Night room `sender_id` in DB — breaks anonymity promise to crisis users
3. **T-07** — Edge Function with no auth — enables mass level manipulation
4. **T-02** — Message delete without ownership filter — any user can delete any chat message
5. **T-22** — Room access control client-side only — level segregation bypassed
6. **T-01** / **T-03** — RLS must be confirmed for all sensitive tables
7. **T-19** — Username-based ownership check
8. **T-05** — Hardcoded Supabase URL

---

## 7. Pre-Release Checklist

- [ ] Confirm RLS policies on `messages`, `direct_messages`, `psych_test_results`, `user_metrics`, `anonymous_thoughts`, `thought_reactions`, `user_helps`, `blocks`, `reports`, `notifications`, `post_likes`, `friendships` — all enforce `auth.uid()` binding
- [ ] Fix `deleteMessage` in `ChatScreen.js` and `RoomsScreen.js` to include `sender_id` filter
- [ ] Fix Presence `track()` to not include `user_id` for anonymous users
- [ ] Fix night room insert to not store real `sender_id`
- [ ] Add authentication guard to `compute-weekly-profile` Edge Function
- [ ] Enable `EMAIL_CONFIRM_ENABLED = true` before public launch
- [ ] Replace hardcoded `SUPABASE_URL` string in `FeedScreen.js` with env var
- [ ] Add DB-level unique constraint on `users.username` and remove username fallback in `isOwn`
- [ ] Add server-side room access enforcement (RLS on `messages` INSERT by level)
- [ ] Investigate `user_helps` schema mismatch (UF-02)
