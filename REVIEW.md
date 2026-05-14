---
phase: psychometric-engine
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - ustal/utils/psychTests.js
  - ustal/utils/psychScheduler.js
  - ustal/screens/PsychTestScreen.js
  - ustal/screens/ResourcesScreen.js
  - ustal/screens/HomeScreen.js
  - ustal/screens/OnboardingMomentScreen.js
findings:
  critical: 5
  warning: 8
  info: 4
  total: 17
status: issues_found
---

# Psychometric Engine: Code Review Report

**Reviewed:** 2026-05-14
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the full psychometric engine stack: test definitions, scheduler, test-taking screen, resources recommender, home screen integration, and onboarding. The code is well-structured and mostly correct. However, five issues require a fix before shipping: two scoring bugs (reverseItems index convention mismatch and aes_short normalization overflow), one security gap (unfiltered `notifications` query exposes other users' data), one missing error guard that will crash the test screen with an unknown testId, and one data exposure issue in onboarding where answers from all users — not just other users — can be leaked.

---

## Critical Issues

### CR-01: reverseItems uses 1-based indices but computeRaw uses 0-based array indices

**File:** `ustal/screens/PsychTestScreen.js:109` / `ustal/utils/psychTests.js:81,146,169`

**Issue:** `computeRaw` iterates `answers` with a 0-based index `i` and checks `test.reverseItems?.includes(i)`. But in `psychTests.js` all `reverseItems` arrays are defined with 1-based item numbers (e.g., `pss4.reverseItems = [2, 3]` means questions 3 and 4 in natural language; `olbi_short.reverseItems = [1, 3, 5, 7]`; `rosenberg.reverseItems = [1, 2, 4, 6, 7]`). The result is that every reverse-scored item is off by one position. For PSS-4, questions at index 2 and 3 (the 3rd and 4th questions — the positive ones) are reversed correctly only by coincidence; for OLBI and Rosenberg, the reversal always misses the first defined item (index 0 is never reversed but item 1 should be) and incorrectly reverses the item one position after each defined item.

Concrete example — `rosenberg.reverseItems = [1, 2, 4, 6, 7]`:
- Item 1 ("В целом я доволен собой") should be reversed → index 0. `includes(0)` → false. NOT reversed. Bug.
- Item 2 ("ни на что не годен") should be reversed → index 1. `includes(1)` → true. OK.
- etc.

**Fix:** Either change all `reverseItems` arrays in `psychTests.js` to be 0-based, or change `computeRaw` to subtract 1 before the lookup:

```js
// Option A — fix computeRaw (no changes to test definitions needed):
const val = test.reverseItems?.includes(i + 1) ? (maxVal + minVal - v) : v;

// Option B — fix test definitions to 0-based (more explicit):
// pss4:      reverseItems: [2, 3]  →  [2, 3]  (already 0-based by coincidence for PSS-4)
// olbi_short: reverseItems: [1, 3, 5, 7]  →  [0, 2, 4, 6]
// rosenberg:  reverseItems: [1, 2, 4, 6, 7]  →  [0, 1, 3, 5, 6]
```

Option A (fix `computeRaw`) is safer as it changes one line instead of multiple definition objects.

---

### CR-02: aes_short normalization formula produces scores above 100

**File:** `ustal/utils/psychTests.js:111`

**Issue:** The `aes_short` normalize function is:
```js
const inverted = 20 - rawSum + 5;
return Math.round(Math.max(0, Math.min(100, (inverted / 20) * 100)));
```
The `+ 5` offset shifts the range. When `rawSum` is at its minimum (5 questions × 1 = 5): `inverted = 20 - 5 + 5 = 20` → score = 100. OK. When `rawSum = 5` exactly (minimum possible), it is fine. But the `+ 5` is inconsistent with the stated `maxRaw: 20` (5 questions × max 4). The formula should map raw range [5, 20] to normalized [100, 0] (since all items are reverse-scored for apathy):

Correct formula: `inverted = maxRaw - rawSum` → range [0, 15], then `(inverted / 15) * 100`.
Or: `((20 - rawSum) / 15) * 100` (since minimum raw is 5, not 0).

With the current formula at rawSum=5: inverted=20, score=100. At rawSum=20: inverted=5, score=25. This means a person who answers "exactly so" to every apathy item gets a normalized score of 25, not 0. The `Math.min(100)` clamp masks the true problem — values are consistently too high, making apathy always under-reported.

**Fix:**
```js
normalize: (rawSum) => {
  // Raw range [5, 20] — 5 questions, scale 1–4
  // High raw = low apathy; invert so high score = high apathy
  return Math.round(Math.max(0, Math.min(100, ((20 - rawSum) / 15) * 100)));
},
```

---

### CR-03: notifications query has no user_id filter — exposes all users' notifications

**File:** `ustal/screens/NotificationsScreen.js:47`

**Issue:** The query to load notifications does not filter by the current user's ID:
```js
const { data } = await supabase
  .from('notifications')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(60);
```
If the `notifications` table's RLS policy does not enforce `user_id = auth.uid()` at the row level (which is a common misconfiguration for notification tables), every authenticated user will see notifications belonging to other users. Even if RLS is correctly set, the client-side code is missing the filter, which is a defense-in-depth failure and will silently return wrong data if RLS is ever loosened or the table is recreated without the policy. The same issue affects the `read: false` count query in `HomeScreen.js:239`.

**Fix:**
```js
// NotificationsScreen — add .eq('user_id', user.id) filter:
const { data: { user } } = await supabase.auth.getUser();
const { data } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(60);

// HomeScreen.js line 239 — same fix:
const { count: notifCount } = await supabase
  .from('notifications')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .eq('read', false);
```

---

### CR-04: PsychTestScreen crashes if testId is not in PSYCH_TESTS

**File:** `ustal/screens/PsychTestScreen.js:9`

**Issue:** `const test = PSYCH_TESTS[testId]` is called unconditionally. If `testId` is invalid (stale navigation state, deep link, corrupted params), `test` is `undefined`. The very next line `for (let v = test.scale.min; ...)` throws `TypeError: Cannot read properties of undefined`. This crash is not caught — the screen will hard-crash instead of showing an error.

**Fix:**
```js
const test = PSYCH_TESTS[testId];
if (!test) {
  // Graceful fallback
  return (
    <View style={styles.container}>
      <Text style={[styles.doneTitle, { marginTop: 80 }]}>Тест не найден</Text>
      <TouchableOpacity
        style={[shared.button, { marginTop: 32, marginHorizontal: 24 }]}
        onPress={() => navigation.goBack()}
      >
        <Text style={shared.buttonText}>Назад</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

### CR-05: OnboardingMomentScreen leaks other users' daily answers without RLS check

**File:** `ustal/screens/OnboardingMomentScreen.js:53`

**Issue:** The screen fetches up to 20 daily answers from users with the same level and picks one at random to display. The query at line 53 passes a list of user IDs but applies no additional filter to confirm these users consented to having their answers publicly shared. The `daily_answers` table presumably has RLS, but the query reads answers from arbitrary user IDs without checking consent or privacy flags. This is the same category of concern as the "show_similar" flag: the app already respects `show_similar` for the similar-user feature, but there is no analogous consent flag for daily answers. Any user's answer to the daily question can be surfaced to all new users at the same level.

Beyond the consent issue: there is no error guard if `store.userId` is null (first-run scenario), causing the `.neq('user_id', store.userId)` filter to pass `null` as the ID, which in PostgREST means `neq('user_id', null)` — this returns no rows because `neq` against null is undefined in SQL (`<> NULL` is always false). The count on line 42 also includes the current user.

**Fix (minimal):**
```js
// Line 42: exclude current user from count
const { count } = await supabase
  .from('users')
  .select('*', { count: 'exact', head: true })
  .eq('level', level)
  .neq('user_id', store.userId || '00000000-0000-0000-0000-000000000000');

// Line 49: guard against null userId
if (!store.userId) { setLoading(false); return; }

// For consent: filter by show_similar (or a dedicated show_daily_answers flag)
const { data: sameLevel } = await supabase
  .from('users')
  .select('user_id')
  .eq('level', level)
  .eq('show_similar', true)   // reuse existing consent flag or add show_daily_answers
  .neq('user_id', store.userId);
```

---

## Warnings

### WR-01: PSS-4 reverseItems coincidence — verify intent

**File:** `ustal/utils/psychTests.js:81`

**Issue:** `pss4.reverseItems = [2, 3]`. With the 1-based convention used by all other tests, this means items 2 and 3 (0-based: indices 1 and 2) should be reversed. But the PSS-4 validated instrument reverses items 3 and 4 (the positive-valence questions: "уверенность в способности справляться" and "дела идут как хочется") — which are at 0-based indices 2 and 3. So `[2, 3]` in 1-based means reversing indices 1 and 2 — wrong questions. This is an additional consequence of CR-01 but worth flagging separately because after applying the CR-01 fix (`i + 1`), `[2, 3]` will correctly match indices 1 and 2 in the `includes(i+1)` check — wait, that makes it worse: with the fix `includes(i+1)`, item at index 0 → checks 1, index 1 → checks 2 (hit), index 2 → checks 3 (hit). So with fix, pss4 reverses indices 1 and 2. But the validated PSS-4 reverses items 3 and 4 (0-based: 2 and 3). The array should be `[3, 4]` in 1-based notation.

**Fix:** Change `pss4.reverseItems` to `[3, 4]` (1-based), then apply the CR-01 fix.

---

### WR-02: getNextTestId — priority inversion: profile tests run after monthly tests

**File:** `ustal/utils/psychScheduler.js:47`

**Issue:** The scheduler checks for monthly tests (lines 47–50) before profile tests (lines 53–63). This means on the 1st–3rd of the month, a new user who has never passed `ecr_short` or `mini_spin` will be given `olbi_short` or `rosenberg` instead. The comment at line 53 says "профильные — если ни разу не проходил", implying profile tests should have higher priority. The design document in CLAUDE.md states "Тир 1 — ПРОФИЛЬ (один раз при онбординге)" — profile tier is tier 1 and should be highest priority.

**Fix:** Move the profile test check block (lines 53–63) above the monthly test check block (lines 47–50).

---

### WR-03: Missing await on supabase.auth.getUser() can silently skip DB write

**File:** `ustal/screens/PsychTestScreen.js:31`

**Issue:**
```js
const { data: { user } } = await supabase.auth.getUser();
```
This destructures `data.user` directly. If `getUser()` returns an error (network down, token expired), `data` is `null` and this throws `TypeError: Cannot destructure property 'user' of null`. The `await` is present but there is no error check — the insert at line 33 is guarded by `if (user)`, but the crash happens before reaching that check.

**Fix:**
```js
const { data, error } = await supabase.auth.getUser();
if (error || !data?.user) { setSaving(false); setDone(true); return; }
const user = data.user;
```

---

### WR-04: ResourcesScreen loads all resources in one unfiltered query

**File:** `ustal/screens/ResourcesScreen.js:40`

**Issue:** `supabase.from('resources').select('*')` fetches every resource row with no limit or filter. As the `resources` table grows this will become a correctness issue — the "top 5 for you" recommendation will always compute over the full dataset, but the initial render could be very slow or hit Supabase's default 1000-row limit silently truncating results, causing the sort to operate on an incomplete set and returning wrong recommendations.

**Fix:** Add a reasonable limit appropriate for the expected dataset size, or paginate the "Other topics" accordion:
```js
const { data: resources } = await supabase.from('resources').select('*').limit(500);
```

---

### WR-05: focusBoost applies only when metricsCount < 4, ignoring established users

**File:** `ustal/screens/ResourcesScreen.js:81`

**Issue:**
```js
const applyFocusBoost = currentFocus && metricsCount < 4;
```
The focus boost (1.3× weight on the user's chosen focus dimension) is only applied for users with fewer than 4 weekly metric snapshots. After 4 weeks the boost silently disappears, meaning the user's explicitly stated `current_focus` has no effect on recommendations for established users. This seems like a logic error — the intention is likely the opposite: apply the boost as a baseline fallback for new users who have no metric data (so psychometric scores don't override their stated preference), but keep applying it for established users too, just at lower weight.

**Fix (if intended for new users only — document it):** At minimum add a comment explaining this cutoff. If the boost should persist, remove the `metricsCount < 4` condition.

---

### WR-06: tapMood low-mood push check includes today's record in the 3-day window

**File:** `ustal/screens/HomeScreen.js:481`

**Issue:** The push notification logic fetches mood check-ins from `threeDaysAgo` (2 days ago) through today, orders descending, and takes `limit(3)`. When the user just checked in (and the `upsert` already ran at line 474), today's record is included in that 3-record set. The query then checks `recentMoods.every(m => m.score <= 3)`. Since today's score is in the set, only 2 prior days are needed to trigger the push — but the condition requires all 3 records to be ≤3. This means a streak of exactly today + 1 previous day will never trigger (only 2 records returned), but today + 2 previous days will. The comment says "3 дня подряд оценка ≤3" — the implementation is correct conceptually but the `threeDaysAgo.setDate(d.getDate() - 2)` offset means it looks at only a 3-day window (today, yesterday, day before). That's correct. However, if the user hasn't checked in for one of those days the `limit(3)` could include records from further back, falsely satisfying the condition. 

**Fix:** Filter by date range explicitly, not just limit:
```js
.gte('checkin_date', threeDaysAgo.toISOString().split('T')[0])
.order('checkin_date', { ascending: false })
// remove .limit(3) or verify all 3 records are consecutive days
```

---

### WR-07: getNextTestId startOfWeek uses Sunday=0 but users expect Mon–Sun weeks

**File:** `ustal/utils/psychScheduler.js:17`

**Issue:**
```js
const dayOfWeek = now.getDay();    // 0=Sunday
const startOfWeek = new Date(now);
startOfWeek.setDate(now.getDate() - dayOfWeek);
```
`getDay()` returns 0 for Sunday, making Sunday the start of the week. For a Russian-locale app the standard calendar week starts on Monday. A user who passes a test on Sunday will have it attributed to the previous ISO week, and on Monday `passedThisWeek` will be empty so the same test could be offered again the very next day.

**Fix:**
```js
const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0 … Sun=6
```

---

### WR-08: dismissSimilar reads stale closure value of similarUser

**File:** `ustal/screens/HomeScreen.js:447`

**Issue:**
```js
const dismissSimilar = async () => {
  setSimilarUser(null);
  if (!similarUser) return;   // reads stale closure
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('similar_user_shown')
      .update({ dismissed: true })
      .eq('user_id', user.id)
      .eq('matched_user_id', similarUser.user_id);   // reads stale closure
  }
};
```
`setSimilarUser(null)` is called first, but since state updates are async, `similarUser` inside the closure still has the pre-update value — this part actually works. However, when `dismissSimilar` is called from the "Посмотреть профиль" button (line 758), it is called concurrently with navigation. If the component unmounts before `getUser()` resolves, the update runs against a potentially null user. More importantly: since `dismissSimilar` is defined without `useCallback`, it is recreated on every render and always captures the latest `similarUser`. The real bug is that there is no guard against the supabase call proceeding after unmount, which can cause a state update on an unmounted component warning.

**Fix:** Use a ref to track mount status, or wrap in `useCallback` with `[similarUser]` dep, and guard the async continuation:
```js
const dismissSimilar = useCallback(async () => {
  const userSnap = similarUser;
  setSimilarUser(null);
  if (!userSnap) return;
  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    await supabase.from('similar_user_shown')
      .update({ dismissed: true })
      .eq('user_id', data.user.id)
      .eq('matched_user_id', userSnap.user_id);
  }
}, [similarUser]);
```

---

## Info

### IN-01: computeRaw for 'mean' scoring returns float, passed to normalize without rounding

**File:** `ustal/screens/PsychTestScreen.js:103`

**Issue:** For `ecr_short` (scoring: 'mean'), `computeRaw` returns a floating-point mean. This is then passed as `rawScore` to both `normalize(rawScore)` (which rounds internally) and inserted into `psych_test_results.raw_score` as a float. The DB column is declared as `INT`. Supabase/Postgres will truncate the float silently, potentially losing precision. The round-trip value in the DB will differ from the in-memory value.

**Fix:** Either change the DB column to `FLOAT` / `NUMERIC`, or round in `computeRaw`:
```js
if (test.scoring === 'mean') {
  const mean = answers.reduce((s, v) => s + v, 0) / answers.length;
  return Math.round(mean * 100) / 100; // keep 2 decimal places, or just Math.round(mean)
}
```

---

### IN-02: getTodayQuestion uses different epoch in HomeScreen vs OnboardingMomentScreen

**File:** `ustal/screens/HomeScreen.js:57` vs `ustal/screens/OnboardingMomentScreen.js:15`

**Issue:** `HomeScreen.getTodayQuestion` computes the day offset from `new Date(now.getFullYear(), 0, 0)` (Jan 0 = Dec 31 of previous year). `OnboardingMomentScreen.getTodayQuestion` uses `new Date('2024-01-01')` as fixed epoch. The two functions return different questions for the same day. A user might see a different question in onboarding versus the home screen, creating a confusing experience where the "answer" they see in onboarding doesn't match the question shown on the home screen.

**Fix:** Extract `getTodayQuestion` into a shared utility (e.g., `utils/dailyHelpers.js`) and import it in both screens.

---

### IN-03: Bare empty catch swallows all HomeScreen load errors

**File:** `ustal/screens/HomeScreen.js:336`

**Issue:**
```js
} catch {}
```
All errors from the entire `load()` function body — network failures, unexpected nulls, query errors — are silently discarded. The user sees a perpetually loading spinner or stale data with no feedback. At minimum errors should be logged.

**Fix:**
```js
} catch (e) {
  if (__DEV__) console.warn('HomeScreen load error:', e);
}
```

---

### IN-04: wordTapCache is a module-level mutable object — shared across re-renders and users

**File:** `ustal/screens/HomeScreen.js:44`

**Issue:** `const wordTapCache = {}` is declared at module scope. In a React Native app, modules are cached for the process lifetime. If a user logs out and another user logs in on the same device (or if the auth session changes), the cache will return stale tap state for the new user's `today_userId` key only if the same date AND same userId were cached. The key is `${today}_${user.id}`, which is user-specific, so cross-user contamination is unlikely. However, the cache grows unboundedly — one entry per (day, user) pair — and is never cleared. This is a minor memory leak but also means old cache entries from previous sessions persist.

**Fix:** Clear the cache on logout, or use a size-limited cache, or scope it inside the component with `useRef`.

---

_Reviewed: 2026-05-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
