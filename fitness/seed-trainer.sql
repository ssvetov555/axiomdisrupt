-- Создание первого тренера. Замени имя и КОД на свои.
-- Хеш кода = SHA-256(код). Сгенерируй так (в терминале):
--   echo -n "ТВОЙ_КОД" | shasum -a 256
-- Возьми первое поле (64 hex символа) и подставь ниже.
--
-- Запуск:
--   wrangler d1 execute fitness-db --remote --file=./seed-trainer.sql

INSERT INTO users (role, name, access_code_hash)
VALUES (
  'trainer',
  'Имя Тренера',
  'ВСТАВЬ_СЮДА_SHA256_ХЕШ_КОДА'  -- 64 hex символа, без кавычек внутри
);
