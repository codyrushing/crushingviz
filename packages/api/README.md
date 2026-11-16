## Development

#### Package layout

- `main.go` — wiring: env, connection pool, router, graceful shutdown.
- `sql/queries/` — hand-written SQL. Flat directory (sqlc does not recurse).
- `db/` — **generated** by sqlc. Do not edit; regenerate with `bun run sql:generate`.
- `handlers/` — HTTP handlers.
- `types/acled/` — domain/wire types. `tygo` turns these into `packages/types/acled.ts`.

#### Code generation

The schema is the migration set in `packages/data/migrations/` — `sqlc.yaml` points at that directory, so there is no second copy of the schema to keep in sync. Migrations use the `{version}_{description}.up.sql` / `.down.sql` naming so sqlc ignores the down files.

```bash
# after editing SQL in sql/queries/ (requires: go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest)
bun run sql:generate

# verify db/ is up to date
bun run sql:check
```

Generated structs use the enum types from `types/acled` (see `overrides` in `sqlc.yaml`), so rows can be mapped straight to the API's domain types.

#### Run migrations
Migrations live in `packages/data`. See that package's README.
```bash
bun packages/data/migrate.ts up;
```

#### Reverse migrations
```bash
bun packages/data/migrate.ts down;
```

## Environment

`POSTGRES_CONNECTION_STRING` (from `.env`, loaded by direnv) and `API_PORT` are required.
