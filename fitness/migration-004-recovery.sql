-- ============================================================
-- Миграция #4 — чек-ин восстановления, закреплённые заметки, кэш достижений.
-- ============================================================

-- Ежедневный чек-ин самочувствия. Одна запись на (клиент, дата).
CREATE TABLE IF NOT EXISTS recovery_logs (
  client_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date     TEXT NOT NULL,
  sleep_hours  REAL,
  energy       INTEGER,   -- 1..5
  soreness     INTEGER,   -- 1..5 (5 — очень болит)
  mood         INTEGER,   -- 1..5
  note         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (client_id, log_date)
);

-- Закреплённая заметка тренера про клиента (видна всегда сверху профиля).
ALTER TABLE users ADD COLUMN pinned_note TEXT;

-- Кэш достижений — храним назначенные награды.
-- (Если таблица уже создана в #3 — этот блок мирно проигнорируется.)
CREATE TABLE IF NOT EXISTS achievements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  awarded_at   TEXT NOT NULL DEFAULT (datetime('now')),
  meta         TEXT,
  UNIQUE (client_id, code)
);
