INSERT INTO resources (title, type, url, topic, dimension_weights) VALUES
-- Тревога
('Как справиться с тревогой', 'video', 'https://www.youtube.com/watch?v=rJy_0VpWDGM', 'anxiety',
 '{"anxiety": 0.9, "stress": 0.4, "social_anxiety": 0.3}'),
('Лабковский: как избавиться от страха', 'video', 'https://www.youtube.com/watch?v=oAJRs9lSgIc', 'anxiety',
 '{"anxiety": 0.9, "social_anxiety": 0.5}'),
('Дневник тревог: уменьшаем тревожность', 'article', 'https://www.b17.ru/article/549223/', 'anxiety',
 '{"anxiety": 0.8, "stress": 0.3}'),
('Тревога: цикл статей', 'article', 'https://www.b17.ru/article/iamhigh_trevoga2/', 'anxiety',
 '{"anxiety": 0.9, "apathy": 0.2}'),

-- Апатия и депрессия
('Апатия: когда ничего не хочется', 'video', 'https://www.youtube.com/watch?v=rewr6Q7jnVo', 'depression',
 '{"apathy": 0.9, "burnout": 0.4, "self_esteem": 0.3}'),
('Как бороться с депрессией и апатией', 'video', 'https://www.youtube.com/watch?v=giPo2OX1FdY', 'depression',
 '{"apathy": 0.9, "burnout": 0.5}'),
('Апатия, депрессия. Где брать ресурс?', 'article', 'https://www.b17.ru/article/kritskayaapatia/', 'depression',
 '{"apathy": 0.9, "burnout": 0.4, "self_esteem": 0.3}'),
('Что такое депрессия: взгляд психолога', 'article', 'https://www.b17.ru/article/16298/', 'depression',
 '{"apathy": 0.8, "loneliness": 0.3}'),

-- Выгорание
('Как распознать эмоциональное выгорание', 'video', 'https://www.youtube.com/watch?v=R8H0o5Avh98', 'burnout',
 '{"burnout": 0.9, "stress": 0.5, "apathy": 0.4}'),
('Выгорание vs усталость: лекция Филоник', 'video', 'https://www.youtube.com/watch?v=MG2o_ZKZYsM', 'burnout',
 '{"burnout": 0.9, "stress": 0.4}'),
('Выгорание: доказательные методы помощи', 'article', 'https://www.b17.ru/article/827185/', 'burnout',
 '{"burnout": 0.9, "stress": 0.4, "apathy": 0.3}'),
('Пошаговая стратегия восстановления', 'article', 'https://www.b17.ru/article/830567/', 'burnout',
 '{"burnout": 0.8, "apathy": 0.4}'),

-- Одиночество
('Одиночество: как перестать бояться себя', 'video', 'https://www.youtube.com/watch?v=n3Xv_g3g-mA', 'loneliness',
 '{"loneliness": 0.9, "social_anxiety": 0.4, "attachment": 0.3}'),
('Почему мы чувствуем себя одинокими', 'article', 'https://www.b17.ru/article/odinochestvo_prichiny/', 'loneliness',
 '{"loneliness": 0.9, "attachment": 0.4}'),
('Как найти своих людей', 'article', 'https://www.b17.ru/article/kak_nayti_svoikh/', 'loneliness',
 '{"loneliness": 0.8, "social_anxiety": 0.5, "attachment": 0.4}'),

-- Самооценка
('Как перестать себя критиковать', 'video', 'https://www.youtube.com/watch?v=y_vS87RX5QA', 'self_esteem',
 '{"self_esteem": 0.9, "anxiety": 0.3}'),
('Самооценка и внутренний критик', 'article', 'https://www.b17.ru/article/samootsenka_kritik/', 'self_esteem',
 '{"self_esteem": 0.9, "anxiety": 0.2}'),
('Как принять себя: практика самосострадания', 'article', 'https://www.b17.ru/article/samosostradanie/', 'self_esteem',
 '{"self_esteem": 0.8, "apathy": 0.3, "burnout": 0.2}'),

-- Стресс
('Стресс: что происходит в теле и голове', 'video', 'https://www.youtube.com/watch?v=v-t1Z5-oPtU', 'stress',
 '{"stress": 0.9, "anxiety": 0.4}'),
('Хронический стресс: как остановить', 'article', 'https://www.b17.ru/article/khronicheskiy_stress/', 'stress',
 '{"stress": 0.9, "burnout": 0.4, "anxiety": 0.3}'),

-- Отношения и привязанность
('Тревожная привязанность: как выйти из замкнутого круга', 'video', 'https://www.youtube.com/watch?v=pY5BpAMDe_c', 'attachment',
 '{"attachment": 0.9, "anxiety": 0.4, "social_anxiety": 0.3}'),
('Стили привязанности в отношениях', 'article', 'https://www.b17.ru/article/stili_privyazannosti/', 'attachment',
 '{"attachment": 0.9, "loneliness": 0.3}'),

-- Социальная тревожность
('Социальная тревожность: я среди людей', 'video', 'https://www.youtube.com/watch?v=1HE6KW0mIBw', 'social_anxiety',
 '{"social_anxiety": 0.9, "anxiety": 0.5, "loneliness": 0.3}'),
('Страх осуждения и как с ним жить', 'article', 'https://www.b17.ru/article/strakh_osuzhdeniya/', 'social_anxiety',
 '{"social_anxiety": 0.9, "anxiety": 0.4, "self_esteem": 0.3}');
