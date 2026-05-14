---
phase: 7
slug: release-prep
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 7 — Validation Strategy

> Per-phase validation contract для Release Prep.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (Expo) + ручные проверки на устройстве |
| **Config file** | `ustal/package.json` (jest секция) |
| **Quick run command** | `cd ustal && npm test -- --passWithNoTests` |
| **Full suite command** | `cd ustal && npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** `npm test -- --passWithNoTests`
- **After every plan wave:** `npm test` + ручная проверка на симуляторе
- **Before `/gsd-verify-work`:** Full suite green + все ручные проверки
- **Max feedback latency:** 30 seconds (automated) / 5 min (manual device)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 07-01 | icons | 1 | assets/icon.png 1024px, splash #FAF7F2 | N/A | manual | `ls ustal/assets/icon.png` | ⬜ pending |
| 07-02 | fcm | 1 | google-services.json присутствует | FCM Service Account Key не в git | manual+auto | `test -f ustal/google-services.json` | ⬜ pending |
| 07-03 | deep-link | 1 | EMAIL_CONFIRM_ENABLED=true в config.js | deep link redirect URI не содержит личных данных | manual | Ручная проверка email confirm на устройстве | ⬜ pending |
| 07-04 | privacy | 1 | docs/index.html не содержит личный email | Нет PII разработчика в public-файлах | auto | `grep -v "@icloud\|@gmail\|Krakova" docs/index.html` | ⬜ pending |
| 07-05 | aso | 2 | Название ≤30 символов, keywords ≤100 | N/A | manual | Проверка в App Store Connect / Google Play Console | ⬜ pending |
| 07-06 | report-alert | 1 | RESEND_API_KEY в Supabase Secrets, webhook активен | Email уходит только на адрес разработчика | manual | Тест-жалоба → проверить email | ⬜ pending |
| 07-07 | age-rating | 2 | 16+ в Apple, Content rating "Mature 16+" в Google | N/A | manual | Скриншот рейтинга в обоих сторах | ⬜ pending |

---

## Wave 0 Requirements

- Существующая Jest-инфраструктура покрывает все требования фазы.
- Новые тест-файлы не нужны — фаза конфигурационная.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Иконка и сплэш отображаются корректно | 07-01 | Визуальная проверка | Собрать EAS preview build, проверить на iOS и Android |
| FCM push-уведомления работают на Android | 07-02 | Требует реальное устройство | Отправить тестовый push через Firebase Console |
| Deep link открывает приложение | 07-03 | Требует реальное устройство + email | Зарегистрироваться, кликнуть ссылку в письме |
| Email-алерт при жалобе приходит | 07-06 | Требует реальный Supabase webhook | Создать тест-жалобу, проверить почту в течение 1 мин |
| Возрастная категория 16+ отображается | 07-07 | Платформенный дашборд | Проверить App Store Connect и Google Play Console |

---

## Validation Sign-Off

- [ ] All tasks have verify command or manual instructions
- [ ] Sampling continuity: no 3 consecutive tasks without verification
- [ ] Wave 0: не требуется (existing infrastructure)
- [ ] No watch-mode flags
- [ ] Feedback latency: automated <30s, manual <5min
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
