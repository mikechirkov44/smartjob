# SmartJob

Платформа опросов вовлечённости: React + NestJS + PostgreSQL.

## Возможности

- Мультитенантность: компании создаёт супер-админ
- Роли: OWNER / ADMIN / HR / VIEWER
- Опросы: шаблоны Full / Pulse и свой конструктор
- Публичные ссылки и QR-коды
- Персональные ссылки: для сотрудника анонимно, админ видит личность при включённой опции
- Аналитика: eNPS, отделы, слабые вопросы, динамика
- Мобильное прохождение опроса (responsive)

## Быстрый старт (локально)

```bash
# 1. Поднять Postgres (Docker)
docker compose up -d db

# 2. Установить зависимости
npm install

# 3. Миграции и сид супер-админа
cp .env.example .env
cd apps/api
npx prisma migrate dev --name init
npm run seed
cd ../..

# 4. Запуск
npm run dev:api
npm run dev:web
```

- Web: http://localhost:5173
- API: http://localhost:3000/api
- Логин супер-админа: из `.env` (`admin@smartjob.local` / `ChangeMe123!`)

## Продакшен на VPS

```bash
cp .env.example .env
# заполните JWT_SECRET, пароли, PUBLIC_WEB_URL=https://your-domain

docker compose up -d --build
# UI: http://VPS:8080
```

После первого старта создайте супер-админа:

```bash
docker compose exec api sh -c "npx prisma db seed"
```

Добавьте в `apps/api/package.json` при необходимости:

```json
"prisma": { "seed": "ts-node --transpile-only prisma/seed.ts" }
```

Или выполните seed локально против production DATABASE_URL.

## Прототип

Старый HTML-прототип сохранён в `prototype/`.
