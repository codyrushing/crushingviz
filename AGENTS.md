Always use Bun by default (`bun run`, `bun install`, `bunx`, etc).

## Monorepo

```
packages/api/    — Go service (module: crushingviz.info/api)
packages/data/   — Bun scripts that fetch/ingest external data into Postgres
packages/types/  — Shared TS types (@crushingviz/types)
packages/web/    — Astro site (⚠ uses npm internally, has its own package-lock.json)
```

Root `go.work` includes `./packages/api`.

## Development

`./dev <db|api|web|all>` is the dev entrypoint:
- `./dev db` — start Postgres via Docker Compose + run migrations
- `./dev all` — db, api, and web concurrently
- `./dev api` — `go run main.go` in packages/api
- `./dev web` — `npm run dev` (Astro dev server)

## Type generation (tygo)

`npm run types:generate` — runs `tygo generate` in `packages/api` → outputs `packages/types/acled.ts`.

This must run before building the web app (`npm run build` and `npm run dev:web` auto-run it).

## Database

- Postgres 18 via Docker Compose (`compose.yml`).
- Required env vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (forms `POSTGRES_CONNECTION_STRING`).
- Migrations: `packages/api/migrate/migrations/` (numbered SQL files). Run via `./dev db` or `cd packages/api/migrate && go run . up`.
- Schema source of truth: `crushingviz.dbml`.

## Data scripts

Use `./run_with_env <command>` to load .env (dotenvx) before running data scripts:
```
./run_with_env bun packages/data/acled/fetch-weekly-aggregates.ts
```

## Quirks

- `packages/web` uses npm, not bun. Do not `bun install` there.
- `packages/web` is NOT in root npm workspaces (it has its own `package-lock.json`). Run `npm install` inside `packages/web/`, never from root.
- `Bun.SQL()` is used for Postgres in data scripts (not the `pg` npm package).
- No tests, lint, or typecheck scripts configured yet.
