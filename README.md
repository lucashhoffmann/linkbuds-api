# linkbuds-api

Generic NestJS API inspired by the structure of `gest`, keeping only the
essential `auth`, `company`, and `user` modules.

## Requirements

- Node.js 22+
- pnpm 11+
- PostgreSQL

## Setup

```bash
pnpm install
cp .env.example .env
pnpm migration:run
pnpm dev
```

## Scripts

- `pnpm dev` starts the API in watch mode.
- `pnpm build` builds the project.
- `pnpm typecheck` validates TypeScript.
- `pnpm test` runs unit tests.
- `pnpm migration:run` applies TypeORM migrations.
- `pnpm migration:run:prod` applies migrations from `dist`.

## Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/session`
- `GET /companies`
- `POST /companies`
- `GET /companies/:id`
- `PUT /companies/:id`
- `DELETE /companies/:id`
- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PUT /users/:id`
- `DELETE /users/:id`
