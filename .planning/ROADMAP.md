# Roadmap: Zface

## Overview

Zface — мобильное приложение для людей, которым сейчас плохо. «Найди своих» — без терапии и фальши. Проект прошёл путь от чистого листа до полноценного MVP+ с психометрическим движком, системой удержания и кризисной безопасностью. Фазы 1–6 завершены. Активная задача — подготовка к релизу в App Store и Google Play (Фаза 7).

## Milestones

- ✅ **MVP+** - Фазы 1–6 (завершено 14.05.26)
- 🚧 **v1.0 Release** - Фаза 7 (в работе)
- 📋 **v1.1 Post-release** - Фазы 8–9 (запланировано)

## Phases

<details>
<summary>✅ MVP+ (Фазы 1–6) — ЗАВЕРШЕНО 14.05.26</summary>

### Phase 1: Foundation
**Goal**: Пользователь может зарегистрироваться, войти и пройти тест, который определяет его уровень.
**Depends on**: Nothing (first phase)
**Success Criteria** (what must be TRUE):
  1. Пользователь может зарегистрироваться с email и паролем
  2. Пользователь может войти и остаться в системе между сессиями
  3. Пользователь проходит тест из 10 вопросов и получает один из трёх уровней (green/yellow/red)
  4. Уровень отображается цветом аватара и ника везде в приложении
  5. RLS включён на всех таблицах Supabase
**Plans**: Complete

Plans:
- [x] Регистрация и логин (Supabase Auth)
- [x] TestScreen — 10 вопросов, уровни green/yellow/red
- [x] Статус-карточка уровня на HomeScreen
- [x] Политика конфиденциальности (GitHub Pages)
- [x] Удаление аккаунта через SECURITY DEFINER delete_user()

**Completed**: 15–17.04.26

---

### Phase 2: Social Core
**Goal**: Пользователи могут общаться в чатах, обмениваться личными сообщениями и добавлять друг друга в друзья.
**Depends on**: Phase 1
**Success Criteria** (what must be TRUE):
  1. Пользователь может писать в глобальный чат в реальном времени
  2. Пользователь может зайти в комнату своего уровня и общаться там
  3. Пользователь может отправить личное сообщение другому пользователю
  4. Пользователь может найти другого по нику или ярлыкам, отправить заявку, стать друзьями
  5. Пользователь может заблокировать другого и пожаловаться на него
**Plans**: Complete

Plans:
- [x] ChatScreen — глобальный чат, realtime, edit/delete, timestamps
- [x] RoomsScreen — комнаты по уровню, realtime, Presence
- [x] DirectMessageScreen — личные сообщения, realtime
- [x] FriendsScreen — поиск, заявки, список друзей
- [x] UserProfileScreen — добавить/принять/удалить друга, DM, блокировка, жалоба
- [x] CustomTabBar — floating pill с бейджами непрочитанных

**Completed**: 15–23.04.26

---

### Phase 3: Feed & Activities
**Goal**: Пользователь может публиковать посты в ленте и использовать медитативные активности (дыхание, рыбалка, мысли).
**Depends on**: Phase 2
**Success Criteria** (what must be TRUE):
  1. Пользователь может создать пост с текстом или фото/видео, поставить лайк и прокомментировать
  2. Лента фильтруется по уровню пользователя
  3. Пользователь может запустить коробочное дыхание 4-4-4-4
  4. Пользователь может «порыбачить» и пополнить коллекцию рыб
  5. Пользователь может оставить анонимную мысль дня и отреагировать на чужую
**Plans**: Complete

Plans:
- [x] FeedScreen — посты, лайки, фильтр по уровню, Supabase Storage
- [x] PostScreen — комментарии, realtime
- [x] BreathingScreen — коробочное дыхание, Animated-анимация
- [x] FishingScreen — удочка, 14 рыб, Записка в бутылке
- [x] ThoughtsScreen — анонимная мысль + реакции
- [x] Реакции на сообщения (message_reactions)

**Completed**: 23.04.26–17.05.26

---

### Phase 4: Profiles & Push
**Goal**: Пользователь видит осмысленный профиль с достижениями, получает push-уведомления о важных событиях и может приглашать друзей.
**Depends on**: Phase 3
**Success Criteria** (what must be TRUE):
  1. Пользователь видит свои 8 ачивок, коллекцию рыб и счётчик «помог N людям»
  2. Пользователь получает push при новом DM, заявке, комментарии и реакции «он мне помог»
  3. Пользователь видит динамику уровня другого пользователя (если тот разрешил)
  4. Push-уведомления работают через Expo Notifications + проактивные мини-квесты 3 раза в день
**Plans**: Complete

Plans:
- [x] ProfileScreen — аватар, статус, ачивки, коллекция рыб, шер
- [x] Push по DM и заявкам (Expo Notifications)
- [x] Проактивные мини-квесты (3 в день, тон по уровню)
- [x] Пуши: письмо дошло, помог, новый комментарий, недельный отчёт, дайджест комнаты
- [x] Стрик входа + анимированный StreakModal
- [x] Хаптика (expo-haptics), In-App Review (expo-store-review)

**Completed**: 23.04.26–06.05.26

---

### Phase 5: Engagement & Safety
**Goal**: Главный экран становится персональным дашбордом с ежедневными активностями; кризисная безопасность закрывает все точки риска.
**Depends on**: Phase 4
**Success Criteria** (what must be TRUE):
  1. Пользователь видит «Фокус дня» — приоритетную задачу (письмо / вопрос / чекин)
  2. После чекина ≤3 три дня подряд приходит пуш поддержки
  3. Кризис-баннер тихо появляется в чатах и письмах при вводе триггерных фраз
  4. Пользователь может написать анонимное письмо в никуда — случайный получатель завтра
  5. Ночная комната доступна с 23:00 до 06:00 только анонимно
  6. Приложение показывает «На сегодня всё» когда все дневные действия выполнены
**Plans**: Complete

Plans:
- [x] Чекин настроения (1–10) + follow-up чипы + тренд 7 дней
- [x] LetterScreen — анонимные письма, кризис-детект входящих
- [x] Кризис-баннеры в ChatScreen, DirectMessageScreen, LetterScreen
- [x] «Фокус дня», «На сегодня всё», персонализация модулей по goal
- [x] Ночная комната (level='night', только анонимно)
- [x] NotificationsScreen — центр уведомлений с бейджем
- [x] SupportScreen — форма поддержки → Resend → корпоративная почта
- [x] OnboardingMomentScreen шаг 2 — выбор цели, сохраняется в users.goal
- [x] Crash reporting + аналитика событий
- [x] Аватары → Supabase Storage (обратная совместимость с base64)

**Completed**: 04–07.05.26

---

### Phase 6: Psychometric Engine
**Goal**: Приложение регулярно измеряет психологическое состояние по 8 валидированным тестам и даёт персональные материалы на основе реальных метрик.
**Depends on**: Phase 5
**Success Criteria** (what must be TRUE):
  1. Пользователь проходит валидированные тесты (ECR-Short, GAD-7, PSS-4 и др.) через PsychTestScreen
  2. HomeScreen предлагает следующий актуальный тест по расписанию (профиль → ежемесячные → еженедельные)
  3. Еженедельная карточка состояния на HomeScreen отображает доминирующее измерение и фразу
  4. ResourcesScreen показывает «Для тебя сейчас» — топ-5 материалов по dimension_weights × баллы
  5. Edge Function compute-weekly-profile пересчитывает метрики каждое воскресенье и обновляет уровень
**Plans**: Complete

Plans:
- [x] psychTests.js — 8 тестов с scoring (sum/mean/sum_with_reverse)
- [x] PsychTestScreen — прогресс-бар, шкала ответов, сохранение в psych_test_results
- [x] psychScheduler.js — выбор следующего теста
- [x] Карточки на HomeScreen (следующий тест + еженедельное состояние)
- [x] Edge Function compute-weekly-profile (pg_cron, воскресенье 03:00)
- [x] 24 материала в Supabase resources по 8 темам
- [x] ResourcesScreen персональные рекомендации по dimension_weights

**Completed**: 14.05.26

</details>

---

### 🚧 v1.0 Release

**Milestone Goal:** Приложение проходит модерацию App Store и Google Play и становится доступно пользователям.

#### Phase 7: Release Prep
**Goal**: Все блокеры релиза устранены — приложение готово к сборке, публикации и работает корректно для конечных пользователей.
**Depends on**: Phase 6
**Success Criteria** (what must be TRUE):
  1. Приложение имеет финальное название, иконку и сплэш — никаких Expo-заглушек
  2. Push-уведомления работают на Android через Firebase FCM
  3. Подтверждение email открывает приложение через deep link, а не браузер
  4. Политика конфиденциальности не содержит личных данных разработчика
  5. ASO-метадата заполнена: название, подзаголовок, ключевые слова, 5 скриншотов
  6. Новая жалоба в таблице reports → email-алерт разработчику в течение минуты
  7. Критические баги (CR-01..CR-05) исправлены — реакции в DM/мыслях работают
  8. Дизайн-система исправлена — accent=#8B7355, нет emoji в UI
**Plans**: 9 планов

Plans:
- [ ] 07-01-PLAN.md — Финальное название + app.json (scheme, bundleIdentifier, package)
- [ ] 07-02-PLAN.md — Firebase FCM: eas.json + .gitignore + google-services.json
- [ ] 07-03-PLAN.md — Deep link: expo-auth-session + EmailConfirmScreen + config.js
- [ ] 07-04-PLAN.md — Скрыть личные данные: docs/index.html → support@noy.app
- [ ] 07-05-PLAN.md — ASO-метадата + 5 скриншотов (зависит от 07-01)
- [ ] 07-06-PLAN.md — Email-алерт при жалобе (Edge Function + RESEND_API_KEY + webhook)
- [ ] 07-07-PLAN.md — Возрастная категория 16+ в App Store и Google Play (зависит от 07-01)
- [ ] 07-08-PLAN.md — Критические баги: CR-01 DM реакции, CR-03 like null guard, CR-04 nav params, CR-05 мысли реакции
- [ ] 07-09-PLAN.md — UI-фиксы: theme.js accent #8B7355, FishingScreen без emoji, safe-area insets

---

### 📋 v1.1 Post-release

**Milestone Goal:** Улучшение удержания и расширение аудитории после первых реальных пользователей.

#### Phase 8: Growth & Analytics
**Goal**: Собрана первая обратная связь от реальных пользователей, настроены конверсионные метрики, исправлены критические баги первых недель.
**Depends on**: Phase 7
**Success Criteria** (what must be TRUE):
  1. Разработчик видит воронку активации: регистрация → тест → первый чат
  2. Критические баги первой недели исправлены и задеплоены в течение 48 часов
  3. Метрики удержания D1/D7/D30 отслеживаются через таблицу events
**Plans**: TBD

Plans:
- [ ] 08-01: Дашборд аналитики (воронка активации из таблицы events)
- [ ] 08-02: Hotfix-процесс: мониторинг crash_logs + быстрый релиз
- [ ] 08-03: Итерация по онбордингу на основе drop-off данных

---

#### Phase 9: Community Features
**Goal**: Пользователи могут глубже взаимодействовать друг с другом — через группы по интересам, совместные активности или расширенные профили.
**Depends on**: Phase 8
**Success Criteria** (what must be TRUE):
  1. [Определяется после анализа поведения первых пользователей]
**Plans**: TBD

Plans:
- [ ] 09-01: TBD — зависит от данных retention первого месяца

---

#### Phase 10: AI Feed Content
**Goal**: Лента всегда наполнена живым контентом — Edge Function генерирует 2-3 поста в день через Gemini API от системного пользователя @один для каждого уровня (green/yellow/red).
**Depends on**: Phase 7
**Success Criteria** (what must be TRUE):
  1. Системный пользователь @один существует в таблице users
  2. Edge Function ai-feed-generator запускается по расписанию (pg_cron, раз в день)
  3. Функция генерирует 2-3 поста на каждый уровень (green/yellow/red) + 1-2 для всех
  4. Контент адаптирован под уровень: red — валидация, yellow — 50/50, green — вопросы
  5. Gemini API ключ хранится в Supabase Secrets, не в коде
  6. При отсутствии ключа функция gracefully падает с логом (не ломает приложение)
**Plans**: 1 план

Plans:
- [ ] 10-01-PLAN.md — Системный пользователь @один + Edge Function ai-feed-generator + pg_cron расписание

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | MVP+ | Complete | Complete | 17.04.26 |
| 2. Social Core | MVP+ | Complete | Complete | 23.04.26 |
| 3. Feed & Activities | MVP+ | Complete | Complete | 17.05.26 |
| 4. Profiles & Push | MVP+ | Complete | Complete | 06.05.26 |
| 5. Engagement & Safety | MVP+ | Complete | Complete | 07.05.26 |
| 6. Psychometric Engine | MVP+ | Complete | Complete | 14.05.26 |
| 7. Release Prep | v1.0 | 0/9 | In progress | - |
| 8. Growth & Analytics | v1.1 | 0/3 | Not started | - |
| 9. Community Features | v1.1 | 0/1 | Not started | - |
| 10. AI Feed Content | v1.1 | 0/1 | Not started | - |
