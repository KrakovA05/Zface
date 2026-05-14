# Zface — UI Review

**Audited:** 2026-05-14
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md)
**Screenshots:** Not captured (no dev server detected — React Native / Expo Go app)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Tone is on-brand and honest; two empty states are weak; error titles are bare 'Ошибка' |
| 2. Visuals | 2/4 | Streak popup uses 🔥 emoji violating no-emoji rule; ProfileScreen fish collection uses 6 emoji glyphs as UI; icon-only buttons lack accessibility labels throughout |
| 3. Color | 2/4 | `colors.accent` (#7c3aed) used 203 times vs neutral tokens 541 — ratio approaching 1:2.6, heavy for a non-dominant accent; 30+ hardcoded hex values bypass theme; theme.subtitle hardcoded to accent |
| 4. Typography | 2/4 | 21 distinct font sizes in use (9px–80px); `fontWeight: 'bold'` and `fontWeight: '700'` mixed (35 vs 56 occurrences) — same visual weight, inconsistent tokens |
| 5. Spacing | 3/4 | Core cards use consistent 16/18/20/24 rhythm; odd values (3, 5, 7, 48, 56, 60) appear in 29 places; no arbitrary rem/px values |
| 6. Experience Design | 2/4 | HomeScreen catch block is empty — all data failures render silently; PsychTestScreen has no back/cancel affordance mid-test; red-level RecommendationsScreen has no crisis hotline link (only TestScreen result screen does) |

**Overall: 14/24**

---

## Top 3 Priority Fixes

1. **HomeScreen silent error swallow** — `catch {}` on line 336 means any Supabase failure (network error, auth expiry) leaves the screen in perpetual loading or blank state with no user feedback. User task completion (mood checkin, daily question, test reminder) completely breaks silently. Fix: replace `catch {}` with `catch (e) { setLoading(false); /* optionally show a retry banner */ }` and surface at minimum a toast or inline error banner.

2. **21-size typography system** — Font sizes range from 9px to 80px with no enforced scale (9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 48, 56, 64, 80). Sizes 9px and 17px each appear in real UI (not just charts), and 'bold' string vs '700' numeric weights are used interchangeably. Hierarchy breaks: a `statusDesc` at 11px sits below a `statusLevel` at 13px — a 2px delta is too small for semantic contrast. Fix: define 5–6 named type steps in `theme.js` (`caption: 11`, `body: 14`, `bodyLg: 16`, `title: 20`, `headline: 28`, `display: 32`) and remove all other sizes from screen stylesheets. Remove all `fontWeight: 'bold'` in favour of `'700'`.

3. **Accent color overuse undermines calm tone** — 203 accent usages across screens means the purple (#7c3aed) appears on section labels, streak badges, suggestion chips, daily card borders, send buttons, module icons, weekly insight cards, chart toggle links, notification dots, and more. The 60/30/10 rule is broken: accent is acting closer to a secondary neutral. This directly conflicts with the product tone (calm, honest, no hype). Fix: demote section labels, chart toggle links, and decorative borders from `colors.accent` to `colors.muted`. Reserve accent for: primary CTAs, unread indicators, and single interactive affordances per screen.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Passing:**
- Level descriptions (`LEVEL_TEXTS`) are emotionally calibrated: "Ты это замечаешь — и это важно. Ты не один." matches the product's honest, non-therapeutic tone.
- Feed empty state (`HomeScreen.js`): "Здесь пока тихо / Возможно, кто-то ждёт именно твои слова" — specific and voice-consistent.
- Mood followup chips ('работа', 'усталость', 'тревога', 'одиночество', 'тело', 'сон') are appropriately concrete.
- Streak popup text: "Это не мелочь — привычка заботиться о себе строится именно так." — on-brand, non-toxic.
- Crisis resource copy (`TestScreen.js:157`): shown only on red result — correct placement.

**Findings:**

WARNING — `NotificationsScreen.js:149`: empty state text "Пока ничего нет" is generic. Given the screen is emotionally charged (the user may be checking whether someone responded to them), a more specific copy like "Пока тихо — появится когда кто-то отреагирует на тебя" would fit the tone better.

WARNING — Error alert titles are uniformly "Ошибка" across 15+ alert calls (`ProfileScreen.js:266`, `FeedScreen.js:116`, `ChatScreen.js:141`, etc.). System-level errors are acceptable, but for user-facing failures like "не удалось сохранить статус" the title "Ошибка" is abrupt and cold. Consider "Что-то пошло не так" or a contextual title like "Статус не сохранился".

WARNING — `PsychTestScreen.js:62-63`: completion screen reads "Готово / Ответы сохранены. Спасибо." This is transactional and misses an opportunity. After a validated psychological test (GAD-7, PSS-4, ECR), zero acknowledgement of the user's effort or emotional state is jarring. Even one sentence of context ("Это поможет нам лучше понять что тебе сейчас нужно") would close the loop.

OK — Alert cancel labels are "Отмена" (standard, appropriate for system dialogs in Russian). "Сохранить" appears only in edit-in-place flows (FeedScreen, ProfileScreen) where it is correct. No generic "Submit" or "OK" CTAs found.

---

### Pillar 2: Visuals (2/4)

**Findings:**

BLOCKER (rule violation) — `HomeScreen.js:1000`: `<Text style={styles.streakPopupFlame}>🔥</Text>` — a fire emoji rendered as primary visual in the streak modal. CLAUDE.md explicitly states "Ionicons везде, эмодзи не используются." The modal currently has a 56px emoji as its focal hero element with no Ionicons fallback. Fix: replace with `<Ionicons name="flame" size={56} color={colors.accent} />`.

BLOCKER (rule violation) — `ProfileScreen.js:17-30`: The fish collection (ALL_FISH) uses 5 distinct emoji glyphs (🐟, 🐠, 🐡, 🦈, ✨) as rendered UI elements in the profile achievements/collection section. These are data-driven but rendered directly as visual content. Fix: assign each rarity tier an Ionicons icon (`fish-outline`, `fish`, `alert-circle`, `star`) rather than emoji.

WARNING — Zero `accessibilityLabel` props found across all audited screens (only one `accessible={false}` in FeedScreen). Icon-only touch targets include: bell button in HomeScreen header, dismiss button on similarCard, send buttons in chat inputs, mood score buttons (28×36px with no label), word tap buttons. Screen reader users have no affordance for any of these.

WARNING — Mood score buttons (`HomeScreen.js:1285-1288`): `width: 28, height: 36` — the touch target for numbers 1–10 is 28px wide with a `hitSlop` of only 6px horizontal. Apple HIG minimum is 44px. At 375px screen width, 10 buttons × 28px = 280px, leaving 95px total gap for a row designed to span the card width. The targets are borderline inaccessible for users with motor difficulties (a demographic likely overrepresented in a mental health app).

WARNING — Visual hierarchy in `StatusCard` is weak: `statusLevel` is `fontSize: 13, fontWeight: '700'` and `statusDesc` is `fontSize: 11` — only a 2px size delta between the label and its supporting description. The level name doesn't assert enough weight to serve as the focal anchor it's designed to be.

OK — Section label pattern (11px, uppercase, `letterSpacing: 0.8`, `colors.muted`) is consistent across HomeScreen, FeedScreen, NotificationsScreen. Creates reliable visual rhythm between sections.

OK — Card shadow system (`cardShadow` / inline shadow definitions) is consistent: `shadowOpacity: 0.07–0.08`, `shadowRadius: 6–8`. Subtle and appropriate for light theme.

---

### Pillar 3: Color (2/4)

**Token audit:**
- `colors.accent` (#7c3aed): 203 usages
- Neutral tokens (white, muted, card, background, border): 541 usages
- Accent:neutral ratio ≈ 1:2.6

**Findings:**

WARNING — Accent overuse. The accent color (#7c3aed) is applied to: section labels (`sectionLabel`, `sectionTitle`), chart toggle links, streak badge, daily card border-left, weekly insight card border-left, notification unread dot, suggestion chip backgrounds, send buttons, module icon colour, and inline `subtitle` in `theme.js`. Many of these uses are purely decorative or structural. At 203 occurrences, the purple loses its signal value. Calm tones should reserve accent for actionable affordances only.

WARNING — `theme.js:36`: `subtitle: { color: colors.accent }` — the shared `subtitle` style applies accent to secondary text. This is an architectural decision that propagates accent into every screen using `shared.subtitle`, making every subtitle line visually compete with interactive elements.

WARNING — Hardcoded colours bypass theme (30+ instances found):
- `RegisterScreen.js:265,274`: `#e74c3c` for field validation errors — should be `colors.pink` (defined as `#c0392b` in theme but never used in screens for this purpose).
- `FeedScreen.js:285`: `#e74c3c` for liked post count — duplicates `colors.pink` with a different hex value.
- `BreathingScreen.js:128`: `backgroundColor: '#555'` for stop button — arbitrary dark grey not in theme.
- `DirectMessageScreen.js:408`: `backgroundColor: '#EDE8FF'` for own message bubble — accent-tinted hardcode.
- `ProfileScreen.js:469-471`: mood colour inline (not referencing `getMoodColor` function or theme) — duplicated logic.
- `NotificationsScreen.js:13-21`: TYPE_META colours (`#E57373`, `#4CAF50`, `#AA7C00`) are hardcoded. These should be in `constants.js` alongside `LEVEL_COLORS`.

WARNING — Two different hardcoded red values for "error/like" in the same codebase: `#e74c3c` (RegisterScreen, FeedScreen) vs `#E57373` (HomeScreen bell badge, NotificationsScreen). Neither matches `colors.pink: '#c0392b'`. Three distinct reds for semantically identical concepts.

OK — LEVEL_COLORS (`green: '#4CAF50'`, `yellow: '#AA7C00'`, `red: '#F44336'`) are consistently referenced via `LEVEL_COLORS[level]` in all major screens — no level colour is hardcoded in place of a token reference.

OK — Background (`#FAF7F2`), card (`#FFFFFF`), border (`#E8DFD0`), muted (`#9B8E82`) form a coherent warm neutral palette that dominates the screen area. The 60% neutral base is achieved.

---

### Pillar 4: Typography (2/4)

**Size inventory (21 distinct values):**
9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 48, 56, 64, 80

Sizes 9, 17, 26, 30, 48 each appear in real UI (not only decorative charts). Sizes 56, 64, 80 are used in the streak modal (56px emoji, 64px number, 80px level score). This is too many stops for a coherent scale.

**Weight inventory (7 distinct values):**
`'300'`, `'500'`, `'600'`, `'700'`, `'800'`, `'900'`, `'bold'`

`'bold'` (35 occurrences) and `'700'` (56 occurrences) render identically on most React Native platforms but are expressed as different tokens. This creates hidden inconsistency — a future platform or font swap could diverge these. `'800'` and `'900'` appear in the streak modal only (large decorative number), acceptable as one-off; `'300'` appears once (FishingScreen, likely) and is too thin for a mental health context.

**Findings:**

WARNING — No enforced type scale. The 21-size spread means any two adjacent text elements could be 1px apart (e.g. 11px label → 12px hint → 13px description → 14px body in a single card). Semantic hierarchy via size is unreliable. A user with low vision relying on size differences to navigate will not find consistent landmarks.

WARNING — Mixed `'bold'` / `'700'` usage: `headline` in `OnboardingMomentScreen.js:172` uses `fontWeight: 'bold'` while `greeting` in `HomeScreen.js:1170` uses `fontWeight: '700'`. Both are top-level heading-class text. The inconsistency doesn't affect visual output today but is a maintenance liability and violates token discipline.

WARNING — `statusLevel` at `fontSize: 13, fontWeight: '700'` (HomeScreen status card): the user's current mental health level — arguably the most important data point on the Home screen — is rendered in 13px. The greeting "Привет, {name}" is 22px and competes for primary attention. The information hierarchy inverts the conceptual priority.

OK — Body text sits consistently at 14–15px with `lineHeight: 20–22` in most cards. This is comfortable for the target age range (16–30).

OK — The `sectionLabel` / `moodLabel` / `wordLabel` micro-label pattern (11px, uppercase, `letterSpacing: 0.8`, `fontWeight: '700'`) is applied uniformly across HomeScreen, FeedScreen, and NotificationsScreen. This is the one reliable typographic pattern.

---

### Pillar 5: Spacing (3/4)

**Dominant values (by frequency):**
8 (155), 12 (106), 16 (93), 10 (86), 4 (83), 14 (67), 6 (51), 20 (33), 24 (24)

The core 4/8/12/16/20/24 rhythm is evident and used consistently for card padding, gaps, and section margins. This is the strongest pillar.

**Findings:**

WARNING — Values 3, 5, 7 appear a combined 37 times as padding/gap values. These are sub-pixel corrections that break the 4px grid. Specific instances: `gap: 3` (HomeScreen streakBadge), `gap: 5` (HomeScreen dailyGateHint), `paddingVertical: 7` (HomeScreen wordBtn), `paddingVertical: 9` (HomeScreen moodChip). These should be rounded to 4 or 8.

WARNING — `paddingBottom: 48` and `paddingBottom: 56` used as bottom content insets in several screens instead of deriving from `insets.bottom`. If bottom safe area changes (e.g. iPad or new iPhone form factors), these hardcoded values will clip content behind the home indicator.

WARNING — HomeScreen `content` padding is `paddingHorizontal: 20` while NotificationsScreen uses `paddingHorizontal: 16` and `paddingHorizontal: 8` for the header. The horizontal container gutter is inconsistent across screens — 16 and 20 both appear as "standard screen padding" depending on the screen. Pick one (recommend 20 to match Home) and apply it via `shared.screen`.

OK — Card-internal padding is consistently 16 or 18px across `moodCard`, `focusCard`, `similarCard`, `weeklyInsightCard`, `testPromptCard`. Visual density is uniform within the card vocabulary.

OK — `gap` property is used for flexbox item spacing in all modern components instead of manual `marginRight`/`marginBottom`, which is a correct and consistent pattern.

---

### Pillar 6: Experience Design (2/4)

**Findings:**

BLOCKER — `HomeScreen.js:336`: `} catch {}` — the entire data loading function (24 Supabase queries covering level, community count, mood checkin, word tap, daily answers, online count, user metrics, and next psych test) is wrapped in a single empty catch block. Any network failure, auth expiry, or query error leaves `loading` set to `false` (line 337 runs regardless) and all state at defaults — the user sees empty cards with no indication of a problem and no way to retry. This is the most severe UX failure in the codebase.

BLOCKER — `PsychTestScreen.js` has `headerShown: false` (`App.js:442`). When a user is mid-test (e.g. question 5 of 7 of the GAD-7), there is no visible back button, no cancel affordance, and no progress-save mechanism. Physical back gesture on Android would navigate away with progress lost. The `done` screen offers a "Продолжить" button. The `saving` state shows only a bare `ActivityIndicator` with no text — the user does not know their answers are being saved. Fix: add a header with a cancel confirmation, show "Сохраняем..." text alongside the spinner.

WARNING — `RecommendationsScreen.js`: red-level users see a recommendations list (breathing, fishing, rooms) but no crisis hotline link. The crisis phone number (`tel:88002000122`) is only surfaced on the immediate test result screen (`TestScreen.js:152-157`). A user who navigates back to Recommendations from their profile (with a pre-existing red level) never sees the crisis resource. Fix: duplicate the crisis link in `RecommendationsScreen` for `level === 'red'`.

WARNING — Chat screens (`ChatScreen.js`, `RoomsScreen.js`) have no offline/network-error state. If the Supabase realtime channel subscription fails, the UI shows an empty message list with no feedback. The `send()` function shows an `Alert.alert('Ошибка', ...)` on insert failure, but this is the only feedback signal.

WARNING — `FeedScreen.js:116`: on `loadPosts` error, `Alert.alert('Ошибка', 'Не удалось загрузить ленту')` fires and then the feed renders empty. There is no retry button. The user's only recovery is to leave and re-enter the screen. Consider an inline "Не удалось загрузить — нажми чтобы повторить" banner.

WARNING — `ProfileScreen.js:745`: locked achievements have `opacity: 0.35` but no tap handler explains what the achievement requires. A tap on a locked achievement shows `Alert.alert(a.label, 'Как получить:\n${a.desc}')` — but only for visible (non-hidden) achievements. For the 5 achievements in `HIDDEN_ACHIEVEMENTS`, there is zero interaction, making them invisible locked slots with no context. This is a dead UX zone.

OK — Destructive action confirmation is present: account deletion (`ProfileScreen.js:340-347`) uses `style: 'destructive'` and a two-step Alert. Report flows similarly confirmed.

OK — Disabled state is well-implemented for send buttons (opacity 0.4 + `disabled` prop) in FeedScreen, PostScreen, and SupportScreen.

OK — Loading states are present in all 12 audited screens via `ActivityIndicator`. The `saving` feedback pattern (opacity + spinner inside button) is consistent in FeedScreen and SupportScreen.

OK — Crisis detection (`hasCrisis`) is imported and active in ChatScreen and RoomsScreen — appropriate for the target user population.

---

## Registry Safety

shadcn not initialized (`components.json` absent). Registry audit skipped.

---

## Files Audited

- `/Users/user/Zface/ustal/theme.js`
- `/Users/user/Zface/ustal/screens/HomeScreen.js`
- `/Users/user/Zface/ustal/screens/FeedScreen.js`
- `/Users/user/Zface/ustal/screens/ChatScreen.js`
- `/Users/user/Zface/ustal/screens/RoomsScreen.js`
- `/Users/user/Zface/ustal/screens/ProfileScreen.js`
- `/Users/user/Zface/ustal/screens/PsychTestScreen.js`
- `/Users/user/Zface/ustal/screens/ResourcesScreen.js`
- `/Users/user/Zface/ustal/screens/NotificationsScreen.js`
- `/Users/user/Zface/ustal/screens/OnboardingMomentScreen.js`
- `/Users/user/Zface/ustal/screens/TestScreen.js`
- `/Users/user/Zface/ustal/screens/RecommendationsScreen.js`
- `/Users/user/Zface/ustal/screens/RegisterScreen.js` (partial, colour/error audit)
- `/Users/user/Zface/ustal/screens/DirectMessageScreen.js` (partial, colour/accessibility audit)
- `/Users/user/Zface/ustal/screens/BreathingScreen.js` (partial, colour audit)
- `/Users/user/Zface/ustal/App.js` (navigation config, headerShown flags)
