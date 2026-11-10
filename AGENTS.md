# AGENTS.md

Always use Bun (`bun run`, `bun install`, `bunx`) — never npm.

## Monorepo

- `packages/api/` — Go service (module `crushingviz.info/api`); source of truth for API types.
- `packages/data/` — Node-compatible scripts (run with Bun) that fetch/ingest data into Postgres.
- `packages/types/` — shared TS types (`@crushingviz/types`), generated from Go via tygo.
- `packages/web/` — Astro site. NOT in root bun workspaces (own `bun.lock`); run `bun install` inside it.

Root `go.work` includes `./packages/api`.

## Commands

- `./dev <db|api|web|all>` — dev entrypoint. `db` starts Postgres (Docker Compose) + runs migrations; `all` runs db+api+web.
- `bun run types:generate` — tygo: Go types → `packages/types/acled.ts`. Must run before `bun run build` / `bun run dev:web` (they auto-run it). Requires tygo installed (`go install github.com/gzuidhof/tygo@latest`).
- `bun run queries:generate` (in `packages/data`) — pgtyped: regenerate `queries.queries.ts` + `*.types.ts` from SQL.
- Migrations: `bun packages/data/migrate.ts up` (or `down`). Custom TS migrator, not a standard tool.

## Environment

- `.env` is gitignored; pull it from the committed `.env.vault` with `bun run secrets:pull` (dotenv-vault). direnv loads `.env` via `.envrc` — run `direnv allow` once.
- Required vars: `POSTGRES_CONNECTION_STRING` (scripts + migrator), `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` (Docker Compose), `ACLED_EMAIL` + `ACLED_PASSWORD` (or `ACLED_KEY`) (download script).

## Database

- Postgres 18 via Docker Compose (`compose.yml`).
- Required env vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (forms `POSTGRES_CONNECTION_STRING`).
- Migrations: `packages/data/migrations/` (numbered SQL files). Run via `./dev db` or `bun packages/data/migrate.ts up|down`.
- Schema source of truth: `crushingviz.dbml`.

## Data scripts

Bun automatically loads `.env` from the working directory, so no env loading wrapper is needed:
```
bun packages/data/acled/download-weekly-aggregates.ts
bun packages/data/acled/ingest-weekly-aggregates.ts
```

## Coding conventions

- When writing sufficiently complex code, it is helpful to add a brief comment explaining its purpose. Not every change requires a comment.
- Schema source of truth: `crushingviz.dbml` (dbdiagram.io). Migrations in `packages/data/migrations/` (numbered SQL).
- Data scripts use `pg` (node-postgres) + pgtyped for type-safe raw SQL. Shared queries in `packages/data/acled/queries.sql` (`:param` syntax); single-use queries inline as `sql` tagged templates (`$param` syntax). `packages/data/db.ts` registers `pg.types.setTypeParser(3802, JSON.parse)` so jsonb parses to objects (pg returns it as a string by default).

## ACLED pipeline (`packages/data/acled/`)

Two processes coordinated via the `async_job` table:
- `download-weekly-aggregates.ts` — Playwright browser; reuses `.acled-auth.json` session, downloads region `.xlsx` into `downloads/`, records an `acled_weekly_agg_download` job.
- `ingest-weekly-aggregates.ts` — reads the latest download job, skips unchanged filenames, ingests into Postgres. No network.

`downloads/` and `.acled-auth.json` are gitignored.

## Quirks

- Data scripts target the Node runtime (Neon Functions / AWS Lambda), so they use `pg` + pgtyped, not `Bun.SQL`. Bun still runs them locally.
- No tests, lint, or typecheck scripts configured.
- `packages/data/pacific-dataviz-challenge-2026/` is a separate committed project (own AGENTS.md); its JSX files break `tsc --noEmit` in `packages/data` (no React installed there).
- Do not write to or modify files named `human.{ext}` (eg. `human.md`). These are intended to be documentation maintained by humans only. You may read these files and reply to the user about them, but do not make any changes to these files.
