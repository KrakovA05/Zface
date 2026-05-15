# Phase 7: Release Prep — Context

## Goal

Все блокеры релиза устранены — приложение готово к сборке, публикации и работает корректно для конечных пользователей.

## Status

Ready to plan. 0/7 планов выполнено.

## Deliverables

| # | Deliverable | Depends on | Status |
|---|-------------|------------|--------|
| 07-01 | Финальное название + иконка + сплэш | Решение по названию | Blocked |
| 07-02 | Firebase FCM для Android | - | Not started |
| 07-03 | Deep link для подтверждения email | - | Not started |
| 07-04 | Скрыть личные данные (GitHub Org + email) | 07-01 (название для Org) | Blocked |
| 07-05 | ASO-метадата + 5 скриншотов | 07-01 | Blocked |
| 07-06 | Email-алерт при жалобе (RESEND_API_KEY) | - | Not started |
| 07-07 | Возрастная категория 16+ в сторах | - | Not started |

## Success Criteria

1. Приложение имеет финальное название, иконку и сплэш — никаких Expo-заглушек
2. Push-уведомления работают на Android через Firebase FCM
3. Подтверждение email открывает приложение через deep link, а не браузер
4. Политика конфиденциальности не содержит личных данных разработчика
5. ASO-метадата заполнена: название, подзаголовок, ключевые слова, 5 скриншотов
6. Новая жалоба в таблице reports → email-алерт разработчику в течение минуты

## Key Files

- `ustal/config.js` — EMAIL_CONFIRM_ENABLED (сейчас false)
- `app.json` — packageName, название, версия, googleServicesFile
- `assets/` — icon.png, adaptive-icon.png, splash-icon.png (сейчас Expo-заглушки)
- `docs/index.html` — политика конфиденциальности (содержит личный email)
- Supabase Edge Functions: `report-alert` (задеплоена, нужен RESEND_API_KEY)
- Supabase Dashboard → Database → Webhooks (настроить триггер на INSERT в reports)

## Critical Path

Название → Иконка → ASO (07-01 разблокирует 07-04 и 07-05)

07-02, 07-03, 07-06, 07-07 — параллельно, не зависят от названия.

## Notes

- Рассматривается название «Ной» — метафора: и имя, и «ноет»
- Возрастная категория 16+ (Apple убрал категорию 17+ в 2025 году) — контент о депрессии/суициде → 16+ в App Store; "Mature 16+" в Google Play
- Edge Function `report-alert` уже задеплоена — нужно только добавить RESEND_API_KEY в Supabase Secrets и настроить webhook
- EAS Build команды задокументированы в PUBLISH.md
