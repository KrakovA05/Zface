# Phase 7: Release Prep — Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 6 (новых/изменяемых)
**Analogs found:** 5 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `ustal/app.json` | config | build-time | `ustal/app.json` (текущий) | exact (самомодификация) |
| `ustal/config.js` | config | — | `ustal/config.js` (текущий) | exact (самомодификация) |
| `ustal/screens/EmailConfirmScreen.js` | screen/component | request-response | `ustal/screens/EmailConfirmScreen.js` (текущий) | exact (расширение) |
| `docs/index.html` | static/config | — | `docs/index.html` (текущий) | exact (точечная замена строки) |
| `ustal/google-services.json` | config | — | нет аналога в репо | no analog |
| `ustal/eas.json` | config | build-time | нет аналога в репо | no analog |

---

## Pattern Assignments

### `ustal/app.json` (config, build-time)

**Analog:** `ustal/app.json` — текущий файл (строки 1–38)

**Текущая структура** (`ustal/app.json`, строки 1–38):
```json
{
  "expo": {
    "name": "ustal",
    "slug": "ustal",
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
      ["expo-notifications", { "icon": "./assets/icon.png", "color": "#7c3aed" }]
    ],
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FAF7F2"
      },
      "edgeToEdgeEnabled": true
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

**Целевое состояние после 07-01 + 07-02** — добавить/изменить поля:
- `name`: `"ustal"` → финальное название (кандидат: `"Ной"`)
- `slug`: `"ustal"` → `"noy"` (если название «Ной»)
- `scheme`: отсутствует → добавить `"noy"` (нужен для deep link 07-03)
- `plugins[expo-notifications].color`: `"#7c3aed"` → `"#8B7355"` (цвет из дизайн-системы)
- `ios.supportsTablet`: `true` → `false`
- `ios.bundleIdentifier`: отсутствует → добавить `"com.noy.app"`
- `android.package`: отсутствует → добавить `"com.noy.app"`
- `android.googleServicesFile`: отсутствует → добавить `"./google-services.json"`
- Секция `"web"` — оставить как есть

**Важно:** `backgroundColor` в splash (`"#FAF7F2"`) — уже совпадает с дизайн-системой. Не менять.

---

### `ustal/config.js` (config, feature-flag)

**Analog:** `ustal/config.js` (строки 1–4)

**Текущее состояние** (`ustal/config.js`, строки 1–4):
```js
// Feature flags
// Чтобы включить фичу — поменяй false на true и дай команду Клоду

export const EMAIL_CONFIRM_ENABLED = false;
```

**Целевое состояние** (07-03):
```js
// Feature flags
// Чтобы включить фичу — поменяй false на true и дай команду Клоду

export const EMAIL_CONFIRM_ENABLED = true;
```

Единственное изменение — `false` → `true`. Структура файла не меняется.

**Где используется:** Проверить использование `EMAIL_CONFIRM_ENABLED` в `RegisterScreen.js` (ожидается условие типа `if (EMAIL_CONFIRM_ENABLED) navigate('EmailConfirm')`).

---

### `ustal/screens/EmailConfirmScreen.js` (screen, request-response)

**Analog:** `ustal/screens/EmailConfirmScreen.js` — текущий файл (строки 1–130)

**Текущий паттерн imports** (строки 1–6):
```js
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';
```

**Нужно добавить imports** для 07-03:
```js
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
```

**Текущий паттерн компонента** (строки 8–10):
```js
export default function EmailConfirmScreen({ route, navigation }) {
  const { email, password, username, labels } = route.params;
  const [checking, setChecking] = useState(false);
```

**Расширение state** для deep link статусов (07-03):
```js
  const [deepLinkStatus, setDeepLinkStatus] = useState(null); // null | 'success' | 'error'
  const [deepLinkError, setDeepLinkError] = useState(null);
```

**Паттерн успешного перехода** (строки 26–28, скопировать для deep link success):
```js
store.userId = data.user.id;
store.username = username;
store.email = email;
navigation.navigate('Test');
```

**Паттерн error UI** (строки 30–35, аналог для deep link error):
```js
} else if (error?.message?.toLowerCase().includes('email')) {
  Alert.alert(
    'Письмо ещё не подтверждено',
    'Открой письмо от нас и нажми на ссылку подтверждения.',
    [{ text: 'Понятно' }]
  );
} else {
  Alert.alert('Ошибка', error?.message || 'Попробуй ещё раз.');
}
```

**Паттерн кнопки** (строки 69–79, переиспользовать стиль `primaryBtn`):
```jsx
<TouchableOpacity
  style={styles.primaryBtn}
  onPress={checkConfirmed}
  disabled={checking}
  activeOpacity={0.8}
>
  {checking
    ? <ActivityIndicator color={colors.onAccent} />
    : <Text style={styles.primaryBtnText}>Я подтвердил</Text>
  }
</TouchableOpacity>
```

**Паттерн iconWrap** (строки 56–58, переиспользовать для иконки успеха/ошибки):
```jsx
<View style={styles.iconWrap}>
  <Ionicons name="mail-outline" size={48} color={colors.accent} />
</View>
```
Для success: `name="checkmark-circle-outline"`, `color={colors.accent}`.
Для error: `name="alert-circle-outline"`, `color={colors.error}` (или `#E74C3C`).

**Паттерн styles** (строки 95–130): все стили переиспользуются без изменений — контейнер, кнопки, тексты совпадают с нужным UI deep link.

**Deep link handler** — добавить внутри компонента (перед return):
```js
// Паттерн из 07-RESEARCH.md Pattern 2, Шаг 4
const url = Linking.useLinkingURL();
useEffect(() => {
  if (!url || !url.includes('access_token')) return;
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    setDeepLinkStatus('error');
    setDeepLinkError(errorCode);
    return;
  }
  const { access_token, refresh_token } = params;
  if (!access_token) return;
  supabase.auth.setSession({ access_token, refresh_token })
    .then(async ({ data, error }) => {
      if (error || !data.session) {
        setDeepLinkStatus('error');
        setDeepLinkError(error?.message || 'session_error');
        return;
      }
      // Дозаполнить store и создать запись users
      await supabase.from('users').upsert({
        user_id: data.user.id,
        username,
        email,
        labels: labels || [],
      }, { onConflict: 'user_id' });
      store.userId = data.user.id;
      store.username = username;
      store.email = email;
      setDeepLinkStatus('success');
      setTimeout(() => navigation.navigate('Test'), 1500);
    });
}, [url]);
```

**Предупреждение:** `route.params` может быть `undefined` при входе через deep link (если приложение было закрыто). Добавить защиту: `const { email = '', password = '', username = '', labels = [] } = route.params || {};`.

---

### `docs/index.html` (static, —)

**Analog:** `docs/index.html` — текущий файл (строки 1–118)

**Единственное изменение** (строка 113):
```html
<!-- БЫЛО: -->
<p>Вопросы и запросы по данным: <a href="mailto:krakov.arseniy@icloud.com">krakov.arseniy@icloud.com</a></p>

<!-- СТАЛО (placeholder до получения корпоративного email): -->
<p>Вопросы и запросы по данным: <a href="mailto:support@noy.app">support@noy.app</a></p>
```

Если корпоративный email ещё не создан — временно использовать алиас (оговорить с пользователем). Вся остальная структура HTML — без изменений.

---

### `ustal/google-services.json` (config, —)

**Аналога нет** — файл создаётся вручную (скачивается из Firebase Console).

**Содержимое:** Генерируется Firebase при добавлении Android-приложения. Содержит `project_id`, `mobilesdk_app_id`, `api_key`, `client_id` — всё публичные идентификаторы.

**Шаблон структуры** (для справки — реальные значения из Firebase):
```json
{
  "project_info": {
    "project_number": "...",
    "project_id": "noy-app",
    "storage_bucket": "noy-app.appspot.com"
  },
  "client": [{
    "client_info": {
      "mobilesdk_app_id": "1:...:android:...",
      "android_client_info": {
        "package_name": "com.noy.app"
      }
    },
    "api_key": [{ "current_key": "..." }],
    "services": { "appinvite_service": { "other_platform_oauth_client": [] } }
  }],
  "configuration_version": "1"
}
```

**Коммитить можно** — файл содержит только публичные ID. FCM Service Account Key (отдельный JSON) — в `.gitignore`.

**`.gitignore` паттерн** (добавить в `/Users/user/Zface/ustal/.gitignore`):
```
# FCM Service Account Key — НИКОГДА не коммитить
*service-account*.json
*serviceAccount*.json
firebase-adminsdk*.json
```
Текущий `.gitignore` (`ustal/.gitignore` строки 1–8): `node_modules/`, `.expo/`, `*.log`, `.DS_Store`, `.env`, `.agents/`, `.claude/skills/`, `skills-lock.json`.

---

### `ustal/eas.json` (config, build-time)

**Аналога нет** — новый файл. Структура берётся из официальной документации EAS (верифицировано в 07-RESEARCH.md Pattern 3).

**Шаблон** (из 07-RESEARCH.md, строки 215–237):
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

**Расположение:** `ustal/eas.json` (рядом с `ustal/app.json` — EAS ищет `eas.json` в той же директории, что и `app.json`).

---

## Shared Patterns

### Supabase Auth session — setSession pattern
**Source:** `ustal/supabase.js` (строки 1–4) + паттерн из `ustal/screens/EmailConfirmScreen.js` (строки 14–27)
**Apply to:** `EmailConfirmScreen.js` (deep link handler)

Supabase-клиент создан без `detectSessionInUrl`:
```js
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```
Для PKCE flow (Supabase JS v2 по умолчанию на мобильных) это корректно — добавлять `detectSessionInUrl: false` не требуется, если только не возникнет проблема с `#` фрагментом (см. Pitfall 2 в RESEARCH.md).

### Store mutation pattern после auth
**Source:** `ustal/screens/EmailConfirmScreen.js` (строки 26–28) + `ustal/App.js` (строки 321–330)
**Apply to:** deep link success handler в `EmailConfirmScreen.js`

Паттерн: upsert в `users` → заполнить `store.*` → navigate:
```js
store.userId = data.user.id;
store.username = username;
store.email = email;
navigation.navigate('Test');
```

### Navigation pattern (auth flow)
**Source:** `ustal/App.js` (строки 419–428)
**Apply to:** deep link handler в `EmailConfirmScreen.js`

После успешной установки сессии через deep link — navigate в `'Test'` (тот же маршрут, что и при ручном подтверждении). `OnboardingMoment` показывается только первый раз — логика в `TestScreen`/`RecommendationsScreen`, не в `EmailConfirmScreen`.

### Edge Function вызов через Supabase client
**Source:** `ustal/screens/SupportScreen.js` (строки 32–39)
**Apply to:** `report-alert` Edge Function (вызывается через Database Webhook, не из клиента)

Паттерн вызова из клиента (для справки, в 07-06 не нужен — там Webhook):
```js
const { error } = await supabase.functions.invoke('send-support-email', {
  body: { category, subject, message, username },
});
```

### Edge Function паттерн (Deno.serve)
**Source:** `supabase/functions/compute-weekly-profile/index.ts` (строки 1–36)
**Apply to:** `supabase/functions/report-alert/index.ts`

Структура Edge Function в проекте:
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Env через Deno.env.get('SECRET_NAME')
Deno.serve(async (req) => {
  // ... обработка
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `ustal/google-services.json` | config | — | Файл генерируется Firebase Console, не создаётся вручную; в репо нет аналогичных Firebase-конфигов |
| `ustal/eas.json` | config | build-time | EAS Build не использовался ранее; файл новый для проекта |

---

## Key Risks (для planner)

1. **`route.params` может быть null при cold start через deep link** — `EmailConfirmScreen` должен обработать `route.params || {}` (деструктуризация с дефолтами).

2. **`expo-auth-session` не установлен** — нужно `npx expo install expo-auth-session --npm` перед изменением `EmailConfirmScreen.js`.

3. **`Linking.useLinkingURL()`** (не `useURL()`) — в SDK 53+ именно эта версия возвращает URL для magic links на iOS (см. State of the Art в RESEARCH.md).

4. **`google-services.json` package name должен совпадать с `app.json` android.package** — создавать Firebase App только после финального решения по названию (Pitfall 4 в RESEARCH.md).

5. **FCM Service Account Key** — отдельный файл от `google-services.json`. Не коммитить. Загружать через `eas credentials`, не хранить в репо.

---

## Metadata

**Analog search scope:** `/Users/user/Zface/ustal/`, `/Users/user/Zface/supabase/`, `/Users/user/Zface/docs/`
**Files scanned:** 9 (App.js, app.json, config.js, EmailConfirmScreen.js, supabase.js, SupportScreen.js, package.json, docs/index.html, supabase/functions/compute-weekly-profile/index.ts)
**Pattern extraction date:** 2026-05-15
