# Fitness — приложение тренера и клиентов

Одна ссылка для всех. Вход по коду доступа — приложение само определяет роль:
- **Тренер** — управляет программами, клиентами, видит прогресс и пишет комментарии.
- **Клиент** — видит свою программу на сегодня/неделю, отмечает выполнение, ведёт историю.

Стек: **Cloudflare Pages + Pages Functions + D1** (SQLite, бесплатный тариф).

---

## Структура

```
fitness/
├── public/              # фронтенд (HTML + JS + CSS, без билда)
├── functions/           # Pages Functions (API)
│   └── api/...
├── schema.sql           # таблицы D1
├── seed-trainer.sql     # пример создания первого тренера
├── wrangler.toml        # конфиг для wrangler CLI
└── package.json
```

---

## Первый деплой (одноразово)

В дашборде Cloudflare:

1. **Workers & Pages → Create → Pages → Connect to Git.**
2. Репозиторий: `ssvetov555/axiomdisrupt`.
3. Настройки сборки:
   - **Project name:** `fitness` (станет `fitness.pages.dev`)
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** *(пусто)*
   - **Root directory (advanced):** `fitness`
   - **Build output directory:** `public`
4. Save and Deploy.

После первого билда — **нужно создать базу D1 и привязать**, иначе API будет падать.

### Создать D1 базу

Через CLI (на компьютере с node + wrangler):
```bash
npm i -g wrangler
wrangler login                       # OAuth в браузере, один раз
wrangler d1 create fitness-db        # запомни database_id из вывода
```

### Привязать D1 к Pages-проекту

В дашборде: **Pages → fitness → Settings → Functions → D1 database bindings → Add binding.**
- Variable name: **`DB`**
- D1 database: **`fitness-db`**
- Apply to: **Production** (и Preview, если нужен)

После привязки **сделай один пустой commit** (или нажми Retry deployment) — иначе binding не применится:
```bash
git commit --allow-empty -m "rebuild after D1 binding" && git push
```

### Накатить миграции

```bash
# из корня репо
cd fitness
wrangler d1 execute fitness-db --remote --file=./schema.sql
```

### Создать первого тренера

```bash
# 1. Сгенерируй SHA-256 хеш кода доступа тренера
echo -n "ВЫБРАННЫЙ_КОД" | shasum -a 256
# Получишь: c3d2... (64 hex символа)

# 2. Подставь хеш и имя в seed-trainer.sql, потом:
wrangler d1 execute fitness-db --remote --file=./seed-trainer.sql
```

Готово. Открываешь `https://fitness.pages.dev`, вводишь код тренера, попадаешь в кабинет, добавляешь клиентов.

---

## Как тренер выдаёт клиенту доступ

В кабинете тренера → **Клиенты → + Клиент** → имя + код доступа (придумать любой ≥4 символов) → клиент входит на ту же страницу с этим кодом.

Каждый код хранится в виде SHA-256 хеша. Сам код в базе не лежит.

---

## API (для справки)

| Метод | Путь | Кто | Что делает |
|---|---|---|---|
| POST | `/api/login` | все | вход по коду |
| POST | `/api/logout` | все | выход |
| GET | `/api/me` | все | текущий пользователь |
| GET/POST | `/api/clients` | тренер | список / создание |
| PUT/DELETE | `/api/clients/:id` | тренер | редактирование / удаление |
| GET | `/api/clients/:id/summary` | тренер | сводка по клиенту |
| GET/POST | `/api/programs` | тренер | список / создание |
| GET | `/api/programs/:id` | оба | программа + упражнения |
| PUT/DELETE | `/api/programs/:id` | тренер | редактирование / удаление |
| POST | `/api/programs/:id/exercises` | тренер | добавить упражнение |
| PUT/DELETE | `/api/exercises/:id` | тренер | редактировать / удалить упражнение |
| GET/POST | `/api/assignments` | оба | назначение программы клиенту |
| PATCH/DELETE | `/api/assignments/:id` | тренер | пауза / удаление |
| GET | `/api/today` | клиент | программа на сегодня |
| GET/POST | `/api/workouts` | оба | журнал выполнения |
| GET | `/api/progress` | оба | история по упражнению |
| GET/POST | `/api/comments` | оба | чат под упражнением |

---

## Локальная разработка

```bash
cd fitness
npm i
wrangler d1 execute fitness-db --local --file=./schema.sql
npm run dev          # http://localhost:8788
```

В режиме `--local` база живёт в `.wrangler/state/v3/d1/`. Не публикуется.

---

## Что можно добавить позже

- Push-уведомления о новых программах (через web-push).
- Импорт упражнений из CSV/JSON (есть API под капотом — нужен только UI).
- Экспорт PDF недельного плана.
- Двухфакторная авторизация для тренера.
- Хранение видео в Cloudflare R2.
