# @crushingviz/data

This package is responsible for fetching, transforming, and ultimately ingesting data into the database.  It will be structured as multiple sub-packages or scripts to ingest data from different sources (eg. ACLED weekly fetch)

## Migrations

Schema migrations are SQL files in `migrations/`, following the naming pattern `{version}_{description}.up.sql` / `{version}_{description}.down.sql`. Each migration is applied in its own transaction; applied versions are tracked in the `schema_migrations` table.

These files are the source of truth for the database schema — `sqlc` in `packages/api` parses them (ignoring the `.down.sql` files) to generate Go types. Add a migration rather than editing an already-applied one.

```bash
# apply all pending migrations (also done by ./dev db)
bun migrate.ts up

# revert the most recent migration
bun migrate.ts down

# migrate to a specific version
bun migrate.ts up-to 3
bun migrate.ts down-to 1

# show current schema version
bun migrate.ts status
```

Bun loads `.env` from the working directory automatically, so running from the repo root just works — no env wrapper needed.
