-- ============================================================
-- Миграция #2 — каталог программ, рейтинг, теги, сложность,
-- архив, замер веса тела, библиотека упражнений.
-- Запускать ОДИН раз после schema.sql.
-- ============================================================

-- ----- programs: поля каталога -----
ALTER TABLE programs ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;
ALTER TABLE programs ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE programs ADD COLUMN difficulty TEXT;        -- beginner | intermediate | advanced
ALTER TABLE programs ADD COLUMN tags TEXT;              -- JSON-массив строк, например '["сила","масса"]'
ALTER TABLE programs ADD COLUMN duration_weeks INTEGER; -- рекомендуемая длительность

-- ----- Рейтинги -----
CREATE TABLE IF NOT EXISTS program_ratings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id  INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars       INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  review      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (program_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_program ON program_ratings(program_id);

-- ----- Замеры (вес тела, обхваты) -----
CREATE TABLE IF NOT EXISTS body_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date    TEXT NOT NULL DEFAULT (date('now')),
  weight_kg   REAL,
  waist_cm    REAL,
  chest_cm    REAL,
  arm_cm      REAL,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_body_client_date ON body_logs(client_id, log_date);

-- ----- Дни отдыха (отметка "сегодня выходной") -----
CREATE TABLE IF NOT EXISTS rest_days (
  client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date    TEXT NOT NULL,
  reason      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (client_id, log_date)
);

-- ----- Личные рекорды (вычисляются автоматически, но кэшируем последние) -----
-- Хранение опционально, можно вычислять на лету. Делаем индекс для быстрых запросов.
CREATE INDEX IF NOT EXISTS idx_logs_exercise_weight ON workout_logs(exercise_id, client_id, done_weight);

-- ----- Уведомления "непрочитанные комментарии" -----
-- Простая модель: для каждого пользователя храним last_read_at для каждой нити (exercise, client).
CREATE TABLE IF NOT EXISTS comment_reads (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, exercise_id, client_id)
);

-- ----- Библиотека упражнений (общая) -----
-- Используется для автодополнения и быстрого добавления упражнений с готовым описанием.
CREATE TABLE IF NOT EXISTS exercise_library (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE,
  category     TEXT,
  description  TEXT,
  video_url    TEXT,
  muscle_group TEXT,    -- chest, back, legs, shoulders, arms, core
  equipment    TEXT     -- barbell, dumbbell, bodyweight, machine, cable
);

INSERT OR IGNORE INTO exercise_library (name, muscle_group, equipment, description) VALUES
('Приседания со штангой', 'legs', 'barbell', 'Базовое упражнение для квадрицепса. Опуститься до параллели бедра с полом, спина прямая.'),
('Жим лёжа', 'chest', 'barbell', 'Базовое для груди. Лопатки сведены, штанга касается груди, без отбива.'),
('Становая тяга', 'back', 'barbell', 'Полное движение для задней цепи. Спина прямая, гриф у ноги.'),
('Жим штанги стоя (армейский)', 'shoulders', 'barbell', 'Стоя, штанга от груди вверх над головой. Корпус не отклоняем назад.'),
('Тяга штанги в наклоне', 'back', 'barbell', 'Наклон 45°, тянем штангу к низу живота, локти вдоль корпуса.'),
('Подтягивания', 'back', 'bodyweight', 'Прямой или обратный хват. Подбородок над перекладиной.'),
('Отжимания на брусьях', 'chest', 'bodyweight', 'Наклон корпуса вперёд = грудь, прямо = трицепс.'),
('Жим гантелей лёжа', 'chest', 'dumbbell', 'Шире амплитуда чем у штанги. Сводим гантели сверху, но без удара.'),
('Жим гантелей на наклонной', 'chest', 'dumbbell', 'Угол скамьи 30-45°. Акцент на верх груди.'),
('Разводки гантелей в стороны', 'shoulders', 'dumbbell', 'Изоляция средних дельт. Локти чуть согнуты, поднимаем до уровня плеч.'),
('Тяга гантели в наклоне', 'back', 'dumbbell', 'Односторонняя, упор коленом и рукой. Локоть вдоль корпуса.'),
('Подъём штанги на бицепс', 'arms', 'barbell', 'Стоя, локти прижаты к корпусу. Без читинга.'),
('Молот с гантелями', 'arms', 'dumbbell', 'Нейтральный хват. Брахиалис и плечелучевая.'),
('Французский жим', 'arms', 'barbell', 'Лёжа. Опускаем штангу за голову, локти неподвижны.'),
('Разгибания на блоке', 'arms', 'cable', 'Изоляция трицепса. Локти прижаты.'),
('Жим ногами', 'legs', 'machine', 'Альтернатива приседу. Колени не сводим внутрь.'),
('Сгибания ног лёжа', 'legs', 'machine', 'Изоляция бицепса бедра.'),
('Румынская тяга', 'legs', 'barbell', 'На прямых ногах, штанга у бёдер. Тянем за счёт сгибания таза.'),
('Выпады', 'legs', 'dumbbell', 'Назад или вперёд, колено заднее почти касается пола.'),
('Болгарские сплит-приседания', 'legs', 'dumbbell', 'Задняя нога на скамье. Унилатеральная сила.'),
('Гиперэкстензия', 'back', 'bodyweight', 'Поясница и ягодицы. Можно с отягощением.'),
('Подъём на носки', 'legs', 'machine', 'Икры. Полная амплитуда, пауза вверху.'),
('Шраги со штангой', 'shoulders', 'barbell', 'Трапеции. Поднимаем плечи к ушам.'),
('Жим узким хватом', 'arms', 'barbell', 'Хват на ширине плеч. Акцент на трицепс.'),
('Скручивания на пресс', 'core', 'bodyweight', 'Лёжа, отрываем лопатки от пола, корпус скручивается.'),
('Планка', 'core', 'bodyweight', 'Удержание упора лёжа. Корпус прямой.'),
('Подъём ног в висе', 'core', 'bodyweight', 'Низ пресса. Из виса поднимаем ноги до угла 90° или выше.'),
('Тяга нижнего блока', 'back', 'cable', 'Сидя, тянем рукоятку к животу. Сводим лопатки.'),
('Тяга верхнего блока', 'back', 'cable', 'Альтернатива подтягиваниям для широчайших.'),
('Жим штанги на наклонной', 'chest', 'barbell', 'Верх груди. Угол 30-45°.');
