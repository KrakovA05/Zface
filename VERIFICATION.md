# Psychometric Engine — Goal-Backward Verification Report

**Verified:** 2026-05-14T00:00:00Z
**Scope:** Psychometric engine goals as stated in task description
**Status:** GAPS FOUND

---

## Goal Achievement Summary

| # | Goal | Status | Severity |
|---|------|--------|----------|
| 1 | 8 validated tests across 3 tiers | VERIFIED | — |
| 2 | Smart scheduler with correct priority | PARTIAL | WARNING |
| 3 | Scoring correct including reverse-scored items | FAILED | BLOCKER |
| 4 | Edge function 60/40 composite computation | VERIFIED | — |
| 5 | ResourcesScreen top-5 with +30% focus boost | VERIFIED | — |
| 6 | HomeScreen next test card + weekly insight | VERIFIED | — |
| 7 | Night room is anonymous | FAILED | BLOCKER |

**Score: 4/7 goals verified**

---

## Goal 1 — 8 validated tests across 3 tiers

**Status: VERIFIED**

`ustal/utils/psychTests.js` exports `PSYCH_TESTS` with exactly 8 keys:

- Tier `profile` (2): `ecr_short` (ECR-Short, 6 items, mean scoring), `mini_spin` (Mini-SPIN, 3 items, sum scoring)
- Tier `weekly` (4): `gad7` (GAD-7, 7 items), `pss4` (PSS-4, 4 items), `aes_short` (5 items), `ucla3` (UCLA-3, 3 items)
- Tier `monthly` (2): `olbi_short` (OLBI-Short, 8 items), `rosenberg` (Rosenberg SES, 10 items)

All 8 tests have: id, tier, dimension, title, subtitle, intro, scale, scoring, questions, normalize. Structure complete.

---

## Goal 2 — Smart scheduler priority

**Status: PARTIAL (WARNING)**

`ustal/utils/psychScheduler.js` `getNextTestId()` implements:
1. Profile tests (never passed) → immediate return ✓
2. Monthly tests if `now.getDate() <= 3` ✓
3. Weekly with `current_focus` priority ✓
4. Weekly LRU rotation ✓

**Gap 1 — FOCUS_TEST_MAP has two unreachable entries:**

```js
const FOCUS_TEST_MAP = {
  burnout:     'olbi_short',   // monthly test — NOT in WEEKLY_TEST_ROTATION
  self_esteem: 'rosenberg',    // monthly test — NOT in WEEKLY_TEST_ROTATION
  ...
};
```

The focus priority check gates on `WEEKLY_TEST_ROTATION.includes(preferredTest)`. `olbi_short` and `rosenberg` are not in `WEEKLY_TEST_ROTATION`, so users with `current_focus = 'burnout'` or `current_focus = 'self_esteem'` silently fall through to LRU rotation. Their stated focus has no effect on scheduling.

**Gap 2 — Week start inconsistency:**

The scheduler (`getNextTestId`) uses **Monday** as week start:
```js
const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
```

The Edge Function (`compute-weekly-profile`) uses **Sunday** as week start:
```js
weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // getDay() 0=Sunday
```

A test completed on Sunday will be counted in different weeks by the two components. On the following Monday the scheduler may prompt a test that was already completed on Sunday (from its perspective it's the new week), but the Edge Function already attributed that Sunday test to a different week's snapshot.

---

## Goal 3 — Scoring correct for all tests including reverse-scored items

**Status: FAILED (BLOCKER)**

### `computeRaw` function in PsychTestScreen.js (lines 114–127)

The function handles `sum_with_reverse` correctly:
```js
const val = test.reverseItems?.includes(i + 1) ? (maxVal + minVal - v) : v;
```
Using **1-based** index (`i + 1`) matches the 1-based `reverseItems` arrays. This part is correct.

### PSS-4 — CORRECT

`reverseItems: [3, 4]` — items 3 ("confident in handling problems") and 4 ("things going your way") are positive-phrased and need reversal. The reversal correctly inverts them so that agreeing with a positive item lowers the stress score. Max stress `[4,4,0,0]` → raw 16 → normalized 100. Min stress `[0,0,4,4]` → raw 0 → normalized 0. **Correct.**

### AES-Short — CORRECT (reverseAll is a no-op but normalize compensates)

`scoring: 'sum'` with `reverseAll: true`. The `computeRaw` function ignores `reverseAll` entirely (only handles `sum_with_reverse`). However, the normalize formula `((20 - rawSum) / 15) * 100` implicitly inverts the direction. Severe apathy `[1,1,1,1,1]` → raw 5 → normalized 100. No apathy `[4,4,4,4,4]` → raw 20 → normalized 0. **Correct by coincidence** — `reverseAll` flag is dead code, but the result is still right.

### OLBI-Short — INCORRECT

`reverseItems: [1, 3, 5, 7]`, scale `1='полностью согласен'` to `4='полностью не согласен'`.

For the normalize `rawSum/32*100` to produce `high = more burnout`, items where high agreement = burnout (negative items) must be reversed (they contribute 1 on agreement, need to contribute 4).

Items by type:
- Negative (agree = burnout): 1, 2, 4, 5, 8
- Positive (disagree = burnout): 3, 6, 7

Code reverses `[1, 3, 5, 7]`:
- Items 3 and 7 are **positive** — incorrectly reversed (disagree with positive → high burnout → want raw=4, but reversal gives 1)
- Items 2, 4, 8 are **negative** — missing reversal (agree = burnout → want raw=4, but no reversal gives 1)

**Measured effect:**
```
Clinically burned-out person (agrees with negatives, disagrees with positives):
  Code:    raw=17/32 → score=53%
  Correct: raw=32/32 → score=100%

Clinically non-burned-out person:
  Code:    raw=23/32 → score=72%
  Correct: raw=8/32  → score=25%
```

The OLBI produces **inverted, compressed results**. A highly burned-out person scores 53%, a healthy person scores 72%. The dimension is meaningless as implemented.

**Correct `reverseItems` for OLBI: `[1, 2, 4, 5, 8]`** (all negative items).

### Rosenberg Self-Esteem Scale — INCORRECT

`reverseItems: [1, 2, 4, 6, 7]`, scale `1='полностью не согласен'` to `4='полностью согласен'`.

Normalize: `100 - ((rawSum - 10) / 30) * 100` — for this to produce `0 = healthy self-esteem`, higher rawSum must correspond to higher self-esteem. Therefore **negative items** (agreeing = low self-esteem) must be reversed so they don't inflate rawSum.

Items by type (based on question text):
- Positive (agree = high SE): 1, 3, 4, 6
- Negative (agree = low SE): 2, 5, 7, 8, 9, 10

**Correct `reverseItems`: `[2, 5, 7, 8, 9, 10]`** (all negative items).

Code reverses `[1, 2, 4, 6, 7]`:
- Items 1, 4, 6 are **positive** — incorrectly reversed
- Items 5, 8, 9, 10 are **negative** — missing reversal
- Items 2 and 7 are negative and **correctly** reversed

**Measured effect:**
```
High self-esteem person (agrees with positives, disagrees with negatives):
  Code:    raw=19/40 → score=70%   (should be ~0%)
  Correct: raw=40/40 → score=0%

Low self-esteem person (disagrees with positives, agrees with negatives):
  Code:    raw=31/40 → score=30%   (should be ~100%)
  Correct: raw=10/40 → score=100%
```

The Rosenberg scale is **inverted and compressed**. A person with good self-esteem scores 70 (moderate distress), a person with poor self-esteem scores 30 (low distress). The scale produces the opposite of the clinical interpretation.

---

## Goal 4 — Edge function 60/40 composite

**Status: VERIFIED**

`supabase/functions/compute-weekly-profile/index.ts` correctly implements:

```ts
dimensionScores[dim] = Math.round(hasTest ? testScore * 0.6 + behavScore * 0.4 : behavScore);
```

When no test is available (`hasTest=false`), 100% behavioral. When test available, 60% test + 40% behavioral. Formula matches specification.

**Note — behavioral score for `attachment`:**
```ts
attachment: testScores['attachment'] ?? 50,
```
When the ECR-short test exists, `behavioralScores.attachment = testScores['attachment']`. This means for attachment: `testScore * 0.6 + testScore * 0.4 = testScore` — effectively 100% test score. This is intentional (no behavioral proxy exists for attachment style) and acceptable.

**Note — behavioral score direction:** All behavioral scores are derived so that higher = more distress, consistent with dimension convention. For example: `loneliness: norm(Math.max(0, 5 - uniqueConvs), 0, 5)` — fewer unique conversations = higher loneliness score. Correct.

---

## Goal 5 — ResourcesScreen personalized recommendations with +30% boost

**Status: VERIFIED**

`ustal/screens/ResourcesScreen.js` `loadResources()`:

1. Fetches latest `user_metrics` row for the user ✓
2. Fetches `current_focus` from `users` table ✓
3. Scores each resource:
   ```js
   const boost = applyFocusBoost && dim === currentFocus ? 1.3 : 1;
   score += (dimMap[dim] ?? 50) * weight * boost;
   ```
4. Takes top-5 by score → "Для тебя сейчас" section ✓
5. Falls back gracefully: if no `userMetrics`, all scores = 0 → all resources equal → top-5 arbitrary but no crash ✓
6. Accordion "Другие темы" groups by `resource.topic` ✓

**Minor note:** If `resources` table is empty, `recommended.length === 0` and the "Для тебя сейчас" section is hidden (conditional render). Section will not appear until resources are seeded.

---

## Goal 6 — HomeScreen next test card + weekly insight

**Status: VERIFIED**

`ustal/screens/HomeScreen.js`:

- Calls `getNextTestId(user.id)` on focus (line 320) ✓
- Renders `testPromptCard` when `nextTestId && PSYCH_TESTS[nextTestId]` (line 908) ✓
- Loads `user_metrics.dominant_dimension` and maps to `WEEKLY_PHRASES` (lines 323–334) ✓
- Renders `weeklyInsightCard` with link to Resources when `weeklyInsight` is set (lines 895–906) ✓
- `onComplete: () => setNextTestId(null)` correctly clears the card after test completion ✓
- `WEEKLY_PHRASES.ok` fallback handles unknown dimensions ✓

---

## Goal 7 — Night room is anonymous

**Status: FAILED (BLOCKER)**

**UI layer** — correct:
- Username shown as `'Аноним'` ✓
- Avatar rendered with `username='?'` and `level=null` (shows blank circle) ✓
- Tapping message avatar in night room is disabled (`activeOpacity={1}`, no navigation) ✓
- "все анонимны" badge shown in header ✓

**Data layer** — broken:

**Issue 1 — sender_id stored in DB:**
```js
// sendMessage(), line 261–264
const username = room === 'night' ? 'Аноним' : (store.username || 'Аноним');
const payload = { username, text: text2.trim(), level: room, sender_id: store.userId };
```
`sender_id: store.userId` is unconditional. Night room messages are permanently stored in the `messages` table with the real user UUID. Any DB admin, RLS bypass, or future code change can link "Аноним" messages to real accounts.

**Issue 2 — Presence tracking exposes real user_id:**
```js
// enterRoom(), line 211–213
await channel.track({ user_id: store.userId, is_anonymous: anonymous });
```
For the night room, `anonymous=true` but `user_id` is still the real `store.userId`. Supabase Presence state is broadcast to all channel subscribers. Any client in the night room receives presence sync events containing `{ user_id: <real UUID>, is_anonymous: true }` and can read the real identity via `channel.presenceState()`.

The stated goal "никто не узнает кто ты" is not met at the data layer. The anonymity is cosmetic only.

**Fix required:**
- `sendMessage`: when `room === 'night'`, omit `sender_id` or set it to `null`
- `channel.track`: when `anonymous && room === 'night'`, omit `user_id` or send a random/session key

---

## Anti-Pattern Scan

| File | Line | Pattern | Severity |
|------|------|---------|----------|
| `PsychTestScreen.js` | 114–127 | `reverseAll` flag read by zero code paths | Info |
| `psychTests.js` | 142–155 | `olbi_short.reverseItems` clinically incorrect | Blocker |
| `psychTests.js` | 164–181 | `rosenberg.reverseItems` clinically incorrect | Blocker |
| `psychScheduler.js` | 5–12 | `FOCUS_TEST_MAP` has 2 unreachable entries | Warning |
| `RoomsScreen.js` | 261–264 | `sender_id` always stored including night room | Blocker |
| `RoomsScreen.js` | 211–213 | Presence track always includes real `user_id` | Blocker |
| `compute-weekly-profile/index.ts` | 32–34 | Sunday-based week vs scheduler Monday-based week | Warning |

---

## Human Verification Required

### 1. Resources table seeded with dimension_weights

**Test:** Navigate to ResourcesScreen after completing at least one psychometric test
**Expected:** "Для тебя сейчас" shows 5 resources relevant to your highest-scoring dimension
**Why human:** Requires `resources` table to have rows with `dimension_weights` JSON populated. Cannot verify seeding status from code alone.

### 2. pg_cron trigger for compute-weekly-profile

**Test:** Check Supabase Dashboard → Database → pg_cron for a job calling the Edge Function
**Expected:** A job scheduled for Sunday 03:00 that invokes `compute-weekly-profile`
**Why human:** The Edge Function is a plain HTTP handler. The CLAUDE.md states pg_cron triggers it but there is no migration or cron config in the repository. Cannot verify remotely.

### 3. current_focus field in users table

**Test:** Confirm `users` table has `current_focus TEXT` and `focus_updated_at` columns in Supabase
**Expected:** Columns exist (they are not in the CLAUDE.md schema table)
**Why human:** Both columns are referenced in HomeScreen and ResourcesScreen but are absent from the documented schema. Their existence can only be confirmed in the live DB.

---

## Gaps Summary

**Two BLOCKER categories:**

**A — Rosenberg and OLBI scoring bugs (Goal 3):**
Both `monthly` tier tests have wrong `reverseItems` arrays. The clinical scoring is inverted and compressed — a burned-out person scores 53% instead of 100% on OLBI, a person with healthy self-esteem scores 70% instead of 0% on Rosenberg. These scores feed directly into `user_metrics` via the Edge Function, which means the weekly composite score and level assignments are incorrect for users who complete these tests. This is the highest-severity bug.

Fix OLBI: change `reverseItems: [1, 3, 5, 7]` to `reverseItems: [1, 2, 4, 5, 8]`
Fix Rosenberg: change `reverseItems: [1, 2, 4, 6, 7]` to `reverseItems: [2, 5, 7, 8, 9, 10]`

**B — Night room data-layer anonymity (Goal 7):**
Night room messages permanently store the real `sender_id` in the DB, and the Presence channel broadcasts the real `user_id` to all room members. The "all anonymous" promise to users is not upheld at the data layer.

Fix: set `sender_id: null` in the night room message payload; omit `user_id` from presence track when `room === 'night'`.

**One WARNING category (Goal 2):**
`FOCUS_TEST_MAP` maps `burnout → olbi_short` and `self_esteem → rosenberg`, but both are monthly tests excluded from `WEEKLY_TEST_ROTATION`. The focus-priority branch in the scheduler can never activate for these two dimensions. Users who select burnout or self-esteem as their focus see no scheduling effect.

---

_Verified: 2026-05-14_
_Verifier: Claude (goal-backward analysis)_
