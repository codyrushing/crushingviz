#!/usr/bin/env bun

/**
 * Database migration tool.
 *
 * Usage:
 *   bun packages/data/migrate.ts [dir MIGRATIONS_DIR] [up|down|up-to VERSION|down-to VERSION|status]
 *
 * Migrations live in ./migrations by default and follow the naming pattern:
 *   {version}_{description}_up.sql
 *   {version}_{description}_down.sql
 *
 * Applied versions are tracked in the `schema_migrations` table. Each
 * migration is applied (or reverted) in its own transaction, so a failure
 * only blocks that migration and any after it.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Migration {
  version: number;
  description: string;
  upSql: string;
  downSql: string;
}

function usage(): never {
  console.log(
    'Usage: bun packages/data/migrate.ts [dir MIGRATIONS_DIR] [up|down|up-to VERSION|down-to VERSION|status]',
  );
  process.exit(1);
}

// Connection string from POSTGRES_CONNECTION_STRING, or built from the
// individual POSTGRES_* vars that ./dev checks for, so `./dev db` works
// without loading .env.
function connectionString(): string {
  const connStr = process.env.POSTGRES_CONNECTION_STRING;
  if (connStr) return connStr;

  const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } = process.env;
  if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
    throw new Error(
      'Set POSTGRES_CONNECTION_STRING or POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB',
    );
  }
  return `postgres://${encodeURIComponent(POSTGRES_USER)}:${encodeURIComponent(POSTGRES_PASSWORD)}@localhost:5432/${POSTGRES_DB}`;
}

const sql = new Bun.SQL(connectionString());

// Load migrations from SQL files in a directory.
function loadMigrations(dirPath: string): Migration[] {
  const ups = new Map<number, string>();
  const downs = new Map<number, string>();
  const descriptions = new Map<number, string>();

  console.log(`Traversing ${dirPath} directory\n`);

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.sql')) continue;
    const fileName = entry.name;
    const parts = fileName.split('_');
    if (parts.length < 3) {
      throw new Error(`invalid migration filename format: ${fileName}`);
    }

    const version = Number.parseInt(parts[0]!, 10);
    if (Number.isNaN(version) || version < 1) {
      throw new Error(`invalid version number in migration: ${fileName}`);
    }

    const lastPart = parts[parts.length - 1]!;
    const isUp = lastPart.endsWith('up.sql');
    const isDown = lastPart.endsWith('down.sql');
    if (!isUp && !isDown) {
      throw new Error(`migration file must end with up.sql or down.sql: ${fileName}`);
    }
    if ((isUp && ups.has(version)) || (isDown && downs.has(version))) {
      throw new Error(`duplicate migration version ${version}`);
    }

    const description = parts.slice(1, -1).join('_');
    const content = readFileSync(join(dirPath, fileName), 'utf8');

    if (isUp) {
      ups.set(version, content);
      descriptions.set(version, description);
    } else {
      downs.set(version, content);
    }
  }

  const migrations: Migration[] = [];
  for (const [version, upSql] of ups) {
    migrations.push({
      version,
      description: descriptions.get(version)!,
      upSql,
      downSql: downs.get(version) ?? '',
    });
  }

  migrations.sort((a, b) => a.version - b.version);
  return migrations;
}

// Create the migrations table if it doesn't exist.
async function initialize(): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INT PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;
}

// Current database schema version.
async function getCurrentVersion(): Promise<number> {
  const rows = (await sql`SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations`) as Array<{
    version: number;
  }>;
  return rows[0]!.version;
}

// Migrate the database up to a specific version.
async function upToVersion(migrations: Migration[], targetVersion: number): Promise<void> {
  if (migrations.length === 0) throw new Error('no migrations loaded');

  await initialize();
  const currentVersion = await getCurrentVersion();

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
    if (migration.version > targetVersion) break;

    // Each migration runs in its own transaction.
    await sql.begin(async (tx) => {
      await tx.unsafe(migration.upSql);
      await tx`INSERT INTO schema_migrations (version, description, applied_at)
        VALUES (${migration.version}, ${migration.description}, NOW())`;
    });

    console.log(`Applied migration ${migration.version}: ${migration.description}`);
  }
}

// Migrate the database to the latest version.
async function upAll(migrations: Migration[]): Promise<void> {
  if (migrations.length === 0) throw new Error('no migrations loaded');

  const highestVersion = migrations[migrations.length - 1]!.version;
  await upToVersion(migrations, highestVersion);
}

// Migrate the database down to a specific version.
async function downToVersion(migrations: Migration[], targetVersion: number): Promise<void> {
  if (migrations.length === 0) throw new Error('no migrations loaded');

  await initialize();
  const currentVersion = await getCurrentVersion();
  if (currentVersion <= targetVersion) return;

  const migrationsMap = new Map(migrations.map((m) => [m.version, m]));
  const applied = (await sql`SELECT version, description FROM schema_migrations
    WHERE version > ${targetVersion}
    ORDER BY version DESC`) as Array<{ version: number; description: string }>;

  // Revert in descending order, each migration in its own transaction.
  for (const row of applied) {
    const migration = migrationsMap.get(row.version);
    if (!migration) {
      throw new Error(`cannot find down migration for version ${row.version}`);
    }
    if (migration.downSql === '') {
      throw new Error(`down migration SQL is empty for version ${migration.version}`);
    }

    await sql.begin(async (tx) => {
      await tx.unsafe(migration.downSql);
      await tx`DELETE FROM schema_migrations WHERE version = ${migration.version}`;
    });

    console.log(`Reverted migration ${migration.version}: ${migration.description}`);
  }
}

// Revert the most recent migration.
async function down(migrations: Migration[]): Promise<void> {
  await initialize();
  const currentVersion = await getCurrentVersion();
  if (currentVersion === 0) return;

  await downToVersion(migrations, currentVersion - 1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Optional `dir MIGRATIONS_DIR` prefix argument. Defaults to ./migrations
  // relative to this file so the tool works from any CWD.
  let migrationsDir = join(import.meta.dir, 'migrations');
  if (args[0] === 'dir') {
    if (args.length < 2) usage();
    migrationsDir = args[1]!;
    args.splice(0, 2);
  }

  if (args.length < 1) usage();
  const command = args[0]!;
  const migrations = loadMigrations(migrationsDir);

  switch (command) {
    case 'up':
      await upAll(migrations);
      break;
    case 'down':
      await down(migrations);
      break;
    case 'up-to':
    case 'down-to': {
      const version = Number.parseInt(args[1] ?? '', 10);
      if (Number.isNaN(version)) {
        console.log(`Invalid version number: ${args[1] ?? '(missing)'}`);
        process.exit(1);
      }
      if (command === 'up-to') {
        await upToVersion(migrations, version);
      } else {
        await downToVersion(migrations, version);
      }
      break;
    }
    case 'status': {
      await initialize();
      const currentVersion = await getCurrentVersion();
      console.log(`Current database version: ${currentVersion}`);
      break;
    }
    default:
      console.log('Unknown command');
      process.exit(1);
  }

  if (command === 'up' || command === 'down' || command === 'up-to' || command === 'down-to') {
    console.log('Migration completed successfully');
  }
}

try {
  await main();
} catch (err) {
  console.error(`Migration failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
