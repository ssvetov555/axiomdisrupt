-- ============================================================
-- Пресеты программ для тренера Сергея Чаплыгина.
-- 4 классические программы: Stronglifts 5×5, Шейко, 5/3/1, PPL.
-- ============================================================
-- ВНИМАНИЕ: trainer_id берётся подзапросом по имени, поэтому
-- скрипт надо запускать после того, как тренер уже создан.
-- Безопасно перезапускать: удаляет существующие пресеты по имени
-- перед вставкой.
-- ============================================================

-- Чистим старые пресеты с теми же именами (если повторно прогоняем)
DELETE FROM programs WHERE name IN (
  'Stronglifts 5×5',
  'Программа Шейко (3 дня)',
  '5/3/1 Вендлер',
  'Push-Pull-Legs (6 дней)'
) AND trainer_id = (SELECT id FROM users WHERE role='trainer' AND name='Сергей Чаплыгин' LIMIT 1);

-- ============================================================
-- 1. STRONGLIFTS 5×5  (классика для начинающих, 3 дня/нед A-B-A)
-- ============================================================
INSERT INTO programs (trainer_id, name, description)
VALUES (
  (SELECT id FROM users WHERE role='trainer' AND name='Сергей Чаплыгин' LIMIT 1),
  'Stronglifts 5×5',
  'Базовая программа для начинающих, 3 раза в неделю (Пн/Ср/Пт). Чередуем тренировки A и B: на первой неделе A-B-A, на второй B-A-B. Веса добавляем по 2.5 кг каждую тренировку (1.25 кг для жима стоя), пока удаётся выполнить все 5×5. Начинаем с пустого грифа или 40-50% от рабочего веса.'
);

-- Пн (Workout A)
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='Stronglifts 5×5' LIMIT 1), 'Приседания со штангой', 'Глубокий присед до параллели бедра с полом, спина прямая, штанга на трапециях.', 5, '5', 'рабочий', 180, 1, 0),
((SELECT id FROM programs WHERE name='Stronglifts 5×5' LIMIT 1), 'Жим лёжа', 'Хват чуть шире плеч, лопатки сведены, штанга касается груди, без отбива.', 5, '5', 'рабочий', 180, 1, 1),
((SELECT id FROM programs WHERE name='Stronglifts 5×5' LIMIT 1), 'Тяга штанги в наклоне', 'Наклон 45°, тянем штангу к низу живота, локти вдоль корпуса.', 5, '5', 'рабочий', 180, 1, 2);

-- Ср (Workout B)
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='Stronglifts 5×5' LIMIT 1), 'Приседания со штангой', 'Та же техника, что и в день A.', 5, '5', 'рабочий', 180, 3, 0),
((SELECT id FROM programs WHERE name='Stronglifts 5×5' LIMIT 1), 'Жим штанги стоя (армейский)', 'Стоя, штанга от груди вверх над головой. Корпус не отклоняем назад.', 5, '5', 'рабочий', 180, 3, 1),
((SELECT id FROM programs WHERE name='Stronglifts 5×5' LIMIT 1), 'Становая тяга', 'Один рабочий подход на 5 повторов. Спина прямая, гриф у ноги.', 1, '5', 'рабочий', 240, 3, 2);

-- Пт (Workout A повтор)
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='Stronglifts 5×5' LIMIT 1), 'Приседания со штангой', 'Третий присед за неделю — нормальная нагрузка по программе.', 5, '5', 'рабочий', 180, 5, 0),
((SELECT id FROM programs WHERE name='Stronglifts 5×5' LIMIT 1), 'Жим лёжа', 'Та же техника, продолжаем линейный прогресс.', 5, '5', 'рабочий', 180, 5, 1),
((SELECT id FROM programs WHERE name='Stronglifts 5×5' LIMIT 1), 'Тяга штанги в наклоне', 'Та же техника. Если поясница забилась — снизить вес.', 5, '5', 'рабочий', 180, 5, 2);

-- ============================================================
-- 2. ПРОГРАММА ШЕЙКО (адаптированная база, 3 дня/нед)
-- ============================================================
INSERT INTO programs (trainer_id, name, description)
VALUES (
  (SELECT id FROM users WHERE role='trainer' AND name='Сергей Чаплыгин' LIMIT 1),
  'Программа Шейко (3 дня)',
  'Адаптированная база Бориса Шейко для любителей-троеборцев. 3 раза в неделю (Пн/Ср/Пт). Веса указаны в процентах от текущего одноповторного максимума (1ПМ). Главные движения: присед, жим лёжа, становая. Объём высокий — растёт сила и техника одновременно.'
);

-- Пн
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='Программа Шейко (3 дня)' LIMIT 1), 'Приседания со штангой', 'Разминка лесенкой 50→60→65%. Затем рабочие подходы.', 5, '5', '70% от 1ПМ', 240, 1, 0),
((SELECT id FROM programs WHERE name='Программа Шейко (3 дня)' LIMIT 1), 'Жим лёжа', 'Соревновательная техника: мост, пауза на груди по команде.', 6, '4', '75% от 1ПМ', 180, 1, 1),
((SELECT id FROM programs WHERE name='Программа Шейко (3 дня)' LIMIT 1), 'Тяга штанги в наклоне', 'Подсобка к становой и спине.', 5, '8', 'рабочий', 120, 1, 2),
((SELECT id FROM programs WHERE name='Программа Шейко (3 дня)' LIMIT 1), 'Пресс — скручивания', 'Стабилизация корпуса.', 4, '15', 'свой вес', 60, 1, 3);

-- Ср
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='Программа Шейко (3 дня)' LIMIT 1), 'Жим лёжа', 'Объёмный день. Контролируем технику.', 6, '5', '70% от 1ПМ', 180, 3, 0),
((SELECT id FROM programs WHERE name='Программа Шейко (3 дня)' LIMIT 1), 'Жим узким хватом', 'Подсобка для трицепса. Хват на ширине плеч.', 5, '6', '60% от 1ПМ жима', 150, 3, 1),
((SELECT id FROM programs WHERE name='Программа Шейко (3 дня)' LIMIT 1), 'Гиперэкстензия', 'Укрепление поясницы перед становой.', 3, '12', 'свой вес или 10 кг', 90, 3, 2),
((SELECT id FROM programs WHERE name='Программа Шейко (3 дня)' LIMIT 1), 'Разводки гантелей в стороны', 'Дельты, общее развитие.', 4, '12', 'лёгкий', 60, 3, 3);

-- Пт
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='Программа Шейко (3 дня)' LIMIT 1), 'Приседания со штангой', 'Тяжёлый день. Хорошая разминка обязательна.', 6, '4', '80% от 1ПМ', 240, 5, 0),
((SELECT id FROM programs WHERE name='Программа Шейко (3 дня)' LIMIT 1), 'Жим лёжа лёгкий', 'Восстановительный объём.', 5, '6', '70% от 1ПМ', 180, 5, 1),
((SELECT id FROM programs WHERE name='Программа Шейко (3 дня)' LIMIT 1), 'Становая тяга', 'Главное упражнение пятницы. Не более 1-2 рабочих подходов в неделю.', 5, '3', '80% от 1ПМ', 240, 5, 2),
((SELECT id FROM programs WHERE name='Программа Шейко (3 дня)' LIMIT 1), 'Подтягивания', 'Хват средний, вверх до подбородка.', 4, '8', 'свой вес', 120, 5, 3);

-- ============================================================
-- 3. 5/3/1 ВЕНДЛЕРА (4 дня/нед, прогрессия на 4-недельных циклах)
-- ============================================================
INSERT INTO programs (trainer_id, name, description)
VALUES (
  (SELECT id FROM users WHERE role='trainer' AND name='Сергей Чаплыгин' LIMIT 1),
  '5/3/1 Вендлер',
  'Программа Джима Вендлера для среднего/продвинутого уровня. 4 тренировки в неделю, одна — на каждое из 4 главных движений. Прогрессия строится на 4-недельных циклах: нед.1 — 5/5/5+ от 85%, нед.2 — 3/3/3+ от 90%, нед.3 — 5/3/1+ от 95%, нед.4 — разгрузка. Тренировочный максимум (TM) = 90% от 1ПМ. Знак "+" в последнем подходе означает "на максимум повторов".'
);

-- Пн — армейский жим
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='5/3/1 Вендлер' LIMIT 1), 'Жим штанги стоя — основной', 'Главное движение дня. Веса по схеме недели: 5/5/5+ → 3/3/3+ → 5/3/1+ → разгрузка.', 3, '5/5/5+', 'TM × 65/75/85% (неделя 1)', 240, 1, 0),
((SELECT id FROM programs WHERE name='5/3/1 Вендлер' LIMIT 1), 'Отжимания на брусьях', 'Подсобка для трицепса и груди.', 5, '10', 'свой вес', 90, 1, 1),
((SELECT id FROM programs WHERE name='5/3/1 Вендлер' LIMIT 1), 'Подтягивания', 'Чтобы сбалансировать жимы пуллингом.', 5, '10', 'свой вес', 90, 1, 2);

-- Вт — становая
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='5/3/1 Вендлер' LIMIT 1), 'Становая тяга — основная', 'Главное движение дня. Стартовая позиция — гриф над серединой стопы.', 3, '5/5/5+', 'TM × 65/75/85% (неделя 1)', 300, 2, 0),
((SELECT id FROM programs WHERE name='5/3/1 Вендлер' LIMIT 1), 'Румынская тяга', 'Подсобка для задней цепи.', 5, '10', '50-60% от становой', 120, 2, 1),
((SELECT id FROM programs WHERE name='5/3/1 Вендлер' LIMIT 1), 'Подтягивания обратным хватом', 'Бицепс + широчайшие.', 5, '10', 'свой вес', 90, 2, 2);

-- Чт — жим лёжа
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='5/3/1 Вендлер' LIMIT 1), 'Жим лёжа — основной', 'Главное движение дня.', 3, '5/5/5+', 'TM × 65/75/85% (неделя 1)', 240, 4, 0),
((SELECT id FROM programs WHERE name='5/3/1 Вендлер' LIMIT 1), 'Жим гантелей лёжа', 'Объёмная подсобка для груди.', 5, '10', 'рабочий', 90, 4, 1),
((SELECT id FROM programs WHERE name='5/3/1 Вендлер' LIMIT 1), 'Тяга штанги в наклоне', 'Балансирует жимы.', 5, '10', 'рабочий', 90, 4, 2);

-- Пт — присед
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='5/3/1 Вендлер' LIMIT 1), 'Приседания со штангой — основные', 'Главное движение дня.', 3, '5/5/5+', 'TM × 65/75/85% (неделя 1)', 300, 5, 0),
((SELECT id FROM programs WHERE name='5/3/1 Вендлер' LIMIT 1), 'Выпады с гантелями', 'Подсобка для ног и стабилизаторов.', 4, '12', 'умеренный', 90, 5, 1),
((SELECT id FROM programs WHERE name='5/3/1 Вендлер' LIMIT 1), 'Подъём на носки', 'Икроножные.', 4, '15', 'тяжёлый', 60, 5, 2);

-- ============================================================
-- 4. PUSH-PULL-LEGS (6 дней/нед, классика для набора массы)
-- ============================================================
INSERT INTO programs (trainer_id, name, description)
VALUES (
  (SELECT id FROM users WHERE role='trainer' AND name='Сергей Чаплыгин' LIMIT 1),
  'Push-Pull-Legs (6 дней)',
  'Классический сплит на 6 тренировок в неделю: Push (жимы — грудь/плечи/трицепс), Pull (тяги — спина/бицепс), Legs (ноги). Каждая группа тренируется дважды в неделю. Высокий объём, быстрый рост мышечной массы. Воскресенье — выходной. Подходит для подготовленных любителей.'
);

-- Пн — Push 1 (упор на грудь)
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Жим лёжа', 'Основное движение для груди.', 4, '6-8', 'рабочий', 150, 1, 0),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Жим гантелей на наклонной', 'Верх груди.', 3, '8-10', 'рабочий', 120, 1, 1),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Жим штанги стоя', 'Дельты, передний пучок.', 3, '6-8', 'рабочий', 120, 1, 2),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Разводки гантелей в стороны', 'Изоляция средних дельт.', 3, '12-15', 'лёгкий', 60, 1, 3),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Французский жим', 'Трицепс.', 3, '10-12', 'рабочий', 75, 1, 4);

-- Вт — Pull 1 (упор на спину)
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Становая тяга', 'Главное общее упражнение.', 3, '5', '75-85% от 1ПМ', 240, 2, 0),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Подтягивания', 'Широчайшие, ширина.', 4, '8', 'свой вес или с отягощением', 120, 2, 1),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Тяга штанги в наклоне', 'Толщина спины.', 3, '8', 'рабочий', 120, 2, 2),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Тяга гантели в наклоне', 'Односторонняя изоляция широчайших.', 3, '10', 'рабочий', 90, 2, 3),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Подъём штанги на бицепс', 'Бицепс.', 3, '10', 'рабочий', 75, 2, 4);

-- Ср — Legs 1 (упор на квадрицепсы)
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Приседания со штангой', 'Главное движение дня.', 4, '6-8', 'рабочий', 180, 3, 0),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Жим ногами', 'Объёмная нагрузка на квадрицепс.', 3, '10', 'рабочий', 120, 3, 1),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Румынская тяга', 'Бицепс бедра.', 3, '8-10', 'рабочий', 120, 3, 2),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Сгибания ног лёжа', 'Изоляция бицепса бедра.', 3, '12', 'рабочий', 60, 3, 3),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Подъём на носки', 'Икры.', 4, '15', 'тяжёлый', 60, 3, 4);

-- Чт — Push 2 (упор на плечи и трицепс)
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Жим штанги стоя', 'Главное движение для плеч.', 4, '6-8', 'рабочий', 150, 4, 0),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Жим лёжа на наклонной', 'Верх груди, второй раз за неделю.', 3, '8', 'рабочий', 120, 4, 1),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Разводки гантелей в стороны', 'Средние дельты.', 3, '12-15', 'лёгкий', 60, 4, 2),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Отжимания на брусьях', 'Трицепс + низ груди.', 3, '8-12', 'свой вес или с отягощением', 90, 4, 3),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Разгибания на блоке', 'Изоляция трицепса.', 3, '12', 'рабочий', 60, 4, 4);

-- Пт — Pull 2 (упор на ширину спины и бицепс)
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Подтягивания с отягощением', 'Главное движение для широчайших.', 4, '6-8', 'свой вес + отягощение', 150, 5, 0),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Тяга нижнего блока', 'Толщина и середина спины.', 3, '10', 'рабочий', 90, 5, 1),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Шраги со штангой', 'Трапеции.', 3, '12', 'тяжёлый', 75, 5, 2),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Молот с гантелями', 'Брахиалис, толщина руки.', 3, '10', 'рабочий', 60, 5, 3),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Скручивания на пресс', 'Пресс.', 4, '15-20', 'свой вес', 60, 5, 4);

-- Сб — Legs 2 (упор на бицепс бедра и икры)
INSERT INTO exercises (program_id, name, description, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index) VALUES
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Приседания фронтальные', 'Акцент на квадрицепс и осанку.', 4, '6-8', 'рабочий', 180, 6, 0),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Выпады со штангой', 'Каждая нога.', 3, '10', 'рабочий', 120, 6, 1),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Болгарские сплит-приседания', 'Унилатеральная сила и баланс.', 3, '10', 'с гантелями', 90, 6, 2),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Гиперэкстензия', 'Поясница и ягодицы.', 3, '12', 'свой вес или с отягощением', 75, 6, 3),
((SELECT id FROM programs WHERE name='Push-Pull-Legs (6 дней)' LIMIT 1), 'Подъём на носки сидя', 'Камбаловидная мышца.', 4, '15', 'рабочий', 60, 6, 4);

-- Проверка: сколько чего вставилось
SELECT 'Программы:' AS info, COUNT(*) AS cnt FROM programs
WHERE trainer_id = (SELECT id FROM users WHERE role='trainer' AND name='Сергей Чаплыгин' LIMIT 1)
UNION ALL
SELECT 'Упражнения:', COUNT(*) FROM exercises
WHERE program_id IN (SELECT id FROM programs WHERE trainer_id = (SELECT id FROM users WHERE role='trainer' AND name='Сергей Чаплыгин' LIMIT 1));
