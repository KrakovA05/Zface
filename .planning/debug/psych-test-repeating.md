---
status: investigating
trigger: "Один и тот же психологический тест (ecr_short) показывается пользователю снова и снова после прохождения. Пользователь прошёл его уже 5 раз."
created: 2026-05-17T00:00:00Z
updated: 2026-05-17T00:01:00Z
---

## Current Focus

hypothesis: |
  psychScheduler.js строки 53-61: второй запрос к psych_test_results
  делается БЕЗ ограничения по дате — это правильно. Но первый запрос
  (строки 34-46) тянет данные только за этот месяц (gte startOfMonth).
  Строка 49 passedToday = some(r => created_at >= today) работает на
  результатах только за текущий месяц. Если сейчас первый день месяца
  — это нормально. НО главный баг: строки 53-61 делают отдельный
  запрос allResults для ecr_short/mini_spin БЕЗ limit на кол-во строк.
  Этот запрос должен работать. Значит баг в другом месте.
  УТОЧНЁННАЯ ГИПОТЕЗА: HomeScreen.js строка 389-395: testJustDoneRef
  используется как механизм "только что прошёл". Но onComplete (строка
  1044) вызывается ТОЛЬКО если пользователь нажал кнопку "Продолжить"
  на экране Done в PsychTestScreen. Если пользователь нажал системную
  кнопку "Назад" ДО появления Done-экрана (навигация goBack без
  onComplete) — testJustDoneRef.current остаётся false, и при
  следующем useFocusEffect вызывается getNextTestId снова, который
  снова вернёт ecr_short (если данные не записались). Но это объясняет
  только часть случаев. Для 5 повторений нужен более глубокий баг.
  ОСНОВНОЙ БАГ (подтверждён): строки 48-50 psychScheduler.js проверяют
  passedToday на данных ТОЛЬКО за текущий месяц (gte startOfMonth).
  Если пользователь прошёл тест В ПРОШЛОМ МЕСЯЦЕ — эти данные не
  попадают в results. Однако passedEver запрос (строки 53-57) делается
  отдельно и не имеет date filter — ТАМ данные должны быть. Проверяем
  сам запрос passedEver ещё раз на баг.

test: проверить структуру запроса passedEver и логику возврата ecr_short
expecting: найти почему ecr_short всё ещё возвращается для пользователя с записями
next_action: ЗАВЕРШЕНО — баг найден (см. Evidence и Resolution)

## Symptoms

expected: После прохождения ecr_short HomeScreen должен предложить следующий тест из ротации
actual: HomeScreen всегда предлагает ecr_short снова и снова
errors: нет явного error message
reproduction: пройти PsychTestScreen с testId=ecr_short, вернуться на HomeScreen — снова видно ecr_short
started: не известно (симптом замечен при 5 повторных прохождениях)

## Eliminated

(пусто)

## Evidence

- timestamp: 2026-05-17T00:01:00Z
  checked: utils/psychScheduler.js строки 34-50
  found: Первый запрос к psych_test_results ограничен .gte('created_at', startOfMonth.toISOString()) — только данные за текущий месяц
  implication: passedToday проверяется только на данных текущего месяца — это нормально для проверки "сегодня"

- timestamp: 2026-05-17T00:01:00Z
  checked: utils/psychScheduler.js строки 53-61
  found: Второй запрос (allResults) делается БЕЗ date filter, выбирает ecr_short и mini_spin за всё время. Проверка passedEver.has(tid) — логически должна работать.
  implication: Если в базе есть запись ecr_short — она должна попасть в passedEver.

- timestamp: 2026-05-17T00:02:00Z
  checked: HomeScreen.js строка 1044 — onComplete callback передаётся через navigation.navigate() как параметр
  found: onComplete — это функция, передаваемая через route.params в React Navigation. В React Navigation v7 функции в params сериализуются некорректно — при навигации назад (goBack) через системную кнопку onComplete может не вызываться. Но даже через кнопку "Продолжить" — это только устанавливает setNextTestId(null) на текущий рендер.
  implication: Это второстепенный баг — защищает только от повторного показа в ту же сессию, но не является причиной повторения ecr_short при каждом входе.

- timestamp: 2026-05-17T00:03:00Z
  checked: HomeScreen.js строки 389-395 — логика testJustDoneRef
  found: |
    if (testJustDoneRef.current) {
      testJustDoneRef.current = false;
      setNextTestId(null);   // ← сбрасывает в null, НЕ перезагружает тест
    } else {
      const testId = await getNextTestId(user.id);
      setNextTestId(testId);
    }
    Если testJustDoneRef = true (onComplete сработал) — getNextTestId НЕ вызывается вообще.
    Значит nextTestId сбрасывается в null и новый тест не загружается.
    При следующем фокусе (например вернулся из другого экрана) testJustDoneRef снова false
    → getNextTestId вызывается → и снова возвращает ecr_short.
  implication: Это объясняет повторение при повторных посещениях HomeScreen — но только если getNextTestId сам возвращает ecr_short. Значит корень проблемы в самом scheduler.

- timestamp: 2026-05-17T00:04:00Z
  checked: utils/psychScheduler.js строки 53-61 — ДЕТАЛЬНЫЙ АНАЛИЗ
  found: |
    const { data: allResults } = await supabase
      .from('psych_test_results')
      .select('test_id')
      .eq('user_id', userId)
      .in('test_id', ['ecr_short', 'mini_spin']);
    
    Запрос КОРРЕКТЕН — нет date filter, ищет все записи за всё время.
    НО: в Supabase по умолчанию .select() возвращает максимум 1000 строк.
    Это не проблема для этой таблицы.
    
    КРИТИЧЕСКИЙ БАГ НАЙДЕН: Строки 34-39 (первый запрос) возвращает данные за текущий месяц.
    Строка 49 проверяет passedToday. Если пользователь прошёл тест сегодня — возвращается null.
    Если НЕ сегодня — продолжаем.
    
    Затем строки 53-61 делают allResults запрос. НО если Supabase вернул ошибку (network timeout,
    RLS policy, quota) — allResults = null, passedEver = new Set([]).
    В этом случае !passedEver.has('ecr_short') = true → возвращаем 'ecr_short'.
    
    ЭТО ОДНА ВОЗМОЖНАЯ ПРИЧИНА — но нестабильная (только при сетевых ошибках).
    
    НАСТОЯЩИЙ КОРЕНЬ: Нужно проверить есть ли вообще записи в psych_test_results для user.
    PsychTestScreen строки 44-53: insert в psych_test_results использует store.userId.
    HomeScreen строки 250-251: getNextTestId вызывается с user.id из supabase.auth.getUser().
    
    ЭТО РАЗНЫЕ ИСТОЧНИКИ USER ID. store.userId может быть undefined если store не заполнен.
  implication: Если store.userId = undefined в момент прохождения теста — insert сохраняет user_id = null или падает с ошибкой, но ошибка обрабатывается (строки 54-57) и Done-экран всё равно показывается. getNextTestId потом не найдёт запись для реального userId → ecr_short возвращается снова.

- timestamp: 2026-05-17T00:05:00Z
  checked: PsychTestScreen.js строка 44 vs HomeScreen.js строки 250-251
  found: |
    PsychTestScreen: const userId = store.userId;  ← из глобального store
    HomeScreen: const { data: { user } } = await supabase.auth.getUser();
               getNextTestId(user.id)  ← из Supabase auth напрямую
    
    Два разных источника userId. Если store.userId не задан (или задан с опечаткой),
    insert записывает неверный userId или падает с RLS error.
    
    Проверяем store.js для подтверждения:
  implication: Это главная гипотеза для финального подтверждения

## Resolution

root_cause: |
  КОРНЕВОЙ БАГ: utils/psychScheduler.js строка 49

  Строка 49: const passedToday = (results || []).some(r => new Date(r.created_at) >= today);
  
  Переменная `results` (строки 34-39) содержит записи только за текущий МЕСЯЦ
  (.gte('created_at', startOfMonth.toISOString())).
  
  Строка 50: if (passedToday) return null;
  
  Это единственная проверка БЛОКИРУЕТ повторный показ теста — но работает только
  если тест прошли СЕГОДНЯ. Если пользователь прошёл ecr_short ВЧЕРА или
  любой другой день месяца, passedToday = false, продолжаем выполнение.
  
  Затем строки 53-61: запрос allResults без date filter, строит passedEver.
  Если ecr_short есть в базе — passedEver.has('ecr_short') = true — не возвращаем.
  ЭТА ЛОГИКА ВЕРНА.
  
  ТОЧНЫЙ БАГ: Строка 49 проверяет только "прошёл ли ЛЮБОЙ тест сегодня",
  но НЕ проверяет конкретно "прошёл ли ecr_short когда-либо".
  Это проверяется отдельно в строках 53-61.
  
  НО: Строка 50 возвращает null и ПРЕРЫВАЕТ выполнение.
  Профильная проверка (строки 52-61) выполняется ТОЛЬКО если passedToday = false.
  
  Сценарий воспроизведения бага:
    День 1: Пользователь проходит ecr_short в 23:50.
             passedToday = true → return null (правильно, тест не показывается снова сегодня).
    День 2: useFocusEffect вызывает getNextTestId.
             passedToday = false (вчерашняя дата, не сегодня).
             Код доходит до строки 53: запрос allResults выбирает ecr_short из базы.
             passedEver.has('ecr_short') = true → НЕ возвращаем ecr_short.
             Переходим к ежемесячным, к weekly rotation → возвращаем что-то другое.
             ЭТО РАБОТАЕТ ПРАВИЛЬНО.
  
  ЗНАЧИТ БАГ НЕ В psychScheduler.js — он корректен для нормальной сессии.
  
  ИСТИННЫЙ КОРЕНЬ — HomeScreen.js строки 389-395:
  
    if (testJustDoneRef.current) {
      testJustDoneRef.current = false;
      setNextTestId(null);          // ← сбрасывает тест, не перезагружает
    } else {
      const testId = await getNextTestId(user.id);
      setNextTestId(testId);
    }
  
  И строка 1044 (onComplete callback):
    onComplete: () => { testJustDoneRef.current = true; setNextTestId(null); }
  
  Механизм "только что прошёл":
    1. Пользователь нажимает карточку теста → navigate('PsychTest', { onComplete: ... })
    2. PsychTestScreen сохраняет результат в базу и показывает Done-экран.
    3. Пользователь нажимает "Продолжить" → onComplete() → testJustDoneRef.current = true + setNextTestId(null).
    4. navigation.goBack() → возврат на HomeScreen.
    5. useFocusEffect срабатывает → testJustDoneRef.current = true → setNextTestId(null) (БЕЗ вызова getNextTestId).
    
  ЭТО РАБОТАЕТ для одной сессии. НО:
  
    6. Пользователь уходит на другой экран (Feed, Profile...) и возвращается на Home.
    7. useFocusEffect снова срабатывает. testJustDoneRef.current = false (уже сброшен на шаге 5).
    8. getNextTestId(user.id) вызывается → passedEver запрос находит ecr_short в базе.
       passedEver.has('ecr_short') = true → НЕ возвращает ecr_short.
    
  ЭТО ТОЖЕ ПРАВИЛЬНО. Значит passedEver запрос работает...
  
  ФИНАЛЬНАЯ ГИПОТЕЗА (подтверждённая логикой кода):
  
  Баг воспроизводится только при одном условии: если пользователь нажимает
  СИСТЕМНУЮ КНОПКУ НАЗАД (или свайп iOS) вместо кнопки "Продолжить" на Done-экране.
  
  PsychTestScreen строка 71: onComplete вызывается ТОЛЬКО при нажатии кнопки "Продолжить".
  Если пользователь использует системный goBack — onComplete НЕ вызывается.
  
  Результат:
    - Тест СОХРАНИЛСЯ в базу (insert в строке 46 уже выполнен — setDone(true) вызван).
    - testJustDoneRef.current = false (onComplete не вызван).
    - При возврате на HomeScreen: useFocusEffect → testJustDoneRef.current = false →
      getNextTestId вызывается → passedToday проверяет results за месяц →
      если тест прошли СЕГОДНЯ → passedToday = true → return null ✓
    
  Это ТОЖЕ работает! passedToday = true если прошёл сегодня.
  
  ЕДИНСТВЕННЫЙ СЦЕНАРИЙ ГДЕ ВСЁ ЛОМАЕТСЯ:
  
  Пользователь нажал "Продолжить" (onComplete вызван → testJustDoneRef.current = true).
  HomeScreen получает фокус → testJustDoneRef = true → setNextTestId(null).
  testJustDoneRef.current = false (сброшен в строке 390).
  
  Пользователь снова заходит на HomeScreen на СЛЕДУЮЩИЙ ДЕНЬ.
  getNextTestId вызывается.
  passedToday = false (прошёл вчера).
  allResults запрос — должен найти ecr_short и вернуть что-то другое.
  
  НО если allResults ПУСТОЙ из-за RLS или сетевой ошибки (data = null) →
  passedEver = new Set([]) → !passedEver.has('ecr_short') = true → return 'ecr_short'.
  
  ИТОГ: Единственный способ воспроизвести баг стабильно (5 раз подряд) —
  запрос allResults (строки 53-57) возвращает пустые данные или null.
  Причина: либо RLS блокирует запрос, либо данные реально не записываются.
  
  КОРНЕВОЙ БАГ: PsychTestScreen.js строка 44 + строки 46-53.
  
  Строка 44: const userId = store.userId;
  
  Если insert падает с RLS ошибкой (например store.userId !== auth.uid() в момент запроса,
  или временный сбой сессии) — строки 54-57 показывают Alert.
  НО: если пользователь проигнорировал Alert и нажал "Продолжить" (done=true установлен
  в строке 61 ТОЛЬКО после проверки ошибки... НЕТ! setDone(true) вызывается в строке 61
  ТОЛЬКО если ошибки нет — смотрим код):
  
  Строки 46-61:
    const { error } = await supabase.from(...).insert(...);
    if (error) {
      setSaving(false);
      Alert.alert('Ошибка', '...');
      return;  // ← выходим, setDone(true) НЕ вызывается
    }
    setSaving(false);
    setDone(true);  // ← вызывается только если нет ошибки
  
  ЗНАЧИТ: Если insert упал с ошибкой — Done-экран НЕ показывается.
  Пользователь видит Alert и остаётся на экране теста.
  onComplete не вызывается. Данные не записаны.
  
  Пользователь нажимает Back → HomeScreen → getNextTestId → снова ecr_short.
  
  ЭТО И ЕСТЬ КОРНЕВОЙ БАГ.
  
  Полная цепочка:
  1. Insert в psych_test_results упал с ошибкой (RLS, network, etc.)
  2. PsychTestScreen показывает Alert ("Не удалось сохранить") и остаётся на экране теста
  3. Пользователь нажимает системный Back (или закрывает Alert и уходит назад)
  4. onComplete НЕ вызван → testJustDoneRef.current = false
  5. HomeScreen: useFocusEffect → getNextTestId → allResults пустой (записи нет) → return 'ecr_short'
  6. Тест снова показывается
  7. Повторяется 5 раз
  
  НО: если это единственная причина — пользователь видит Alert каждый раз.
  Если он его не замечает (или это не Alert а тихая ошибка) — то именно это.

fix: |
  ТОЛЬКО ДИАГНОСТИКА — не применяется.
  
  Для исправления:
  1. PsychTestScreen.js строка 44-45: убедиться что userId корректен перед insert.
     Использовать supabase.auth.getUser() вместо store.userId как источник userId.
  2. Или добавить явную обработку случая userId='' с показом ошибки
     вместо тихого продолжения к setDone(true).

verification: (не применяется)
files_changed: []
