# Phase 7: Release Prep — Research

**Researched:** 2026-05-15
**Domain:** EAS Build, Firebase FCM, Supabase Deep Links, App Store / Google Play submission
**Confidence:** HIGH (основные технические решения верифицированы через Context7 и официальную документацию)

---

## Summary

Phase 7 — это не разработка фич, а серия независимых технических задач, каждая из которых блокирует публикацию. Основная цепочка зависимостей: название приложения (`07-01`) разблокирует GitHub Org, политику конфиденциальности (`07-04`) и ASO-метадату (`07-05`). Остальные задачи (`07-02`, `07-03`, `07-06`, `07-07`) независимы и могут выполняться параллельно.

Критический риск — Firebase FCM: без `google-services.json` и `eas.json` EAS Build не включит FCM в production-сборку, push-уведомления на Android в App Store/Play Store работать не будут. `expo-notifications` в Expo Go использует Expo Push Service, а в standalone/production-сборке — FCM V1 напрямую.

Deep link для подтверждения email требует: (1) scheme в `app.json`, (2) redirect URL в Supabase Dashboard, (3) listener в `App.js` + дополнение `EmailConfirmScreen`. Текущая реализация вручную проверяет подтверждение — после добавления deep link поведение меняется: пользователь возвращается в приложение автоматически.

**Primary recommendation:** Начать с `07-01` (название), параллельно выполнить `07-02` + `07-03` + `07-06`, завершить `07-04` + `07-05` + `07-07` после подтверждения названия.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Возрастная категория: 17+ (CONTEXT.md: "Возрастная категория 17+ (не 16+) — контент о депрессии/суициде требует именно 17+")
- Edge Function `report-alert` уже задеплоена — нужно только добавить `RESEND_API_KEY` и настроить webhook
- Stack: React Native 0.81 + Expo ~54 + EAS Build + Supabase

### Claude's Discretion
- Выбор slug и package name для финального названия (если название «Ной» — slug `noy`, package `com.noy.app`)
- Реализация deep link handler в `App.js` (конкретный паттерн)

### Deferred Ideas (OUT OF SCOPE)
- Phase 8 и 9 (Growth & Analytics, Community Features) — не трогать

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Firebase FCM credentials | Build config (EAS) | Android runtime | FCM регистрируется на уровне сборки через `google-services.json` |
| Deep link handling | Frontend (App.js) | Auth (Supabase) | Expo Linking перехватывает URL, Supabase setSession создаёт сессию |
| Email alert на жалобу | Backend (Supabase Edge Function) | Database (webhook trigger) | Edge Function `report-alert` вызывается через Database Webhook |
| ASO-метадата | App Store Connect / Play Console | — | Вводится вручную в сторе, не в коде |
| App icon / splash | Assets (app.json) | EAS Build | PNG-файлы в `assets/`, ссылки в `app.json` |
| Privacy policy URL | Static hosting (GitHub Pages) | — | `docs/index.html` публикуется через GitHub Pages |
| Age rating | App Store Connect / Play Console | — | Анкета заполняется в Dashboard, не в коде |

---

## Standard Stack

### Core — уже установлено
| Пакет | Версия | Назначение |
|-------|--------|------------|
| `expo` | ~54.0.33 | Managed workflow |
| `expo-notifications` | ~0.32.17 | Push-уведомления (уже используется) |
| `@supabase/supabase-js` | ^2.78.0 | Auth + DB (уже используется) |
| `expo-linking` | ~7.0.x (в составе SDK 54) | Deep link listener |

[VERIFIED: Context7 /llmstxt/expo_dev_llms_txt]

### Нужно добавить для deep link
| Пакет | Версия | Назначение |
|-------|--------|------------|
| `expo-auth-session` | ~5.5.x | `makeRedirectUri()` + `QueryParams.getQueryParams()` |

[VERIFIED: npm registry — expo-auth-session@55.0.16 актуальна для SDK 54]

**Установка:**
```bash
npx expo install expo-auth-session --npm
```

### Инструменты (не npm-пакеты)
| Инструмент | Где брать | Назначение |
|-----------|-----------|------------|
| `eas-cli` | `npm install -g eas-cli` | EAS Build + Submit + Credentials |
| `google-services.json` | Firebase Console | FCM для Android |
| FCM V1 Service Account Key | Firebase Console → Project settings → Service accounts | Загружается в EAS через `eas credentials` |

[VERIFIED: docs.expo.dev/push-notifications/fcm-credentials]

---

## Architecture Patterns

### Recommended Project Structure — изменения только в этих файлах
```
ustal/
├── app.json                  # name, slug, scheme, bundleIdentifier, package, googleServicesFile
├── eas.json                  # (новый) build profiles: production, preview
├── assets/
│   ├── icon.png              # 1024×1024, финальный логотип
│   ├── adaptive-icon.png     # 1024×1024, foreground layer
│   └── splash-icon.png       # содержимое сплэша
├── config.js                 # EMAIL_CONFIRM_ENABLED = true
├── App.js                    # + deep link listener (useLinkingURL + createSessionFromUrl)
└── screens/
    └── EmailConfirmScreen.js # + deep link success/error UI (07-03)
supabase/functions/
└── report-alert/             # уже существует — добавить RESEND_API_KEY в Secrets
docs/
└── index.html                # заменить krakov.arseniy@icloud.com на корпоративный email
```

---

### Pattern 1: FCM V1 для Android (07-02)

**Что делать:**

1. Создать Firebase project на https://console.firebase.google.com
2. Добавить Android-приложение с финальным `package` (например `com.noy.app`)
3. Скачать `google-services.json` → положить в `ustal/`
4. Добавить в `app.json`:
```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```
5. Скачать FCM V1 Service Account Key: Firebase Console → Project settings → Service accounts → Generate New Private Key → JSON-файл
6. Добавить JSON-файл в `.gitignore` (содержит приватные ключи)
7. Загрузить в EAS:
```bash
eas credentials
# → Android → production → Google Service Account
# → Manage your Google Service Account Key for Push Notifications (FCM V1)
# → Upload new key
```

[VERIFIED: docs.expo.dev/push-notifications/fcm-credentials]

**Важно:** `google-services.json` содержит только публичные идентификаторы — его МОЖНО коммитить. FCM Service Account Key (отдельный JSON) — НЕЛЬЗЯ, добавить в `.gitignore`.

---

### Pattern 2: Deep link для подтверждения email (07-03)

**Шаг 1 — app.json: добавить scheme**
```json
{
  "expo": {
    "scheme": "noy"
  }
}
```
Формат: строчные буквы, цифры, `+`, `.`, `-`. Для названия «Ной» → `noy`.

[VERIFIED: Context7 /llmstxt/expo_dev_llms_txt — URL Scheme Configuration]

**Шаг 2 — Supabase Dashboard**
- Authentication → URL Configuration → Additional Redirect URLs:
  - Добавить: `noy://**`
- Site URL можно оставить существующим (используется как fallback)

[CITED: supabase.com/docs/guides/auth/native-mobile-deep-linking]

**Шаг 3 — включить EMAIL_CONFIRM_ENABLED**
```js
// ustal/config.js
export const EMAIL_CONFIRM_ENABLED = true;
```
И в Supabase Dashboard: Authentication → Settings → Confirm email → Enable.

**Шаг 4 — handler в App.js**

```javascript
// Добавить в App.js, внутри компонента App или NavigationContainer wrapper
import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';

const createSessionFromUrl = async (url) => {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) return { error: errorCode };
  const { access_token, refresh_token } = params;
  if (!access_token) return { error: 'no_token' };
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) return { error: error.message };
  return { session: data.session };
};

// В компоненте:
const url = Linking.useLinkingURL();
useEffect(() => {
  if (url && url.includes('access_token')) {
    createSessionFromUrl(url).then(({ session, error }) => {
      if (session) navigation.navigate('Main');
      else navigation.navigate('EmailConfirm', { deepLinkError: error });
    });
  }
}, [url]);
```

[CITED: supabase.com/docs/guides/auth/native-mobile-deep-linking]

**Важный нюанс:** Supabase использует `#` (fragment) в redirect URL по умолчанию, а React Native Linking не парсит фрагменты. Supabase JS v2 с PKCE flow использует `?` query params — убедиться, что `detectSessionInUrl: false` в клиенте Supabase (уже есть или нужно добавить).

**Шаг 5 — обновить EmailConfirmScreen**
Добавить новый UI-статус: `deepLinkSuccess` и `deepLinkError` (specs в 07-UI-SPEC.md уже описаны).

---

### Pattern 3: eas.json для production-сборки (07-02)

EAS Build требует `eas.json` в директории с `app.json` (`ustal/`).

```json
{
  "cli": {
    "version": ">= 15.0.0"
  },
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

[VERIFIED: Context7 /llmstxt/expo_dev_llms_txt — EAS Build eas.json Schema]

---

### Pattern 4: Database Webhook → Edge Function для email-алертов на жалобы (07-06)

Edge Function `report-alert` уже задеплоена. Нужно только:

**Шаг 1 — добавить RESEND_API_KEY в Supabase Secrets**
- Supabase Dashboard → Project Settings → Edge Functions → Secrets
- Добавить: `RESEND_API_KEY` = ключ из resend.com

**Шаг 2 — настроить Database Webhook**
- Supabase Dashboard → Database → Webhooks → Create new webhook
- Name: `report-alert-webhook`
- Table: `public.reports`
- Events: INSERT
- Type: Supabase Edge Functions
- Function: `report-alert`
- Method: POST

Payload, который Edge Function получает при INSERT:
```typescript
{
  type: 'INSERT',
  table: 'reports',
  schema: 'public',
  record: {
    id: '...',
    reporter_id: '...',
    reported_user_id: '...',
    reason: '...'
  },
  old_record: null
}
```

[VERIFIED: supabase.com/docs/guides/database/webhooks]

**Шаблон Edge Function (если нужно создать/обновить):**
```typescript
// supabase/functions/report-alert/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const payload = await req.json();
  const { record } = payload;
  
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
    },
    body: JSON.stringify({
      from: 'alerts@yourdomain.com',
      to: ['krakov.arseniy@icloud.com'],
      subject: `Новая жалоба: ${record.reason}`,
      html: `<p>Reporter: ${record.reporter_id}</p><p>On: ${record.reported_user_id}</p><p>Reason: ${record.reason}</p>`,
    }),
  });
  
  return new Response(JSON.stringify({ ok: res.ok }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

[CITED: resend.com/docs/send-with-supabase-edge-functions]

---

### Pattern 5: app.json — финальные поля для production

```json
{
  "expo": {
    "name": "Ной",
    "slug": "noy",
    "scheme": "noy",
    "version": "1.0.0",
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.noy.app"
    },
    "android": {
      "package": "com.noy.app",
      "googleServicesFile": "./google-services.json",
      "adaptiveIcon": { ... },
      "edgeToEdgeEnabled": true
    }
  }
}
```

[ASSUMED] `supportsTablet: false` — приложение не оптимизировано под iPad, лучше отключить.

---

## Don't Hand-Roll

| Задача | Не строить | Использовать |
|--------|-----------|--------------|
| Push credentials для Android | Ручной upload FCM key в код | `eas credentials` → FCM V1 Service Account |
| Deep link parsing | Ручной split/regex URL | `expo-auth-session/build/QueryParams.getQueryParams()` |
| Redirect URI для Supabase | Хардкод строки | `makeRedirectUri()` из `expo-auth-session` |
| EAS сборка | Ручной Xcode/Android Studio build | `eas build --platform ios/android` |
| Email из Edge Function | nodemailer / SMTP | Resend API (уже используется в проекте) |
| Screenshot resize для ASO | Ручная обрезка | Симулятор/устройство + Screenshot API или сервис типа AppShotCreator |

---

## Common Pitfalls

### Pitfall 1: google-services.json добавлен, но FCM Service Account Key — нет
**Что происходит:** `google-services.json` регистрирует приложение в Firebase (публичные IDs). Но для отправки push-уведомлений EAS нужен отдельный FCM V1 Service Account Key (приватный JSON). Без него push в production-сборке не работают — Expo Push Service не может авторизоваться в FCM.
**Как избежать:** Выполнить оба шага: добавить `google-services.json` в `app.json` И загрузить Service Account Key через `eas credentials`.
**Признак проблемы:** Expo Go уведомления работают, production-сборка — нет.
[VERIFIED: docs.expo.dev/push-notifications/fcm-credentials]

### Pitfall 2: Deep link URL с `#` фрагментом не парсится
**Что происходит:** Supabase по умолчанию кодирует токены в URL-фрагменте (`#access_token=...`). React Native `Linking` не обрабатывает фрагменты — `url` приходит обрезанным.
**Как избежать:** Использовать PKCE flow (включён в `supabase-js` v2 по умолчанию для мобильных). Убедиться, что `detectSessionInUrl: false` в конфиге Supabase-клиента, и что Supabase отправляет query params (`?`), а не fragment (`#`). Проверить шаблон письма в Supabase Dashboard → Authentication → Email Templates.
[CITED: github.com/orgs/supabase/discussions/10754]

### Pitfall 3: scheme в app.json не применяется в Expo Go
**Что происходит:** `scheme` в `app.json` — build-time конфигурация. В Expo Go не работает. Deep link тестируется только в dev build (`eas build --profile preview`) или production build.
**Как избежать:** Для тестирования deep link создать preview-сборку (`eas build --profile preview --platform ios`), не пытаться тестировать в Expo Go.
[VERIFIED: Context7 /llmstxt/expo_dev_llms_txt — "This is a build-time configuration with no effect in Expo Go"]

### Pitfall 4: bundleIdentifier / package не совпадают с Firebase
**Что происходит:** Firebase App и app.json должны использовать один и тот же package name. Если создать Firebase App с одним именем, а `app.json` изменить позже — `google-services.json` не будет соответствовать билду.
**Как избежать:** Сначала выбрать финальное название и package, создать Firebase App с этим package, потом скачать `google-services.json`.

### Pitfall 5: Database Webhook тип "HTTP Request" вместо "Supabase Edge Functions"
**Что происходит:** Supabase Dashboard предлагает два типа webhook: HTTP Request (любой URL) и Supabase Edge Functions (встроенная интеграция). При выборе HTTP Request нужно вручную указывать Authorization header с anon key — иначе Edge Function вернёт 401.
**Как избежать:** Выбирать тип "Supabase Edge Functions" при создании webhook — авторизация настраивается автоматически.
[VERIFIED: supabase.com/docs/guides/database/webhooks]

### Pitfall 6: App Store age rating — новая система с 2025
**Что происходит:** Apple обновила систему возрастных рейтингов в 2025 году, добавив 13+, 16+, 18+ к существующим 4+ и 9+. Старых категорий (в т.ч. 17+) больше нет. Дедлайн обновления анкеты — 31 января 2026. Apps с неотвеченными новыми вопросами блокируются для обновлений.
**Правильная категория для Zface:** По новой системе — 16+ (частый контент о психическом здоровье + messaging/chat + user-generated content). При наличии контента о суициде/депрессии отвечать честно в секции "Medical or Wellness" → frequent → получит 16+.
**Как избежать:** Заполнить анкету честно. Не занижать категорию — Apple может принудительно повысить рейтинг при ревью.
[VERIFIED: developer.apple.com/news/?id=ks775ehf, asoworld.com age rating guide]

---

## Code Examples

### Deep link listener — App.js
```javascript
// Source: supabase.com/docs/guides/auth/native-mobile-deep-linking + Context7
import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';

// В компоненте App (вне NavigationContainer) или внутри корневого Stack:
const url = Linking.useLinkingURL();

useEffect(() => {
  if (!url) return;
  
  const { params } = QueryParams.getQueryParams(url);
  const { access_token, refresh_token, error_code } = params;
  
  if (access_token && refresh_token) {
    supabase.auth.setSession({ access_token, refresh_token })
      .then(({ data, error }) => {
        if (!error && data.session) {
          // Сессия установлена — переход в Main
        }
      });
  }
}, [url]);
```

### app.json — полный production-конфиг
```json
{
  "expo": {
    "name": "Ной",
    "slug": "noy",
    "scheme": "noy",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#FAF7F2"
    },
    "plugins": [
      ["expo-notifications", { "icon": "./assets/icon.png", "color": "#8B7355" }]
    ],
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.noy.app"
    },
    "android": {
      "package": "com.noy.app",
      "googleServicesFile": "./google-services.json",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FAF7F2"
      },
      "edgeToEdgeEnabled": true
    }
  }
}
```

### Webhook payload — Edge Function report-alert
```typescript
// Source: supabase.com/docs/guides/database/webhooks
type WebhookPayload = {
  type: 'INSERT';
  table: 'reports';
  schema: 'public';
  record: {
    id: string;
    reporter_id: string;
    reported_user_id: string;
    reason: string;
    created_at: string;
  };
  old_record: null;
};
```

---

## State of the Art

| Старый подход | Актуальный подход | Изменено | Влияние |
|--------------|------------------|----------|---------|
| FCM Legacy API (ServerKey) | FCM V1 API (Service Account) | Июнь 2024 | Google отключил Legacy API 20.06.2024 — только V1 |
| Expo Push Token (Expo Go) | FCM V1 в production builds | Всегда было так | В Expo Go работает, в production-сборке нужен FCM |
| App Store 17+ rating | App Store 16+ rating | 2025 | Apple убрала категорию 17+, добавила 16+ |
| `Linking.useURL()` | `Linking.useLinkingURL()` | SDK 53+ | `useURL()` возвращает null на iOS для magic links |

[VERIFIED: expo.dev/blog/expo-adds-support-for-fcm-http-v1-api, developer.apple.com/news/?id=ks775ehf]

---

## ASO-метадата — специфика Russian market

### Поля и лимиты

| Поле | App Store | Google Play | RuStore |
|------|-----------|-------------|---------|
| Название | 30 симв. (indexed) | 30 симв. (indexed) | 80 симв. (indexed) |
| Подзаголовок | 30 симв. (indexed) | — | — |
| Короткое описание | — | 80 симв. (indexed) | 80 симв. |
| Ключевые слова | 100 симв. (indexed, не повторять из названия) | нет отдельного поля | — |
| Длинное описание | 4000 симв. (не indexed в App Store) | 4000 симв. (indexed, 2-3x плотность ключевых слов) | 4000 симв. |

[CITED: asoworld.com/blog/rustore-vs-google-play-vs-app-store-in-russia]

### Особенности русскоязычного рынка
- Транслитерационные запросы: пользователи набирают кириллические слова латиницей — включить обе формы при наличии места
- Падежные формы: "тревога", "тревоги", "тревогу" — разные запросы в поиске
- Google Play индексирует длинное описание — ключевые слова повторять 2-3 раза естественным образом

### RuStore — нужно ли?
[ASSUMED] Для русскоязычного рынка RuStore занимает заметную долю после блокировки Google Play на части устройств. Выход туда потребует отдельной APK-сборки и регистрации российского юрлица/ИП. Эта задача выходит за рамки Phase 7.

---

## Open Questions

1. **Финальное название: «Ной» или другое?**
   - Что знаем: кандидат «Ной», slug `noy`, package `com.noy.app`
   - Что неясно: окончательное решение пользователя
   - Рекомендация: заблокировать 07-01 до подтверждения названия, все остальные планы — независимо

2. **Email поддержки для сторов — какой домен?**
   - Что знаем: текущий `krakov.arseniy@icloud.com` нужно скрыть из `docs/index.html` и PUBLISH.md
   - Что неясно: будет ли создан отдельный домен или достаточно Gmail/iCloud с другим именем
   - Рекомендация: `support@noy.app` через Resend Custom Domain или просто новый iCloud-алиас

3. **Подтверждение email: нужен ли `expo-auth-session` весь пакет?**
   - Что знаем: используется только `expo-auth-session/build/QueryParams.getQueryParams`
   - Альтернатива: ручной парсинг URL через `new URL(url).searchParams` или `expo-linking` без доп. пакета
   - Рекомендация: установить `expo-auth-session` — официальный паттерн, меньше рисков

---

## Environment Availability

| Зависимость | Нужна для | Доступна | Версия | Fallback |
|------------|-----------|----------|--------|---------|
| Node.js | EAS CLI | ✓ | v20.20.2 | — |
| npm | установка пакетов | ✓ | 10.8.2 | — |
| eas-cli | EAS Build + Credentials | ✗ | — | Установить: `npm install -g eas-cli` |
| Firebase Console (браузер) | google-services.json | — | — | Без аккаунта Firebase нет FCM |
| Resend API Key | report-alert Edge Function | [ASSUMED] уже есть (SupportScreen использует Resend) | — | Создать на resend.com |
| Expo аккаунт | EAS Build | [ASSUMED] есть (проект уже использует expo) | — | Зарегистрироваться на expo.dev |
| Apple Developer аккаунт ($99/год) | iOS build + App Store | [ASSUMED] ещё не создан | — | Обязательно для релиза |
| Google Play Console ($25 разово) | Android релиз | [ASSUMED] ещё не создан | — | Обязательно для релиза |

**Блокирующие отсутствия:**
- `eas-cli` — нужен для FCM credentials и сборки
- Apple Developer аккаунт — без него iOS сборка невозможна
- Google Play Console аккаунт — без него Android публикация невозможна

---

## Validation Architecture

> Phase 7 — конфигурационная и ассет-фаза. Автоматические тесты не применимы к большинству задач.

### Ручная верификация по задаче

| Deliverable | Тип проверки | Команда / действие |
|------------|-------------|-------------------|
| 07-01: Иконка/сплэш | Визуальная | `npm start` → открыть в Expo Go, проверить иконку на рабочем столе |
| 07-02: FCM | Integration test | Отправить тестовый push через Expo Push Tool после production-сборки |
| 07-03: Deep link | Manual | Открыть email confirmation link на устройстве с preview-сборкой |
| 07-04: Privacy policy | Визуальная | Открыть https://[org].github.io/[repo]/, проверить email |
| 07-05: ASO | Визуальная | Скриншоты в App Store Connect / Play Console preview |
| 07-06: Report alert | Integration test | Создать тестовую жалобу через UI → проверить inbox |
| 07-07: Age rating | Dashboard | Заполнить анкету в App Store Connect + Play Console |

**Команды для preview-сборки (ручное тестирование deep link):**
```bash
eas build --profile preview --platform ios
# или Android:
eas build --profile preview --platform android
```

---

## Security Domain

### Применимые ASVS категории

| ASVS категория | Применима | Контроль |
|----------------|----------|---------|
| V2 Authentication | да | Supabase Auth — не меняется в Phase 7; deep link не создаёт новый auth flow, только завершает существующий |
| V3 Session Management | да | `setSession(access_token, refresh_token)` — токены из URL, нужно убедиться в HTTPS redirect |
| V4 Access Control | нет | Не меняется в Phase 7 |
| V5 Input Validation | нет | Webhook payload от Supabase — не пользовательский ввод |
| V6 Cryptography | нет | FCM credentials не хранятся в коде — только в EAS secrets |

### Угрозы специфичные для Phase 7

| Угроза | Категория STRIDE | Стандартная митигация |
|--------|-----------------|----------------------|
| FCM Service Account Key в git | Information Disclosure | Добавить в `.gitignore` немедленно |
| RESEND_API_KEY в Edge Function | Information Disclosure | Хранить только в Supabase Secrets, не в коде |
| Deep link token перехват | Spoofing | HTTPS redirect URL, PKCE flow (суpabase-js v2 по умолчанию) |
| Open redirect в Supabase | Elevation of Privilege | Разрешать только `noy://**` в Additional Redirect URLs |

---

## Assumptions Log

| # | Утверждение | Раздел | Риск при ошибке |
|---|-------------|--------|----------------|
| A1 | `supportsTablet: false` — приложение не оптимизировано под iPad | Pattern 5 (app.json) | Низкий — App Store не требует iPad поддержку |
| A2 | RuStore — вне scope Phase 7 | ASO-метадата | Средний — если целевая аудитория в России, RuStore важен |
| A3 | Resend API Key уже есть (SupportScreen использует Resend) | Environment Availability | Средний — если ключа нет, нужно создать на resend.com |
| A4 | Expo аккаунт создан (проект уже использует Expo) | Environment Availability | Низкий — если нет, регистрация бесплатна |
| A5 | Apple Developer + Google Play аккаунты ещё не созданы | Environment Availability | Высокий — без них публикация невозможна; $99 + $25 |
| A6 | Правильная возрастная категория по новой системе Apple — 16+ | Age Rating | Средний — Apple может назначить другую при ревью |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/llmstxt/expo_dev_llms_txt` — FCM credentials, deep linking scheme, eas.json schema, Linking API
- [docs.expo.dev/push-notifications/fcm-credentials](https://docs.expo.dev/push-notifications/fcm-credentials/) — полный гайд FCM V1
- [supabase.com/docs/guides/auth/native-mobile-deep-linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking) — deep link для Expo RN
- [supabase.com/docs/guides/database/webhooks](https://supabase.com/docs/guides/database/webhooks) — Database Webhooks → Edge Functions

### Secondary (MEDIUM confidence)
- [developer.apple.com/news/?id=ks775ehf](https://developer.apple.com/news/?id=ks775ehf) — обновление системы возрастных рейтингов App Store 2025
- [developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/) — категории рейтингов
- [resend.com/docs/send-with-supabase-edge-functions](https://resend.com/docs/send-with-supabase-edge-functions) — Resend + Edge Functions
- [asoworld.com RuStore vs Google Play vs App Store comparison 2026](https://asoworld.com/blog/rustore-vs-google-play-vs-app-store-in-russia-a-side-by-side-aso-comparison-for-2026/) — ASO для российского рынка
- [expo.dev/blog/expo-adds-support-for-fcm-http-v1-api](https://expo.dev/blog/expo-adds-support-for-fcm-http-v1-api) — FCM V1 в Expo

### Tertiary (LOW confidence)
- WebSearch результаты об IARC и Google Play content rating — не верифицированы через Play Console напрямую

---

## Metadata

**Confidence breakdown:**
- Firebase FCM setup: HIGH — верифицировано через Context7 + официальный docs.expo.dev
- Deep link implementation: HIGH — верифицировано через официальный Supabase docs + Context7
- EAS Build config: HIGH — верифицировано через Context7
- App Store age rating: MEDIUM — Apple изменила систему в 2025, официальная страница подтверждает категории
- ASO metadata: MEDIUM — цифры лимитов полей верифицированы, стратегия для Russian market — один источник
- Database Webhook setup: HIGH — официальный Supabase docs

**Research date:** 2026-05-15
**Valid until:** 2026-07-15 (стабильные API; age rating — Apple может снова изменить)
