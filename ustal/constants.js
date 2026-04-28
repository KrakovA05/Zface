export const DAILY_WORDS = [
  'пустота', 'тревога', 'злость', 'усталость', 'одиночество',
  'апатия', 'тоска', 'раздражение', 'растерянность', 'грусть',
  'страх', 'бессилие', 'напряжение', 'отчаяние', 'скука',
  'вина', 'стыд', 'обида', 'нежность', 'зависть',
  'беспокойство', 'опустошённость', 'отчуждение', 'сомнение', 'боль',
];

export const LABELS = [
  '😮‍💨 Устал очень',
  '🧠 Психолог',
  '🌪 Жертва обстоятельств',
  '😶 Просто наблюдаю',
  '🤝 Хочу помочь',
  '🔥 Выгорел',
  '😴 Сплю на ходу',
  '🫠 Таю от стресса',
];

export const LEVEL_COLORS = {
  green: '#4CAF50',
  yellow: '#FFC107',
  red: '#F44336',
};

export const LEVEL_DATA = {
  green: {
    label: '🟢 Зелёный',
    color: '#4CAF50',
    text: 'Ты держишься! Жизненный хаос тебя пока не накрыл.',
    emoji: '🌿',
  },
  yellow: {
    label: '🟡 Жёлтый',
    color: '#FFC107',
    text: 'Ты на грани. Бывают хорошие дни, бывают плохие.',
    emoji: '🌤',
  },
  red: {
    label: '🔴 Красный',
    color: '#F44336',
    text: 'Похоже, тебе действительно плохо. Но ты не один.',
    emoji: '🌪',
  },
};

export const PHRASES = [
  'пить чай в пижаме',
  'не отвечать на письма',
  'смотреть в потолок',
  'ничего не делать',
  'быть как медуза',
];

export const MOTIVATORS = [
  'Медузы вообще не имеют мозга. Будь как медуза 🪼',
  'Ты уже 2 часа не ныл. Всё в порядке?',
  'Напоминаем: ты имеешь право лежать и смотреть в потолок',
  'Совет: подбрось монетку. Пока она в воздухе — поймёшь какой ответ хочешь',
  '47% людей сегодня тоже не хотят работать 🙃',
];

// 10 пакетов по 10 вопросов — каждый следующий тест использует следующий пакет
export const TEST_PACKS = [
  // Pack 0 — Общее настроение
  {
    title: 'Общее настроение',
    questions: [
      { question: 'Как ты обычно просыпаешься утром?', answers: [{ text: 'С трудом, не хочу вставать', pessimistic: true }, { text: 'Нормально, встаю когда надо', pessimistic: false }] },
      { question: 'Когда что-то идёт не по плану, ты думаешь...', answers: [{ text: 'Ну и ладно, бывает', pessimistic: false }, { text: 'Всё как всегда, ничего не работает', pessimistic: true }] },
      { question: 'Как ты относишься к своей работе или учёбе?', answers: [{ text: 'Терплю, но особого смысла не вижу', pessimistic: true }, { text: 'Есть моменты которые мне нравятся', pessimistic: false }] },
      { question: 'Когда тебе предлагают помощь, ты...', answers: [{ text: 'Принимаю, это приятно', pessimistic: false }, { text: 'Отказываюсь, всё равно не поможет', pessimistic: true }] },
      { question: 'Как часто ты чувствуешь усталость без причины?', answers: [{ text: 'Почти каждый день', pessimistic: true }, { text: 'Иногда, но это нормально', pessimistic: false }] },
      { question: 'Что ты думаешь о будущем?', answers: [{ text: 'Там будет лучше чем сейчас', pessimistic: false }, { text: 'Вряд ли что-то изменится', pessimistic: true }] },
      { question: 'Как ты проводишь свободное время?', answers: [{ text: 'Лежу и ничего не хочу делать', pessimistic: true }, { text: 'Нахожу что-то интересное', pessimistic: false }] },
      { question: 'Когда ты видишь счастливых людей, ты думаешь...', answers: [{ text: 'Рад за них', pessimistic: false }, { text: 'Интересно, долго ли это продлится', pessimistic: true }] },
      { question: 'Как ты относишься к общению с людьми?', answers: [{ text: 'Чаще хочется побыть одному', pessimistic: true }, { text: 'Люблю общаться когда есть настроение', pessimistic: false }] },
      { question: 'Как ты оцениваешь свою жизнь прямо сейчас?', answers: [{ text: 'Могло быть лучше, но жить можно', pessimistic: false }, { text: 'Честно — всё достало', pessimistic: true }] },
    ],
  },
  // Pack 1 — Энергия и сон
  {
    title: 'Энергия и сон',
    questions: [
      { question: 'Как ты засыпаешь?', answers: [{ text: 'Нормально, без особых проблем', pessimistic: false }, { text: 'Долго лежу, мысли не отпускают', pessimistic: true }] },
      { question: 'Сколько у тебя сил к середине дня?', answers: [{ text: 'Как будто батарейка почти пустая', pessimistic: true }, { text: 'В целом хватает на дела', pessimistic: false }] },
      { question: 'Как ты ощущаешь себя после сна?', answers: [{ text: 'Просыпаюсь отдохнувшим(ей)', pessimistic: false }, { text: 'Встаю ещё более уставшим(ей)', pessimistic: true }] },
      { question: 'Как давно ты делал(а) что-то физически активное?', answers: [{ text: 'Совсем недавно', pessimistic: false }, { text: 'Уже не помню когда', pessimistic: true }] },
      { question: 'Есть ли у тебя ощущение, что тело «тяжёлое»?', answers: [{ text: 'Да, постоянно хочется лечь', pessimistic: true }, { text: 'Нет, обычно чувствую себя нормально', pessimistic: false }] },
      { question: 'Ты замечаешь, что ешь меньше или больше обычного?', answers: [{ text: 'Да, аппетит явно изменился', pessimistic: true }, { text: 'Нет, всё примерно как обычно', pessimistic: false }] },
      { question: 'Когда ты последний раз провёл(а) день без ощущения разбитости?', answers: [{ text: 'Относительно недавно', pessimistic: false }, { text: 'Уже не помню такого дня', pessimistic: true }] },
      { question: 'Помогает ли тебе отдых восстановить силы?', answers: [{ text: 'Да, после отдыха становится лучше', pessimistic: false }, { text: 'Даже отдых не помогает', pessimistic: true }] },
      { question: 'Ты часто откладываешь дела из-за отсутствия сил?', answers: [{ text: 'Это случается почти каждый день', pessimistic: true }, { text: 'Иногда, но справляюсь', pessimistic: false }] },
      { question: 'Как ты оцениваешь своё физическое состояние сегодня?', answers: [{ text: 'Более-менее нормально', pessimistic: false }, { text: 'Ощущение как после марафона', pessimistic: true }] },
    ],
  },
  // Pack 2 — Отношения с людьми
  {
    title: 'Отношения с людьми',
    questions: [
      { question: 'Есть ли рядом человек, которому ты доверяешь?', answers: [{ text: 'Да, есть хотя бы один', pessimistic: false }, { text: 'Не особо, не с кем поговорить', pessimistic: true }] },
      { question: 'Как ты реагируешь на сообщения от других?', answers: [{ text: 'Часто не хочу отвечать и откладываю', pessimistic: true }, { text: 'Обычно отвечаю нормально', pessimistic: false }] },
      { question: 'Когда ты в компании, ты чувствуешь себя...', answers: [{ text: 'Нормально, могу расслабиться', pessimistic: false }, { text: 'Лишним(ей), хочется уйти', pessimistic: true }] },
      { question: 'Тебе часто кажется, что другие тебя не понимают?', answers: [{ text: 'Да, постоянное ощущение что один(одна)', pessimistic: true }, { text: 'Бывает, но не всё время', pessimistic: false }] },
      { question: 'Как ты относишься к новым знакомствам?', answers: [{ text: 'Зачем, они всё равно разочаруют', pessimistic: true }, { text: 'Нормально, иногда интересно', pessimistic: false }] },
      { question: 'Ты скучаешь по кому-нибудь прямо сейчас?', answers: [{ text: 'Да, и это тяжело', pessimistic: true }, { text: 'Скучаю, но это нормально', pessimistic: false }] },
      { question: 'Как часто ты чувствуешь себя одиноким(ой)?', answers: [{ text: 'Почти всегда, даже среди людей', pessimistic: true }, { text: 'Иногда, но ненадолго', pessimistic: false }] },
      { question: 'Ты замечаешь, что избегаешь людей?', answers: [{ text: 'Да, стараюсь поменьше контактировать', pessimistic: true }, { text: 'Нет, просто выбираю когда общаться', pessimistic: false }] },
      { question: 'Как ты чувствуешь себя после общения?', answers: [{ text: 'Обычно опустошённым(ой)', pessimistic: true }, { text: 'По-разному, иногда даже лучше', pessimistic: false }] },
      { question: 'Есть ли кто-то, кто рад тебя видеть?', answers: [{ text: 'Наверное, но я в этом не уверен(а)', pessimistic: true }, { text: 'Да, точно есть такие люди', pessimistic: false }] },
    ],
  },
  // Pack 3 — Самооценка
  {
    title: 'Самооценка',
    questions: [
      { question: 'Что ты думаешь о себе в целом?', answers: [{ text: 'Я нормальный человек, со своими плюсами', pessimistic: false }, { text: 'Часто кажется, что я хуже других', pessimistic: true }] },
      { question: 'Когда ты смотришь в зеркало, ты думаешь...', answers: [{ text: 'Всё окей, принимаю себя', pessimistic: false }, { text: 'Многое хотел(а) бы изменить', pessimistic: true }] },
      { question: 'Как ты воспринимаешь похвалу?', answers: [{ text: 'Принимаю, приятно', pessimistic: false }, { text: 'Не верю, думаю что просто говорят', pessimistic: true }] },
      { question: 'Как ты реагируешь на критику?', answers: [{ text: 'Долго переживаю, сложно отпустить', pessimistic: true }, { text: 'Принимаю если справедливо, иначе не трогает', pessimistic: false }] },
      { question: 'Ты часто сравниваешь себя с другими?', answers: [{ text: 'Да, и почти всегда не в свою пользу', pessimistic: true }, { text: 'Иногда, но не зацикливаюсь', pessimistic: false }] },
      { question: 'Когда ты делаешь что-то хорошо, ты...', answers: [{ text: 'Радуюсь и отмечаю это', pessimistic: false }, { text: 'Думаю — могло быть лучше', pessimistic: true }] },
      { question: 'Ты заслуживаешь хорошего?', answers: [{ text: 'Да, как и любой человек', pessimistic: false }, { text: 'Не знаю, не особо верю в это', pessimistic: true }] },
      { question: 'Как часто ты думаешь о своих ошибках?', answers: [{ text: 'Регулярно, не могу их отпустить', pessimistic: true }, { text: 'Помню, но не застреваю надолго', pessimistic: false }] },
      { question: 'Ты доволен(а) тем, кем являешься?', answers: [{ text: 'Нет, хотелось бы быть другим(ой)', pessimistic: true }, { text: 'В целом да, хотя есть что улучшить', pessimistic: false }] },
      { question: 'Ты часто извиняешься за то, что просто существуешь?', answers: [{ text: 'Да, постоянно чувствую что мешаю', pessimistic: true }, { text: 'Нет, у меня есть право быть', pessimistic: false }] },
    ],
  },
  // Pack 4 — Мотивация и цели
  {
    title: 'Мотивация и цели',
    questions: [
      { question: 'Есть ли у тебя что-то, чего ты хочешь достичь?', answers: [{ text: 'Да, есть хоть что-то', pessimistic: false }, { text: 'Не особо, всё кажется бессмысленным', pessimistic: true }] },
      { question: 'Как ты начинаешь новые дела?', answers: [{ text: 'Долго откладываю, не могу начать', pessimistic: true }, { text: 'Иногда трудно, но начинаю', pessimistic: false }] },
      { question: 'Что происходит когда ты не достигаешь цели?', answers: [{ text: 'Пробую иначе или принимаю это', pessimistic: false }, { text: 'Убеждаюсь что так и знал(а) — не выйдет', pessimistic: true }] },
      { question: 'Есть ли что-то, к чему ты с нетерпением ждёшь?', answers: [{ text: 'Ничего на горизонте не радует', pessimistic: true }, { text: 'Есть хоть что-то маленькое', pessimistic: false }] },
      { question: 'Когда ты думаешь о завтрашнем дне...', answers: [{ text: 'Жду чего-то хорошего или нейтрально', pessimistic: false }, { text: 'Очередной день без смысла', pessimistic: true }] },
      { question: 'Ты делаешь что-то для себя или только для других?', answers: [{ text: 'Есть хоть что-то только для меня', pessimistic: false }, { text: 'Не помню когда последний раз делал(а) для себя', pessimistic: true }] },
      { question: 'Как ты относишься к своим мечтам?', answers: [{ text: 'Верю что часть из них реальна', pessimistic: false }, { text: 'Это просто фантазии, ничего не выйдет', pessimistic: true }] },
      { question: 'Когда ты заканчиваешь дело, ты чувствуешь...', answers: [{ text: 'Хоть небольшое удовлетворение', pessimistic: false }, { text: 'Пустоту, зачем вообще делал(а)', pessimistic: true }] },
      { question: 'Ты способен(на) что-то изменить в своей жизни?', answers: [{ text: 'Да, хотя бы что-то маленькое', pessimistic: false }, { text: 'Нет, всё уже предрешено', pessimistic: true }] },
      { question: 'Ты доволен(а) тем, чем занимаешься?', answers: [{ text: 'Не всем, но есть смысл продолжать', pessimistic: false }, { text: 'Нет, это не то чего я хотел(а)', pessimistic: true }] },
    ],
  },
  // Pack 5 — Тревога и стресс
  {
    title: 'Тревога и стресс',
    questions: [
      { question: 'Как часто у тебя тревожные мысли без повода?', answers: [{ text: 'Почти постоянно фоновая тревога', pessimistic: true }, { text: 'Бывает, но не затапливает', pessimistic: false }] },
      { question: 'Ты часто прокручиваешь разговоры и ситуации в голове?', answers: [{ text: 'Да, не могу остановиться', pessimistic: true }, { text: 'Иногда, но потом отпускаю', pessimistic: false }] },
      { question: 'Как ты реагируешь на неожиданные изменения планов?', answers: [{ text: 'Сильно расстраиваюсь и тревожусь', pessimistic: true }, { text: 'Неприятно, но адаптируюсь', pessimistic: false }] },
      { question: 'Ты замечаешь физические симптомы стресса (сердце, дыхание)?', answers: [{ text: 'Да, часто', pessimistic: true }, { text: 'Редко или никогда', pessimistic: false }] },
      { question: 'Ты боишься что-то испортить или сделать не так?', answers: [{ text: 'Постоянно, это мешает начать', pessimistic: true }, { text: 'Стараюсь, но не парализуюсь', pessimistic: false }] },
      { question: 'Как тебе даётся расслабиться?', answers: [{ text: 'Не могу расслабиться даже в тишине', pessimistic: true }, { text: 'Когда хочу — умею отдохнуть', pessimistic: false }] },
      { question: 'Как ты думаешь, всё будет хорошо?', answers: [{ text: 'Нет, постоянно жду плохого', pessimistic: true }, { text: 'Скорее да, или хотя бы нейтрально', pessimistic: false }] },
      { question: 'Когда ты слышишь плохие новости, ты...', answers: [{ text: 'Долго не могу выбросить их из головы', pessimistic: true }, { text: 'Переживаю, но не зависаю надолго', pessimistic: false }] },
      { question: 'Ты часто чувствуешь напряжение в теле?', answers: [{ text: 'Да, постоянно зажат(а)', pessimistic: true }, { text: 'Иногда, но не хронически', pessimistic: false }] },
      { question: 'Тебе удаётся «выключить голову» хотя бы ненадолго?', answers: [{ text: 'Нет, мысли не останавливаются', pessimistic: true }, { text: 'Да, есть способы переключиться', pessimistic: false }] },
    ],
  },
  // Pack 6 — Радость и удовольствие
  {
    title: 'Радость и удовольствие',
    questions: [
      { question: 'Что-то радует тебя прямо сейчас?', answers: [{ text: 'Есть что-то маленькое', pessimistic: false }, { text: 'Ничего не приходит в голову', pessimistic: true }] },
      { question: 'Когда ты последний раз по-настоящему смеялся(ась)?', answers: [{ text: 'Не так давно, помню', pessimistic: false }, { text: 'Уже не помню когда', pessimistic: true }] },
      { question: 'Есть ли занятие, от которого тебе становится лучше?', answers: [{ text: 'Нет, всё одинаково серо', pessimistic: true }, { text: 'Да, хотя бы что-то одно', pessimistic: false }] },
      { question: 'Ты умеешь находить что-то приятное в обычном дне?', answers: [{ text: 'Иногда замечаю мелкие хорошие вещи', pessimistic: false }, { text: 'Нет, день как день', pessimistic: true }] },
      { question: 'Как ты реагируешь на красивые или приятные вещи?', answers: [{ text: 'Они меня всё меньше трогают', pessimistic: true }, { text: 'Замечаю и ценю', pessimistic: false }] },
      { question: 'Ты иногда делаешь что-то просто ради удовольствия?', answers: [{ text: 'Нет, всё должно быть полезным', pessimistic: true }, { text: 'Да, позволяю себе', pessimistic: false }] },
      { question: 'Ты предвкушаешь хоть что-то в ближайшие дни?', answers: [{ text: 'Нет, ничего интересного не ожидается', pessimistic: true }, { text: 'Есть хоть что-то', pessimistic: false }] },
      { question: 'Как ты относишься к маленьким радостям — кофе, закат, музыка?', answers: [{ text: 'Они больше не работают, всё пресно', pessimistic: true }, { text: 'Иногда поднимают настроение', pessimistic: false }] },
      { question: 'Ты позволяешь себе отдыхать без чувства вины?', answers: [{ text: 'Нет, отдых ощущается как бесполезность', pessimistic: true }, { text: 'Да, умею переключаться', pessimistic: false }] },
      { question: 'Ты помнишь когда последний раз был(а) по-настоящему доволен(а) днём?', answers: [{ text: 'Да, не так давно', pessimistic: false }, { text: 'Давно, почти не помню такого', pessimistic: true }] },
    ],
  },
  // Pack 7 — Настоящий момент
  {
    title: 'Здесь и сейчас',
    questions: [
      { question: 'Ты присутствуешь в том, чем занимаешься?', answers: [{ text: 'Часто мысли где-то ещё', pessimistic: true }, { text: 'В целом да, хотя иногда отвлекаюсь', pessimistic: false }] },
      { question: 'Ты замечаешь что происходит вокруг тебя?', answers: [{ text: 'Не особо, хожу как в тумане', pessimistic: true }, { text: 'Да, замечаю окружение', pessimistic: false }] },
      { question: 'Как ты справляешься с неопределённостью?', answers: [{ text: 'Плохо, не знаю что будет — тревога', pessimistic: true }, { text: 'Принимаю что не всё под контролем', pessimistic: false }] },
      { question: 'Тебя часто накрывают воспоминания о прошлом?', answers: [{ text: 'Да, сожалею о многом', pessimistic: true }, { text: 'Вспоминаю, но не застреваю', pessimistic: false }] },
      { question: 'Как тебе даётся быть в тишине?', answers: [{ text: 'Тишина давит, надо чем-то заполнить', pessimistic: true }, { text: 'Нормально, иногда даже нравится', pessimistic: false }] },
      { question: 'Ты часто живёшь ожиданием «когда станет лучше»?', answers: [{ text: 'Да, всё хорошее где-то потом', pessimistic: true }, { text: 'Стараюсь находить что-то и сейчас', pessimistic: false }] },
      { question: 'Как ты реагируешь когда всё идёт нормально?', answers: [{ text: 'Жду что скоро что-то испортится', pessimistic: true }, { text: 'Просто принимаю это как есть', pessimistic: false }] },
      { question: 'Ты умеешь остановиться и просто побыть?', answers: [{ text: 'Нет, постоянно нужно что-то делать', pessimistic: true }, { text: 'Да, иногда это даже хорошо', pessimistic: false }] },
      { question: 'Прямо сейчас тебе комфортно?', answers: [{ text: 'Нет, что-то давит', pessimistic: true }, { text: 'Более-менее нормально', pessimistic: false }] },
      { question: 'Есть ли что-то прямо сейчас чему ты рад(а)?', answers: [{ text: 'Не могу придумать ничего', pessimistic: true }, { text: 'Да, хоть что-то маленькое найдётся', pessimistic: false }] },
    ],
  },
  // Pack 8 — Смысл и ценности
  {
    title: 'Смысл и ценности',
    questions: [
      { question: 'Есть ли в твоей жизни что-то, что кажется важным?', answers: [{ text: 'Нет, всё одинаково незначительно', pessimistic: true }, { text: 'Да, хоть что-то важное есть', pessimistic: false }] },
      { question: 'Твои действия соответствуют тому, что ты ценишь?', answers: [{ text: 'Нет, живу не так как хочу', pessimistic: true }, { text: 'Иногда удаётся жить в соответствии с собой', pessimistic: false }] },
      { question: 'Тебе важно что ты оставляешь после себя?', answers: [{ text: 'Нет, это кажется бессмысленным', pessimistic: true }, { text: 'Да, хочу что-то значить', pessimistic: false }] },
      { question: 'Ты помогаешь другим, даже по мелочи?', answers: [{ text: 'Иногда, и это даёт что-то внутри', pessimistic: false }, { text: 'Зачем — мне бы самому(ой) помочь', pessimistic: true }] },
      { question: 'Есть ли у тебя ценности, которым ты следуешь?', answers: [{ text: 'Есть хоть какие-то принципы', pessimistic: false }, { text: 'Не знаю, что мне вообще важно', pessimistic: true }] },
      { question: 'Когда тебе плохо, ты понимаешь почему?', answers: [{ text: 'Нет, просто плохо и всё', pessimistic: true }, { text: 'Обычно могу найти причину', pessimistic: false }] },
      { question: 'Ты чувствуешь, что твоя жизнь движется куда надо?', answers: [{ text: 'Нет, ощущение дрейфа', pessimistic: true }, { text: 'В целом да, пусть и медленно', pessimistic: false }] },
      { question: 'Есть ли что-то, ради чего стоит вставать утром?', answers: [{ text: 'Встаю потому что надо, не потому что хочу', pessimistic: true }, { text: 'Да, есть хоть что-то', pessimistic: false }] },
      { question: 'Ты умеешь принимать то, что не изменить?', answers: [{ text: 'С трудом, злюсь на то что не контролирую', pessimistic: true }, { text: 'Стараюсь принимать, хотя не всегда выходит', pessimistic: false }] },
      { question: 'Ты живёшь своей жизнью или чьими-то ожиданиями?', answers: [{ text: 'Больше чужими ожиданиями', pessimistic: true }, { text: 'Стараюсь жить по-своему', pessimistic: false }] },
    ],
  },
  // Pack 9 — Тело и голова
  {
    title: 'Тело и голова',
    questions: [
      { question: 'Как твоя голова справляется с информационным потоком?', answers: [{ text: 'Перегружена, сложно сосредоточиться', pessimistic: true }, { text: 'В целом справляюсь', pessimistic: false }] },
      { question: 'Ты часто испытываешь головные боли или напряжение?', answers: [{ text: 'Да, регулярно', pessimistic: true }, { text: 'Редко', pessimistic: false }] },
      { question: 'Как ты относишься к своему телу?', answers: [{ text: 'Принимаю как есть', pessimistic: false }, { text: 'Часто недоволен(а), хотелось бы иначе', pessimistic: true }] },
      { question: 'Ты заботишься о себе физически?', answers: [{ text: 'Стараюсь хотя бы по минимуму', pessimistic: false }, { text: 'Нет сил и желания даже на это', pessimistic: true }] },
      { question: 'Ты замечаешь когда тебе нужна пауза?', answers: [{ text: 'Да и стараюсь её брать', pessimistic: false }, { text: 'Понимаю, но не могу остановиться', pessimistic: true }] },
      { question: 'Бывает ли у тебя ощущение «пустоты» в голове?', answers: [{ text: 'Да, всё как через вату', pessimistic: true }, { text: 'Нет или редко', pessimistic: false }] },
      { question: 'Ты пьёшь достаточно воды и нормально питаешься?', answers: [{ text: 'Не особо, не слежу за собой', pessimistic: true }, { text: 'Стараюсь следить', pessimistic: false }] },
      { question: 'Когда ты болеешь, ты относишься к себе бережно?', answers: [{ text: 'Нет, продолжаю себя нагружать', pessimistic: true }, { text: 'Да, даю себе время восстановиться', pessimistic: false }] },
      { question: 'Есть ли у тебя хроническая усталость — не от работы, а «от жизни»?', answers: [{ text: 'Да, это точное описание', pessimistic: true }, { text: 'Не особо, обычная усталость', pessimistic: false }] },
      { question: 'Как ты относишься к своему здоровью?', answers: [{ text: 'Не думаю об этом, нет сил думать', pessimistic: true }, { text: 'Стараюсь обращать внимание', pessimistic: false }] },
    ],
  },
];

export const DAILY_QUESTIONS = [
  'Что сегодня было самым трудным?',
  'Есть ли что-то маленькое, что порадовало сегодня?',
  'Что съел(а) последним? Это был хороший выбор?',
  'Когда последний раз ты делал(а) что-то только для себя?',
  'Если бы сегодня был фильм — какой жанр?',
  'Что хотелось бы забыть про этот день?',
  'Есть ли человек, которому хотелось бы написать прямо сейчас?',
  'Что не дало тебе расклеиться сегодня?',
  'Назови одну вещь, которую ты сделал(а) хорошо.',
  'Как ты себя чувствуешь прямо сейчас — одним словом?',
  'Что ты откладываешь и почему?',
  'Если бы мог(ла) провести завтра как угодно — что бы выбрал(а)?',
  'Что тебя злит прямо сейчас?',
  'Что тебя успокаивает?',
  'Есть что-то, о чём ты не решаешься говорить вслух?',
  'Какой звук ты хотел(а) бы слышать прямо сейчас?',
  'Что помогло бы тебе сегодня лечь спать спокойно?',
  'Что сегодня оказалось не таким страшным, как казалось?',
  'Ты сегодня пил(а) воду? Не стакан. Реально пил(а)?',
  'Что стало неожиданным сегодня?',
  'Есть ли что-то, чего ты стыдишься — и зря?',
  'Какую мелочь хотелось бы изменить в сегодняшнем дне?',
  'Ты сегодня был(а) честен(а) с собой?',
  'Что ты сделал(а) впервые за долгое время?',
  'Что бы ты сказал(а) себе утреннему?',
  'Что мешает тебе отдохнуть?',
  'Есть ли кто-то, кому ты завидуешь? Почему?',
  'Что бы ты взял(а) с собой на необитаемый остров из сегодняшнего дня?',
  'Когда ты последний раз смеялся(ась) по-настоящему?',
  'Что ты хотел(а) бы сказать тому, кого нет рядом?',
];

export const ACHIEVEMENTS = [
  { id: 'first_test',    emoji: '🐣', label: 'Первый шаг',     desc: 'Прошёл первый тест' },
  { id: 'five_tests',    emoji: '🔁', label: 'Привычка',        desc: 'Прошёл 5 тестов' },
  { id: 'ten_tests',     emoji: '🧠', label: 'Самоанализ',      desc: 'Прошёл 10 тестов' },
  { id: 'comeback',      emoji: '📈', label: 'Возвращение',     desc: 'Улучшил уровень после красного' },
  { id: 'stable',        emoji: '🧘', label: 'Стабильность',    desc: 'Три зелёных теста подряд' },
  { id: 'first_friend',  emoji: '🤝', label: 'Не один',         desc: 'Добавил первого друга' },
  { id: 'first_dm',      emoji: '📨', label: 'Первое письмо',   desc: 'Отправил личное сообщение' },
  { id: 'profile_done',  emoji: '👤', label: 'Личность',        desc: 'Заполнил статус и аватар' },
  { id: 'daily_7',       emoji: '📅', label: 'Неделя',          desc: 'Ответил на вопрос 7 дней подряд' },
  { id: 'first_post',    emoji: '✍️', label: 'Голос',           desc: 'Написал первый пост в ленту' },
];
