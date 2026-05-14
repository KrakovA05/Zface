# Phase 07 — UI Review (Full Retroactive Audit)

**Audited:** 2026-05-15
**Baseline:** Abstract 6-pillar standards + CLAUDE.md design contract
**Screenshots:** Not captured (no dev server — React Native / Expo Go project)
**Prior score:** 14/24

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Localised, empathetic strings throughout; minor generic patterns remain |
| 2. Visuals | 2/4 | Emoji still present in FishingScreen result cards and LEVEL_DATA badges |
| 3. Color | 2/4 | theme.js accent (#7c3aed purple) contradicts CLAUDE.md warm-brown contract; 203 accent usages scatter purple across warm UI |
| 4. Typography | 2/4 | 20 distinct font sizes in use — no coherent scale |
| 5. Spacing | 3/4 | Consistent token usage; SupportScreen header uses hardcoded paddingTop: 56 instead of insets |
| 6. Experience Design | 3/4 | States mostly handled; NotificationsScreen error indistinguishable from empty; BreathingScreen no top safe area |

**Overall: 15/24** (+1 from prior 14/24)

---

## Top 3 Priority Fixes

1. **theme.js accent color is #7c3aed (purple) — contradicts the entire warm light design contract** — affects 203 usages across every screen; buttons, active tabs, send buttons, badges all render in purple against a warm beige/cream background; fix by restoring `colors.accent` to `#8B7355` (or the intended warm brown token) and updating any dependent hardcoded `#7c3aed` literals in DirectMessageScreen.js, ChatScreen.js, and ThoughtsScreen.js.

2. **FishingScreen renders emoji as UI text in 14 fish result cards and the catch log** — violates "Ionicons everywhere, NO emoji in UI" design rule; the result card `<Text>{result.emoji}</Text>` at line 435 and log `<Text>{c.emoji}</Text>` at line 473 need Ionicons replacements per-rarity (e.g. `fish-outline`, `star-outline`, `sparkles`); the SCENE time-of-day icons (🌅☀️🌆🌙) at line 57 also need Ionicons equivalents.

3. **SupportScreen and BreathingScreen missing safe-area insets** — SupportScreen hardcodes `paddingTop: 56` in the header style (line 144) which clips on devices with notches above 56pt; BreathingScreen uses `safeArea: { flex: 1, backgroundColor }` with no top inset so the header row starts at y=0; fix both by importing `useSafeAreaInsets` and applying `paddingTop: insets.top`.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**WARNING — LEVEL_DATA emoji in badges.**
`FeedScreen.js:264` renders `{LEVEL_DATA[currentLevel]?.emoji || '•'}` inside a level badge card — emits `🌿`, `🌤`, `🌪` as display text. These are not copy strings per se, but they appear directly to users as UI labels. The fallback `'•'` is fine; the emoji are not. Replace with short text labels (`З`, `Ж`, `К`) or use a coloured dot via Ionicons `ellipse`.

**WARNING — LABELS constant uses emoji prefixes.**
`constants.js:39-46` — all 8 user labels include emoji: `'😮‍💨 Устал очень'`, `'🧠 Психолог'`, etc. These are rendered in FriendsScreen search chips (`FriendsScreen.js:237`). Violates emoji-free UI rule and breaks typographic consistency. Strip emoji from label strings; represent category type via a small Ionicons icon if visual distinction is needed.

**PASS — Empty states are contextual and empathetic.**
- FeedScreen: "Здесь пока тихо / Возможно, кто-то ждёт именно твои слова" — good.
- FriendsScreen: "Пока никого нет рядом / Найди кого-то во вкладке Поиск — иногда начать первым это и есть поддержка" — good.
- NotificationsScreen: "Пока ничего нет" — acceptable but terse for an empty-notifications state.
- MessagesScreen empty DMs: "Нет собеседников / Найти своих →" — good CTA.

**PASS — Error messages are specific in Russian.**
All Alert.alert calls use contextual Russian strings. No "Something went wrong" found.

**WARNING — SupportScreen error text is generic.**
`SupportScreen.js:41`: `Alert.alert('Ошибка', 'Не удалось отправить обращение. Попробуй ещё раз.')` — "try again" pattern without any guidance (e.g. check connection). Acceptable for now but weak.

---

### Pillar 2: Visuals (2/4)

**BLOCKER — FishingScreen renders fish emoji as large UI text.**
`FishingScreen.js:435`: `<Text style={[styles.resultEmoji, ...]}>{result.emoji}</Text>` at `fontSize: 64` (legendary: 80) — emoji characters `🐟 🐠 🐡 ✨ 🌟 👟 🥫 📜 🦈` are the primary visual of the result card. This is the most prominent screen element for a key interaction. Fix: replace emoji field in FISH array with an Ionicons name per fish, render with `<Ionicons name={result.icon} size={64} color={RARITY[result.rarity].color} />`.
`FishingScreen.js:473`: catch log also renders `{c.emoji}` at fontSize 16.
`FishingScreen.js:57-61`: SCENE object `icon` field holds emoji (`'🌅'`, `'☀️'`, `'🌆'`, `'🌙'`) rendered in the timeBadge `<Text>{sc.icon} {sc.label}</Text>`.

**WARNING — DirectMessageScreen own-bubble background is off-brand.**
`DirectMessageScreen.js:408`: `bubbleOwn: { backgroundColor: '#EDE8FF' }` — lavender/light-purple, not derived from any theme token. With accent now being `#7c3aed` this creates a purple-on-purple feel. The warm light theme expects card surfaces in `#FFFFFF` or `#FAF7F2`. Recommend `colors.accent + '18'` (semi-transparent warm accent on card).

**WARNING — FeedScreen level badge uses LEVEL_DATA emoji.**
`FeedScreen.js:264`: badge text is an emoji character `🌿 / 🌤 / 🌪`. The badge uses `borderColor: lvlColor` for colour differentiation but the label is an emoji. Replace with a 1-2 letter text label or a small colour-coded dot.

**WARNING — MessagesScreen night-room row uses hardcoded purple #7B68EE.**
`MessagesScreen.js:208-213`: border, icon background, icon colour, and label text all hardcoded to `#7B68EE` (medium slate blue). Not a theme token. Creates a third accent colour that doesn't exist anywhere else. Define as `const NIGHT_COLOR = '#7B68EE'` at file level or add to theme.js.

**PASS — Icon-only buttons have sufficient context.**
Back buttons (`chevron-back`) are always paired with screen titles. Send buttons (`arrow-up`) are always in an input row with a text field. Sufficient contextual anchoring.

**PASS — Visual hierarchy is consistent.**
Card pattern (white card on beige background, border radius 14-16, subtle shadow) is applied uniformly across FeedScreen, FriendsScreen, MessagesScreen, NotificationsScreen.

---

### Pillar 3: Color (2/4)

**BLOCKER — theme.js accent diverges from design contract.**
`theme.js:7`: `accent: '#7c3aed'` — a vivid violet/purple. The CLAUDE.md design contract and project_context specify `colors.accent = '#8B7355'` (warm brown). This single discrepancy cascades to 203 usages across every screen:
- All primary buttons render in purple
- Active tab indicators are purple
- Send buttons are purple
- Unread notification indicators are purple
- The accent-coloured "warm brown" design intent is entirely lost
The entire warm-light palette (beige background, cream card, brown text) now sits beneath purple accents creating a colour mismatch.

Additionally `colors.pink = '#c0392b'` (a dark tomato red) in theme.js vs `#E07060` in the design contract. Used in FriendsScreen reject button (`rejectBtn: { borderColor: colors.pink }`) — the current value is harsher than intended.

**WARNING — Hardcoded accent literals bypass theme token.**
`DirectMessageScreen.js:300,302,437,441`: hardcoded `#7c3aed` and `#7c3aed12` / `#7c3aed20` for crisis banner. Same pattern in `ChatScreen.js:256,258,343,347`. These should use `colors.accent` so they update when the theme changes.

**WARNING — RecommendationsScreen crisis card uses #E07060 literal.**
`RecommendationsScreen.js:197,256,259`: `color="#E07060"` and `backgroundColor: '#E0706011'`. This matches the design contract's `colors.pink` value but it's hardcoded rather than using `colors.pink`. Small risk but inconsistent.

**WARNING — Badge background hardcoded to #e74c3c.**
`MessagesScreen.js:355` and `LetterScreen.js:422`: `backgroundColor: '#e74c3c'` for unread count badges. This is a bright Flat UI red that clashes with the softer warm palette. Should map to `colors.pink` for consistency.

**PASS — Level colors are consistently centralised.**
`LEVEL_COLORS` from constants.js is used in all screens. `green='#4CAF50'`, `yellow='#AA7C00'`, `red='#E57373'` / `#F44336` (minor inconsistency: RecommendationsScreen uses `#F44336` directly for trend-down color while `LEVEL_COLORS.red = '#E57373'`).

---

### Pillar 4: Typography (2/4)

**WARNING — 20 distinct font sizes across the codebase.**
Identified sizes: 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 32, 48, 56, 64, 80.
A healthy scale would have 5-7 steps. The high end (48, 56, 64, 80) comes from FishingScreen's result emoji — if those are replaced with Ionicons, the scale drops to 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 32 — still 16 steps.

The core body range (11, 12, 13, 14, 15, 16) is 6 tiny steps within 5pt spread. Users cannot perceive the 1pt differences between 12/13 or 13/14. Consolidate: `caption=11`, `small=13`, `body=15`, `title=17`, `section=20`, `headline=24`, `display=28+`.

**WARNING — 7 font weight values in use.**
`'300'`, `'500'`, `'600'`, `'700'`, `'800'`, `'900'`, `'bold'`. The design contract implies a 2-weight system (regular + semibold). `'900'` appears only in FishingScreen's "КЛЮЁТ!" label — defensible for dramatic effect. `'800'` appears in FishingScreen `resultName`. `'300'` appears in BreathingScreen countdown number. These three are context-specific and acceptable. The remaining `'500'`, `'600'`, `'700'`, `'bold'` are used interchangeably across screens with no consistent semantic mapping.

**PASS — fontWeight '600' and '700' dominate.**
82 instances of `'600'` and 56 of `'700'` — correct primary weights for a React Native app.

---

### Pillar 5: Spacing (3/4)

**WARNING — SupportScreen header uses hardcoded paddingTop: 56.**
`SupportScreen.js:144`: `paddingTop: 56` in the header style block. This is a hardcoded guess at device status bar height. On iPhone 14 Pro (59pt notch) or newer Dynamic Island devices (> 56pt), the back button and title will overlap system UI. Fix: `import { useSafeAreaInsets } from 'react-native-safe-area-context'` and apply `paddingTop: insets.top + 12`.

**WARNING — BreathingScreen has no top safe area inset.**
`BreathingScreen.js:94`: `safeArea: { flex: 1, backgroundColor: colors.background }` — no paddingTop. The header row (`header: { paddingHorizontal: 12, paddingVertical: 8 }`) starts at y=0. On notched devices, the back chevron overlaps the status bar. Fix: same insets pattern.

**PASS — Spacing values are mostly drawn from a consistent token set.**
`gap: 8` (66 uses), `gap: 10-12` (47 uses), `padding: 16` (24 uses), `padding: 14` (17 uses). No arbitrary `[Xpx]` Tailwind-style values (project uses React Native StyleSheet). No pixel values outside normal React Native conventions.

**WARNING — Minor inconsistency: padding: 14 vs padding: 16 in card bodies.**
FeedScreen cards use `padding: 16`, FriendsScreen personCard uses `padding: 14`, MessagesScreen rows use `padding: 14`, NotificationsScreen cards use `padding: 14`. The 2pt difference is unlikely to be intentional and creates subtle visual height inconsistency across screens. Standardise card body padding to `16`.

---

### Pillar 6: Experience Design (3/4)

**WARNING — NotificationsScreen has no error state.**
`NotificationsScreen.js:45-67`: `load()` has no `.catch` or error state. If the `supabase.from('notifications')` call fails, `loading` is set to false, `items` stays `[]`, and the user sees the empty state "Пока ничего нет" — indistinguishable from a real empty inbox. Add `const [error, setError] = useState(false)` and show a retry UI on failure.

**WARNING — FriendsScreen search has no loading state for the results list.**
`FriendsScreen.js:256-271`: after search completes, results appear immediately, but there is no skeleton or placeholder during the `searching` state for the results area — only the button shows `ActivityIndicator`. This is minor but results in jarring layout shift.

**PASS — Loading states are present on all primary data-loading screens.**
FeedScreen: `ActivityIndicator` while loading posts. MessagesScreen: `ActivityIndicator` on initial load. NotificationsScreen: `ActivityIndicator`. FriendsScreen: `ActivityIndicator` in `renderFriends`. All chat screens show messages immediately after load.

**PASS — Destructive actions have confirmation dialogs.**
FeedScreen delete post: two-step Alert confirmation (`FeedScreen.js:209-218`). DirectMessageScreen uses ChatActionMenu with explicit delete action. ProfileScreen account deletion: Alert with warning text.

**PASS — Disabled states are implemented on send/submit buttons.**
FeedScreen send: `disabled={!hasContent || posting || mediaUploading}` with `opacity: 0.4`. SupportScreen send: `disabled={!subject.trim() || !message.trim() || sending}` with `opacity: 0.35`. ThoughtsScreen submit: `disabled={!text.trim() || submitting}` with `opacity: 0.4`.

**PASS — Crisis hotline is implemented in correct locations.**
RecommendationsScreen (red level only), ThoughtsScreen (crisis detection in input), DirectMessageScreen (crisis detection in input), ProfileScreen (permanent in settings). All use `tel:88002000122` via `Linking.openURL`.

**PASS — PsychTestScreen close button and saving state.**
`PsychTestScreen.js:88-94`: close button (Ionicons `close`) top-right. Saving state shows ActivityIndicator with "Сохраняем результат…" text. These two previously audited blockers are resolved.

**WARNING — OnboardingMomentScreen step 2 goal save has no error state.**
`OnboardingMomentScreen.js:91-97`: `onPress` handler updates Supabase with no error handling. If the update fails, user proceeds to Recommendations with no feedback that the goal wasn't saved.

**PASS — Realtime subscriptions are cleaned up on unmount.**
DirectMessageScreen: `subscription.unsubscribe()` in `useEffect` cleanup. FishingScreen: `isMounted.current = false` + timer clears. BreathingScreen: `clearInterval` + `clearTimeout` in `useEffect` cleanup.

---

## Registry Safety

shadcn not initialised (no `components.json`). Registry audit skipped.

---

## Files Audited

- `/Users/user/Zface/ustal/screens/FeedScreen.js`
- `/Users/user/Zface/ustal/screens/FriendsScreen.js`
- `/Users/user/Zface/ustal/screens/MessagesScreen.js`
- `/Users/user/Zface/ustal/screens/NotificationsScreen.js`
- `/Users/user/Zface/ustal/screens/BreathingScreen.js`
- `/Users/user/Zface/ustal/screens/FishingScreen.js`
- `/Users/user/Zface/ustal/screens/ThoughtsScreen.js`
- `/Users/user/Zface/ustal/screens/DirectMessageScreen.js`
- `/Users/user/Zface/ustal/screens/SupportScreen.js`
- `/Users/user/Zface/ustal/screens/OnboardingMomentScreen.js`
- `/Users/user/Zface/ustal/screens/RecommendationsScreen.js`
- `/Users/user/Zface/ustal/screens/HomeScreen.js` (lines 1-100)
- `/Users/user/Zface/ustal/screens/ProfileScreen.js` (lines 550-680)
- `/Users/user/Zface/ustal/screens/PsychTestScreen.js`
- `/Users/user/Zface/ustal/theme.js`
- `/Users/user/Zface/ustal/constants.js` (lines 1-80)
