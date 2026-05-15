---
plan: "07-01"
status: done
completed: 2026-05-15
---

# 07-01 SUMMARY — App Config & Assets

## Финальное название и идентификаторы

| Поле | Значение |
|------|----------|
| name | `!один` |
| slug | `odin` |
| scheme | `odin` |
| bundleIdentifier (iOS) | `com.odin.app` |
| package (Android) | `com.odin.app` |

## Изменённые поля app.json

| Поле | Было | Стало |
|------|------|-------|
| `expo.name` | `"ustal"` | `"!один"` |
| `expo.slug` | `"ustal"` | `"odin"` |
| `expo.scheme` | — | `"odin"` |
| `expo.ios.supportsTablet` | `true` | `false` |
| `expo.ios.bundleIdentifier` | — | `"com.odin.app"` |
| `expo.android.package` | — | `"com.odin.app"` |
| `expo.android.googleServicesFile` | — | `"./google-services.json"` |
| `expo.plugins[0][1].color` | `"#7c3aed"` | `"#8B7355"` |

## PNG-ассеты

| Файл | Размер | Источник |
|------|--------|----------|
| `assets/icon.png` | 26.9 KB | Рендер SVG Playwright 1024×1024, фон #FAF3E8 |
| `assets/adaptive-icon.png` | 31.3 KB | Рендер SVG Playwright 1024×1024, прозрачный фон |
| `assets/splash-icon.png` | 31.3 KB | Рендер SVG Playwright 1024×1024, прозрачный фон |

Брендинг: «!один» — двойное лицо, левое грустное (вертикальное зеркало кривой Безье), правое улыбается. Палитра #FAF3E8 / #B8946A / #6B5744.
Исходник: `odin-brand-final.html` (Obsidian, Проекты/Zface).
