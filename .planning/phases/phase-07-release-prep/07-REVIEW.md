---
phase: 07-release-prep
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - ustal/screens/FeedScreen.js
  - ustal/screens/FriendsScreen.js
  - ustal/screens/MessagesScreen.js
  - ustal/screens/DirectMessageScreen.js
  - ustal/screens/ThoughtsScreen.js
  - ustal/screens/FishingScreen.js
  - ustal/screens/BreathingScreen.js
  - ustal/screens/NotificationsScreen.js
findings:
  critical: 5
  warning: 9
  info: 5
  total: 19
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-05-15
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed 8 React Native screens. The most serious issues are: a schema mismatch between `message_reactions.reaction` (DB) and `emoji` (code) that silently breaks all DM reactions; a non-existent `caught_fish` table reference in FishingScreen that throws on every session; an incorrect navigation call that passes `{ userId }` instead of `{ user }` to UserProfileScreen from NotificationsScreen causing a guaranteed crash; and a missing `store.userId` guard in `toggleLike` that can corrupt likes as `null` when the user has no session. Several secondary bugs and quality issues follow.

---

## Critical Issues

### CR-01: `message_reactions` schema mismatch — DM reactions silently broken

**File:** `ustal/screens/DirectMessageScreen.js:119,137,139`

**Issue:** The DB schema (`CLAUDE.md` line 138) defines `message_reactions.reaction TEXT`. The code queries, inserts, and upserts using the field name `emoji` (not `reaction`). Every read returns `undefined` for the reaction emoji, every write inserts `null`. The upsert conflict key is `(message_id, message_table, user_id)` which is correct, but the column written is wrong. Result: all DM emoji reactions are permanently broken — users see nothing, nothing is stored correctly.

```js
// Current — wrong field name
const { data } = await supabase.from('message_reactions')
  .select('message_id, emoji, user_id')          // ← no 'emoji' column in DB
  .in('message_id', msgs.map(m => m.id))
  .eq('message_table', 'direct_messages');

const r = { message_id: messageId, message_table: 'direct_messages',
            user_id: store.userId, emoji };       // ← should be 'reaction'
```

**Fix:** Rename all `emoji` field references to `reaction`:
```js
// In loadReactions:
.select('message_id, reaction, user_id')

// In groupReactions():
if (!g[r.reaction]) g[r.reaction] = { count: 0, hasMe: false };
g[r.reaction].count++;

// In toggleReaction():
const myReaction = list.find(r => r.user_id === store.userId);
if (myReaction?.reaction === emoji) {
  // delete branch stays same
} else {
  const r = { message_id: messageId, message_table: 'direct_messages',
              user_id: store.userId, reaction: emoji };  // ← key renamed
```

---

### CR-02: `caught_fish` table does not exist — FishingScreen crashes on load

**File:** `ustal/screens/FishingScreen.js:139,252`

**Issue:** `FishingScreen` queries and inserts into `supabase.from('caught_fish')`. This table is not present in the DB schema documented in `CLAUDE.md` and was never mentioned anywhere in the project. The `useEffect` on mount fires for every logged-in user and will return a Supabase error; the `.then()` chain silently swallows it but `setCollection([])` is never reached on the error branch (`data` is `null`). The insert on line 252 also silently fails. The collection feature is completely non-functional.

**Fix options (pick one):**
1. Create the missing migration: `CREATE TABLE caught_fish (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(user_id) ON DELETE CASCADE, fish_name TEXT, created_at TIMESTAMPTZ DEFAULT now()); ALTER TABLE caught_fish ENABLE ROW LEVEL SECURITY; CREATE POLICY ...`
2. If the feature is intentionally local-only, replace with `AsyncStorage` persistence and remove all Supabase calls.

---

### CR-03: `toggleLike` uses `store.userId` without null check — inserts null user_id

**File:** `ustal/screens/FeedScreen.js:189-202`

**Issue:** `toggleLike` performs DB writes (`post_likes.insert` / `post_likes.delete`) using `store.userId` without any null guard. The early guard on line 93 in `fetchLikedPosts` shows the developer is aware this can be null, but `toggleLike` has no equivalent protection. On a cold start or after a logout race, `store.userId` is `undefined`. This inserts a row with `user_id = null` (RLS may block it, but the optimistic state update already ran, corrupting the local UI, and if RLS is misconfigured the null row is written).

```js
// Current — no guard
const toggleLike = async (postId) => {
  const isLiked = !!likedPosts[postId];
  setLikedPosts(prev => ...);  // optimistic update runs before check
  setPosts(prev => ...);
  if (isLiked) {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', store.userId);
  } else {
    await supabase.from('post_likes').insert({ post_id: postId, user_id: store.userId });
  }
};
```

**Fix:**
```js
const toggleLike = async (postId) => {
  if (!store.userId) return;
  // ... rest unchanged
};
```

---

### CR-04: NotificationsScreen navigates to `UserProfile` with wrong params — guaranteed crash

**File:** `ustal/screens/NotificationsScreen.js:84`

**Issue:** `UserProfileScreen` expects `route.params.user` (a user object), as confirmed by `UserProfileScreen.js:39: const { user } = route.params`. NotificationsScreen passes `{ userId: notif.data.user_id }` — the `user` key is absent. `UserProfileScreen` will crash immediately with `Cannot destructure property 'user_id' of undefined`.

```js
// Current — wrong params
navigation.navigate('UserProfile', { userId: notif.data.user_id });
```

**Fix:** Either fetch the user first and pass the full object, or at minimum pass a minimal stub consistent with what `UserProfileScreen` expects:
```js
// Minimal fix — screen will re-fetch details itself
navigation.navigate('UserProfile', {
  user: { user_id: notif.data.user_id, username: '', level: 'green', avatar_url: null, status: '' }
});
```
Better fix: fetch user data before navigating (same pattern as `handleTap` for `like`/`comment` cases).

---

### CR-05: `thought_reactions` field mismatch — `reaction_type` vs `reaction`

**File:** `ustal/screens/ThoughtsScreen.js:28,72,91,95,128`

**Issue:** The DB schema (`CLAUDE.md` line 147) defines `thought_reactions.reaction TEXT`. ThoughtsScreen queries, groups, and upserts using the field name `reaction_type`. Every SELECT returns `undefined` for all reactions; every upsert writes column `reaction_type` which does not exist, so the insert fails silently (Supabase returns an error that is not checked). Reaction counts always show 0 and reacting has no effect.

```js
// Current — wrong field name everywhere
.select('reaction_type')                                              // line 72
.upsert({ ..., reaction_type: type }, { onConflict: '...' })        // line 128
(list || []).forEach(r => { if (g[r.reaction_type] !== undefined)   // line 28
```

**Fix:** Replace all occurrences of `reaction_type` with `reaction`:
```js
.select('reaction_type')        →  .select('reaction')
r.reaction_type                 →  r.reaction
reaction_type: type             →  reaction: type
```

---

## Warnings

### WR-01: `sendMessage` in DirectMessageScreen has no in-flight guard — duplicate messages possible

**File:** `ustal/screens/DirectMessageScreen.js:157-184`

**Issue:** `sendMessage` performs an async DB insert but there is no `sending` state flag to disable the send button while the request is in flight. Rapid taps on the send button will trigger multiple concurrent inserts with identical content. The optimistic UI does not apply here — duplicate rows are written to the DB.

**Fix:**
```js
const [sending, setSending] = useState(false);

const sendMessage = async () => {
  if (sending) return;
  if (editing) { await saveEdit(); return; }
  const trimmed = text.trim();
  if (!trimmed) return;
  setSending(true);
  try {
    // ... existing body
  } finally {
    setSending(false);
  }
};
// Disable button: disabled={!text.trim() || sending}
```

---

### WR-02: `unread.js` key prefix uses `store.userId` at import time — wrong key before login

**File:** `ustal/utils/unread.js` (referenced from `MessagesScreen.js:129,141` and `DirectMessageScreen.js:58`)

**Issue:** `getLastRead` and `markRead` build their AsyncStorage key as `` `${store.userId || 'anon'}_lastRead_${channelId}` ``. If the function is called during the cold-start window before `store.userId` is populated, it falls back to `anon`. On next login a different (correct) key is used, so the unread counts are always wrong for first open after install. Additionally, when a second user logs in on the same device, `anon` keys from the previous user's unauthenticated state can bleed through.

**Fix:** Pass `userId` as an explicit argument instead of reading from `store` at call time:
```js
const key = (userId, channelId) => `${userId || 'anon'}_lastRead_${channelId}`;
export const markRead = async (userId, channelId) => { ... };
export const getLastRead = async (userId, channelId) => { ... };
```
Update all call sites accordingly.

---

### WR-03: `MessagesScreen` DM discovery query uses `LIKE '%userId%'` — UUID prefix collision

**File:** `ustal/screens/MessagesScreen.js:81`

**Issue:**
```js
.or(`sender_id.eq.${store.userId},conversation_id.like.%${store.userId}%`)
```
A UUID like `abc12345-...` will match any `conversation_id` that contains that string as a substring. This is mostly safe in practice since UUIDs are long, but it is semantically wrong: it should filter on `conversation_id` containing the full UUID as a segment (`_uuid` or `uuid_`), not as an arbitrary substring. More importantly, `conversation_id` is deterministic (`[uid1, uid2].sort().join('_')`), so `sender_id.eq.${store.userId}` already captures all messages the user sent. The LIKE branch captures messages the user *received* where they are not the sender, but a query for all conversations by participant would be safer:

**Fix:** Replace the LIKE fallback with a proper filter on the known conversation ID pattern or simply query `direct_messages` where `conversation_id` starts/ends with the userId in sorted UUID format — or better, compute the known conversation IDs from the already-fetched `friendIds` list and query only those.

---

### WR-04: `FeedScreen` — `post` function does not guard against empty `store.userId`

**File:** `ustal/screens/FeedScreen.js:171-187`

**Issue:** `post()` calls `supabase.auth.getUser()` to get the authenticated user ID — which is correct for the insert. However, it then uses `store.username` and `store.level` as `author_username` and `author_level` without any null fallback beyond `|| 'Аноним'` for username. If `store.level` is undefined (cold start), `author_level` is `undefined` and the insert will violate any NOT NULL constraint on that column or store `null`, which breaks the feed rendering (level badge, color).

**Fix:**
```js
author_level: store.level || 'green',   // already handled by level var at line 51
```
Verify `level` variable is always populated; the line 51 assignment `const level = store.level || 'green'` is correct — ensure `author_level: level` is used (not `store.level`) in the insert on line 180.

---

### WR-05: `BreathingScreen` — countdown shows `0` and stale animation on last second

**File:** `ustal/screens/BreathingScreen.js:30-39`

**Issue:** The countdown interval fires every 1000ms and decrements `secs`. The timeout fires after `phase.duration` ms. Because both are set at the same time and `setInterval` runs on the same event loop, the final decrement to `0` happens *after* the `setTimeout` fires `setPhaseIdx`, which clears the interval. This causes the display to briefly show `1` on the last tick instead of `0`, before the next phase renders. Additionally, the `Animated.timing` call on phase change (line 23-28) is not stopped before starting a new animation on the next phase — residual animations can interfere.

**Fix:** Stop the current animation before starting the next one:
```js
useEffect(() => {
  if (!running) return;
  const phase = PHASES[phaseIdx];
  setSecs(phase.duration / 1000);
  scale.stopAnimation();
  Animated.timing(scale, { ... }).start();
  // ... rest unchanged
}, [running, phaseIdx]);
```
For the `0` flicker: either start from `duration/1000 - 1` or ignore the display of `0` (the phase changes fast enough to be imperceptible).

---

### WR-06: `FishingScreen` — `rollFish` can return `undefined` when all pools are empty

**File:** `ustal/screens/FishingScreen.js:112-123`

**Issue:** `rollFish` falls back to `FISH.filter(f => f.rarity === 'common')` if the primary pool is empty. The common fish array is not time-restricted, so this fallback always has items. However, the `pool[Math.floor(Math.random() * pool.length)]` call on the fallback pool is fine, but the `roll` function itself is called from `pull()` at line 240 — if somehow `pool` is empty (e.g., data corruption in FISH constant), `rollFish` returns `undefined`, and then `pull()` does `const fish = rollFish(period)` followed by `fish.rarity` on line 243, which crashes with `Cannot read property 'rarity' of undefined`.

**Fix:**
```js
const fish = rollFish(period);
if (!fish) return;   // safety guard before any access
```

---

### WR-07: `NotificationsScreen` — `mark as read` UPDATE has no `author_id` scope issue (timing race)

**File:** `ustal/screens/NotificationsScreen.js:61-67`

**Issue:** The bulk UPDATE on line 64-67 runs *after* `setItems(data || [])` (line 57). If the user taps a notification between `setItems` and the UPDATE completing, `handleTap` runs on an item whose `read` state in the DB is still `false`. This is a UI consistency issue: if `store.refreshBadges?.()` is called from elsewhere before the UPDATE completes, the badge count will not yet reflect the clear. The more serious issue: the UPDATE filters only on `user_id` and `read = false` — it correctly scopes to the current user by using `user.id` from `getUser()` (not `store.userId`), so there is no security issue here. But `data` from line 53 could be `null` if the SELECT failed — `data?.some(...)` correctly guards this, so the UPDATE is skipped on error.

**Fix (minor):** Move the mark-read UPDATE before `setItems` so the badge refresh in the badge system sees consistent state:
```js
if (data?.some(n => !n.read)) {
  await supabase.from('notifications').update({ read: true })
    .eq('user_id', user.id).eq('read', false);
  store.refreshBadges?.();
}
setItems(data || []);
```

---

### WR-08: `ThoughtsScreen` — submit does not guard against `store.userId` being null

**File:** `ustal/screens/ThoughtsScreen.js:102-117`

**Issue:** `submit()` inserts into `anonymous_thoughts` with `user_id: store.userId` and `level: store.level || 'green'` without checking if `store.userId` is set. If the user is in a partial auth state (cold-start race), `user_id = null` is inserted. Unlike the `post()` function in FeedScreen which calls `supabase.auth.getUser()` first, this function relies entirely on `store.userId`.

**Fix:**
```js
const submit = async () => {
  if (!store.userId) return;
  // ... rest unchanged
};
```

---

### WR-09: `FeedScreen` — hardcoded `SUPABASE_URL` for public storage URL construction

**File:** `ustal/screens/FeedScreen.js:18,146`

**Issue:** The public URL for uploaded media is constructed by string-concatenating a hardcoded `SUPABASE_URL` constant (line 18) with the storage path. If the Supabase project URL ever changes (e.g., migration, custom domain), all previously stored media URLs are broken and all new uploads use the wrong URL. The Supabase client already has the URL configured — the SDK's `getPublicUrl` method should be used instead.

**Fix:**
```js
// Remove: const SUPABASE_URL = 'https://yincycmdsdluueqsxtwn.supabase.co';

// In uploadMedia(), replace the manual URL construction:
const { data: urlData } = supabase.storage
  .from('post-media')
  .getPublicUrl(path);
return urlData.publicUrl;
```

---

## Info

### IN-01: `FeedScreen` — `filter` state is hardcoded `'all'`, dead code branches

**File:** `ustal/screens/FeedScreen.js:31,112,177`

**Issue:** `const filter = 'all'` is a constant, never changes. The conditional branches `if (filter === 'mine')` (lines 112, 177) are unreachable dead code. Style definitions for `filters`, `filterBtn`, `filterBtnActive`, `filterText`, `filterTextActive` are also dead.

**Fix:** Either remove the dead filter branches and styles, or restore the `useState` filter toggle if the feature is planned. Leaving constant dead branches actively misleads maintainers about what the app does.

---

### IN-02: `FeedScreen` — `media_type` is tracked in state but never sent to the DB insert

**File:** `ustal/screens/FeedScreen.js:38,178-181`

**Issue:** `mediaType` state (`'image'` or `'video'`) is maintained through the upload flow but the `feed_posts` insert on line 178 omits `media_type`. The DB schema lists `media_type TEXT`. The `isVideo()` utility checks the URL string for `.mp4`/`.mov` instead of using the stored type — this works but is fragile (e.g., a `.mp4` URL served through a CDN redirect with a different path format would fail).

**Fix:** Include `media_type: mediaType` in the insert payload:
```js
await supabase.from('feed_posts').insert({
  author_id: user.id, author_username: store.username || 'Аноним',
  author_level: level, text: text.trim(),
  target_levels: targetLevels,
  media_url: mediaUrl,
  media_type: mediaType,   // ← add this
});
```

---

### IN-03: `MessagesScreen` — room online count shows total users at that level, not online users

**File:** `ustal/screens/MessagesScreen.js:149-151`

**Issue:**
```js
const { count } = await supabase
  .from('users').select('*', { count: 'exact', head: true }).eq('level', r.id);
onlineCounts[r.id] = count || 0;
```
This counts ALL users with that level, not users who are currently online. The UI labels this "чел." in the room card, which is displayed next to the "ТВОЯ" badge — implying it's online user count. A user with `level = 'red'` who has been inactive for months is still counted.

**Fix:** Add a `last_seen` filter to only count recently active users:
```js
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
const { count } = await supabase
  .from('users').select('*', { count: 'exact', head: true })
  .eq('level', r.id)
  .gt('last_seen', fiveMinutesAgo);
```

---

### IN-04: `FishingScreen` — `isMounted` ref pattern is used but `setCollection`/`setShowHint` are called from async chains without `isMounted` check

**File:** `ustal/screens/FishingScreen.js:137-149`

**Issue:** The `isMounted` ref is correctly used in `startBite`/`doRipple` (lines 207, 210). However, the `useEffect` on lines 137-149 calls `.then(({ data }) => setCollection(...))` and `hasSeenHint('fishing').then(seen => { setShowHint(true); setTimeout(() => setShowHint(false), 5000); })`. If the user navigates away before these promises resolve, `setState` is called on an unmounted component, causing a React warning. The `setTimeout` on line 147 fires after 5000ms without checking `isMounted`.

**Fix:**
```js
useEffect(() => {
  if (!store.userId) return;
  let alive = true;
  supabase.from('caught_fish').select('fish_name').eq('user_id', store.userId)
    .then(({ data }) => { if (alive) setCollection(...); });
  hasSeenHint('fishing').then(seen => {
    if (!seen && alive) {
      markHintSeen('fishing');
      setShowHint(true);
      setTimeout(() => { if (alive) setShowHint(false); }, 5000);
    }
  });
  return () => { alive = false; };
}, []);
```

---

### IN-05: `DirectMessageScreen` — block check queries "did I block them" but not "did they block me"

**File:** `ustal/screens/DirectMessageScreen.js:162-165`

**Issue:** Before sending a message, the code checks if the current user has blocked the recipient. It does not check the reverse — whether the recipient has blocked the sender. If user B has blocked user A, user A can still send messages that land in user B's conversation (though RLS should prevent B from seeing them). The check should be bidirectional.

**Fix:**
```js
const { data: block } = await supabase
  .from('blocks').select('id')
  .or(`and(blocker_id.eq.${store.userId},blocked_id.eq.${friend.userId}),and(blocker_id.eq.${friend.userId},blocked_id.eq.${store.userId})`)
  .maybeSingle();
```

---

_Reviewed: 2026-05-15_
_Reviewer: Claude (adversarial review — gsd-code-reviewer)_
_Depth: standard_
