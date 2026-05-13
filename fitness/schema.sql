-- ============================================================
-- Fitness Trainer App — D1 schema
-- Запускается через: wrangler d1 execute fitness-db --file=./schema.sql
-- ============================================================

DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS workout_logs;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS exercises;
DROP TABLE IF EXISTS programs;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- Пользователи: тренер и его клиенты.
-- access_code хранится в виде SHA-256 хеша (см. functions/_lib.js).
CREATE TABLE users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  role            TEXT    NOT NULL CHECK (role IN ('trainer','client')),
  name            TEXT    NOT NULL,
  access_code_hash TEXT   NOT NULL UNIQUE,
  trainer_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_trainer ON users(trainer_id);

-- Серверные сессии (cookie -> user_id).
CREATE TABLE sessions (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT    NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Программы тренировок — шаблоны, которые создаёт тренер.
CREATE TABLE programs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trainer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  description   TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_programs_trainer ON programs(trainer_id);

-- Упражнения внутри программы.
-- day_of_week: 1..7 (понедельник..воскресенье), либо NULL если упражнение не привязано к дню.
CREATE TABLE exercises (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id    INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  description   TEXT,
  video_url     TEXT,
  target_sets   INTEGER,
  target_reps   TEXT,            -- может быть "8-12" или "до отказа"
  target_weight TEXT,            -- "60 кг" или "своим весом"
  rest_seconds  INTEGER,
  day_of_week   INTEGER,         -- 1..7
  order_index   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_exercises_program ON exercises(program_id);
CREATE INDEX idx_exercises_day ON exercises(program_id, day_of_week, order_index);

-- Назначение программы клиенту. Один клиент может иметь несколько активных назначений.
CREATE TABLE assignments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id   INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  client_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date   TEXT    NOT NULL DEFAULT (date('now')),
  end_date     TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_assignments_client ON assignments(client_id, is_active);
CREATE INDEX idx_assignments_program ON assignments(program_id);

-- Журнал выполнения: одна строка на каждый выполненный сет / упражнение.
CREATE TABLE workout_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id   INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  client_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id     INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  log_date        TEXT    NOT NULL DEFAULT (date('now')),
  done_sets       INTEGER,
  done_reps       TEXT,
  done_weight     REAL,
  client_note     TEXT,
  completed       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_logs_client_date ON workout_logs(client_id, log_date);
CREATE INDEX idx_logs_exercise ON workout_logs(exercise_id, log_date);

-- Комментарии: между тренером и клиентом по конкретному упражнению.
CREATE TABLE comments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id   INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  client_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body          TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_comments_thread ON comments(exercise_id, client_id, created_at);
