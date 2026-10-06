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

- `POST /auth/register` — cria credencial (better-auth) + empresa + usuário
- `GET /auth/session`
- `/api/auth/*` — better-auth (`sign-in/email`, `sign-out`, `get-session`, social)
- `/company/domain` — domínio customizado da conta
- `/link-pages` — páginas (bio e posts `/:id/posts`), links, redes, imagens, analytics (escopo da conta)
- `/public/link-pages` — página pública (`:slug`, `:slug/:postSlug`, `_home` do domínio), eventos, presença, sitemap
- `GET /pricing-plans`
- `/billing` — plano, assinatura, checkout (`Idempotency-Key`), cancelamento, cupons; `/billing/webhooks/:provider` (guia: `../docs/monetizacao.md`)
- `/team`, `/invites` — equipe e convites por link (guia: `../docs/equipe.md`)
- `/admin/*` — API interna (header `x-admin-key` = `ADMIN_API_KEY`): criar/alterar planos (limites, preços), busca de empresas, condições especiais. Guia: `../docs/admin-condicoes.md`

Contas criadas por qualquer caminho (cadastro, Google, `/api/auth/sign-up/email`)
recebem empresa no plano FREE no primeiro acesso autenticado.
Schema só via migrations (`pnpm migration:run` ou `TYPEORM_MIGRATIONS_RUN=true`).

## Erros

Catálogo único em `src/shared/errors/error-catalog.ts`; lance `AppException(ERROR_CODES.X)`. Guia: `../docs/erros.md`.
