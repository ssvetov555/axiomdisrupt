-- ============================================================
-- Миграция #3 — цели, профиль тренера, достижения.
-- ============================================================

-- Цели клиента: целевой вес/повторы в упражнении, либо вес тела к дате.
CREATE TABLE IF NOT EXISTS goals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('exercise_1rm','exercise_weight','body_weight','custom')),
  exercise_id  INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  target_value REAL,
  start_value  REAL,
  unit         TEXT,                     -- "кг", "см", "повторов"
  target_date  TEXT,                     -- YYYY-MM-DD
  achieved_at  TEXT,                     -- когда достигнута
  note         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_goals_client ON goals(client_id, achieved_at);

-- Профиль тренера: био, фото, контакты.
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- Достижения / бейджи — храним один раз получённые.
CREATE TABLE IF NOT EXISTS achievements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,            -- 'first_workout', 'streak_7', 'streak_30', 'sessions_50', 'sessions_100', 'first_pr', 'first_goal'
  awarded_at   TEXT NOT NULL DEFAULT (datetime('now')),
  meta         TEXT,
  UNIQUE (client_id, code)
);

-- Активность тренировки — длительность сессии. (Опционально, не блокирующая.)
ALTER TABLE workout_logs ADD COLUMN duration_seconds INTEGER;
