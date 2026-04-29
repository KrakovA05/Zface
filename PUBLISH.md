# Публикация — чеклист и ссылки

Всё необходимое для выхода в App Store и Google Play.

---

## Ссылки

| Что | Ссылка |
|-----|--------|
| Политика конфиденциальности | https://krakova05.github.io/Zface/ (временная, заменить после п.1 ниже) |
| Репозиторий | https://github.com/KrakovA05/Zface |

---

## ⚠️ Обязательно перед релизом

- [ ] **Выбрать название приложения** — от него зависит всё остальное ниже
- [ ] **Скрыть личные данные в политике конфиденциальности** — создать GitHub Organization с именем приложения, перенести репо, обновить URL политики. Заменить личный email в `docs/index.html` на отдельный ящик для приложения.
- [ ] **Firebase FCM для Android** — обязательно перед сборкой production-билда (без этого push-уведомления на Android не работают)
- [ ] **Иконка и сплэш** — заменить дефолтные Expo-заглушки
- [ ] **Email подтверждения** — включить `EMAIL_CONFIRM_ENABLED = true` в `config.js` + включить в Supabase + настроить deep link

---

## App Store (iOS)

### Статус
- [ ] Создан аккаунт Apple Developer ($99/год)
- [ ] Создано приложение в App Store Connect
- [ ] Вставлена ссылка на политику конфиденциальности
- [ ] Загружены скриншоты (iPhone 6.9", 6.5", iPad если нужен)
- [ ] Заполнено описание приложения
- [ ] Указана возрастная категория (16+, mental health)
- [ ] Добавлена кнопка кризисной поддержки (уже реализована в приложении)
- [ ] Собран и загружен билд через EAS (`eas build --platform ios`)
- [ ] Пройдена ревью

### Обязательные поля
- **Название:** TBD (финальное название ещё не выбрано)
- **Подзаголовок:** до 30 символов
- **Описание:** до 4000 символов
- **Ключевые слова:** до 100 символов
- **Категория:** Health & Fitness или Social Networking
- **Политика конфиденциальности:** https://krakova05.github.io/Zface/
- **Поддержка:** krakov.arseniy@icloud.com

---

## Google Play (Android)

### Статус
- [ ] Создан аккаунт Google Play Console ($25 единоразово)
- [ ] Создано приложение в Console
- [ ] Вставлена ссылка на политику конфиденциальности
- [ ] Настроен Firebase FCM (нужен перед сборкой — см. ниже)
- [ ] Загружены скриншоты
- [ ] Заполнен листинг
- [ ] Собран и загружен AAB через EAS (`eas build --platform android`)
- [ ] Пройдена ревью

---

## Firebase FCM (Android push-уведомления)

Без этого push-уведомления на Android не будут работать в production.

### Шаги
1. Создать проект на https://console.firebase.google.com
2. Добавить Android-приложение (package name из `app.json`)
3. Скачать `google-services.json`
4. В EAS: `eas credentials` → загрузить FCM credentials
5. Или добавить в `app.json`:
   ```json
   "android": {
     "googleServicesFile": "./google-services.json"
   }
   ```

### Статус
- [ ] Firebase проект создан
- [ ] `google-services.json` добавлен в проект
- [ ] FCM настроен в EAS

---

## Иконка и сплэш

| Файл | Размер | Примечания |
|------|--------|-----------|
| `assets/icon.png` | 1024×1024 | PNG, без прозрачности (iOS App Store) |
| `assets/adaptive-icon.png` | 1024×1024 | Android, иконка в центральных 66% |
| `assets/splash-icon.png` | ~512×512 | С прозрачностью, contain |

### Статус
- [ ] Финальное название выбрано
- [ ] Иконка нарисована и загружена
- [ ] Сплэш обновлён

---

## EAS Build — команды

```bash
# Установить EAS CLI (если не установлен)
npm install -g eas-cli

# Логин
eas login

# Сборка для iOS
eas build --platform ios

# Сборка для Android
eas build --platform android

# Обе платформы сразу
eas build --platform all

# Отправка в App Store
eas submit --platform ios

# Отправка в Google Play
eas submit --platform android
```

---

## Email подтверждения (перед релизом)

Флаг `EMAIL_CONFIRM_ENABLED` в `ustal/config.js` сейчас = `false`.

Перед релизом:
1. Включить в Supabase Dashboard → Authentication → Settings
2. Поменять флаг на `true`
3. Настроить deep link чтобы письмо открывало приложение, а не браузер

---

## Контакт для сторов

**Email поддержки:** krakov.arseniy@icloud.com
