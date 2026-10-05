Always use Bun by default (`bun run`, `bun install`, `bunx`, etc).

## Monorepo

```
packages/api/    — Go service (module: crushingviz.info/api)
packages/data/   — Bun scripts that fetch/ingest external data into Postgres
packages/types/  — Shared TS types (@crushingviz/types)
packages/web/    — Astro site (own bun.lock, not in root workspaces)
```

Root `go.work` includes `./packages/api`.

## Development

`./dev <db|api|web|all>` is the dev entrypoint:
- `./dev db` — start Postgres via Docker Compose + run migrations
- `./dev all` — db, api, and web concurrently
- `./dev api` — `go run main.go` in packages/api
- `./dev web` — `bun run dev` (Astro dev server)

## Type generation (tygo)

`bun run types:generate` — runs `tygo generate` in `packages/api` → outputs `packages/types/acled.ts`.

This must run before building the web app (`bun run build` and `bun run dev:web` auto-run it).

## Dependencies

Use `bun` to install dependencies in packages. Do not use npm.

## Database

- Postgres 18 via Docker Compose (`compose.yml`).
- Required env vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (forms `POSTGRES_CONNECTION_STRING`).
- Migrations: `packages/api/migrate/migrations/` (numbered SQL files). Run via `./dev db` or `cd packages/api/migrate && go run . up`.
- Schema source of truth: `crushingviz.dbml`.

## Environment variables

`.env` is loaded automatically by [direnv](https://direnv.net/) via `.envrc` at the repo root. Run `direnv allow` once after cloning. Variables are then available to every command (`bun`, `go`, `psql`, `./dev`) with no wrapper:
```
bun packages/data/acled/download-weekly-aggregates.ts
```

## ACLED data pipeline (`packages/data/acled/`)

Split into two processes coordinated through the `async_job` table (`downloads/` and `.acled-auth.json` are gitignored; only the latest file per region is kept on disk):
- `download-weekly-aggregates.ts` — Playwright browser: reuses the saved session in `.acled-auth.json`, only runs the credential login when it's missing/expired, downloads each region's `.xlsx` into `downloads/`, then records the saved files in an `async_job` row with type `acled_weekly_agg_download`
- `ingest-weekly-aggregates.ts` — reads the latest `acled_weekly_agg_download` job, skips unchanged filenames (compared against successful `acled_weekly_agg` ingest jobs), ingests into Postgres. Never touches the network.


## Quirks

- `packages/web` is NOT in root bun workspaces (it has its own `bun.lock`). Run `bun install` inside `packages/web/`, never from root.
- `Bun.SQL()` is used for Postgres in data scripts (not the `pg` npm package).
- No tests, lint, or typecheck scripts configured yet.

## Coding conventions

- When writing sufficiently complex code, it is helpful to add a brief comment explaining its purpose. Not every change requires a comment.

## `AGENTS.md`

Update this file when there are any changes or additions to any of the conventions defined here.
