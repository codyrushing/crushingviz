#!/usr/bin/env bun

/**
Reads ACLED weekly aggregate .xlsx files downloaded by
download-weekly-aggregates.ts and ingests them into Postgres.

Finds the latest `async_job` row of type `acled_weekly_agg_download` and, for
each file it lists:
- skips files that are missing on disk or whose filename is unchanged since
  the last successful ingest for that region
- parses and validates the xlsx before opening a transaction, so bad rows fail
  fast before touching the database
- replaces the region's acled_weekly_agg rows atomically (region-scoped DELETE
  followed by INSERT in a single transaction), so a failed ingest leaves the
  region's previous data intact and rows removed from the file are removed from
  the database — the xlsx files are the source of truth
- creates newly-encountered geographic_area rows in the same transaction
- records an async_job row for the region whether processing succeeded or failed

This process never talks to the ACLED website; it only reads files from disk.
**/

import * as XLSX from 'xlsx';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { PoolClient } from 'pg';
import { sql } from '@pgtyped/runtime';
import { DisorderType, EventType, SubEventType, GeographicAreaType } from '@crushingviz/types';
import { pool, type DownloadJobMeta, type IngestJobMeta } from '../db';
import { insertAsyncJob } from './queries.queries';
import type {
  IDeleteRegionWeeklyAggQuery,
  IFindGeographicAreaQuery,
  IGetLastSuccessfulIngestMetaQuery,
  IGetLatestDownloadJobQuery,
  IInsertGeographicAreaQuery,
  IInsertWeeklyAggQuery,
} from './ingest-weekly-aggregates.types';
import { DOWNLOADS_DIR } from './shared';

// Helper function to parse date from various formats
function parseDate(dateStr: string): Date {
  const trimmed = dateStr.trim();

  // Try parsing as-is
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Try common formats
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY or M/D/YYYY
    /^(\w+)\s+(\d{1,2})\s+(\d{4})$/, // Month DD YYYY
  ];

  for (const format of formats) {
    const match = trimmed.match(format);
    if (match) {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  throw new Error(`Unable to parse date: ${dateStr}`);
}

// Convert an Excel serial date (days since 1899-12-30) to a Date.
function excelSerialToDate(serial: number): Date {
  // 25569 = number of days between 1899-12-30 and 1970-01-01.
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

// Parse the WEEK value, which may be an Excel serial number or a date string.
function parseWeek(value: unknown): Date {
  if (typeof value === 'number') {
    return excelSerialToDate(value);
  }
  if (typeof value === 'string') {
    return parseDate(value);
  }
  throw new Error(`Unable to parse week: ${JSON.stringify(value)}`);
}

// Run `fn` inside a transaction, committing on success and rolling back on error.
async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const findGeographicArea = sql<IFindGeographicAreaQuery>`
  SELECT id FROM geographic_area
  WHERE name = $name!
    AND type = $type!
    AND parent IS NOT DISTINCT FROM $parent
  LIMIT 1
`;

const insertGeographicArea = sql<IInsertGeographicAreaQuery>`
  INSERT INTO geographic_area (name, type, parent)
  VALUES ($name!, $type!, $parent)
  RETURNING id
`;

// Helper function to get or create geographic area
async function getOrCreateGeographicArea(
  client: PoolClient,
  name: string,
  type: GeographicAreaType,
  parentId?: number
): Promise<number> {
  const trimmedName = name.trim();

  const existing = await findGeographicArea.run(
    { name: trimmedName, type, parent: parentId ?? null },
    client,
  );

  if (existing[0]?.id) {
    return existing[0].id;
  }

  const inserted = await insertGeographicArea.run(
    { name: trimmedName, type, parent: parentId ?? null },
    client,
  );

  const id = inserted[0]?.id;
  if (id === undefined) {
    throw new Error(`Inserting geographic area failed ${JSON.stringify({ trimmedName, type, parentId })}`);
  }
  return id;
}

const getLastSuccessfulIngestMeta = sql<IGetLastSuccessfulIngestMetaQuery>`
  SELECT meta FROM async_job
  WHERE type = 'acled_weekly_agg'
    AND source = $region!
    AND status = 'successful'
  ORDER BY created_at DESC
  LIMIT 1
`;

// Helper function to check if filename has changed
async function hasFilenameChanged(region: string, filename: string): Promise<boolean> {
  const rows = await getLastSuccessfulIngestMeta.run({ region }, pool);

  if (rows.length === 0) {
    return true;
  }

  const meta = rows[0]?.meta as IngestJobMeta | null;
  return meta?.filename !== filename;
}

// Deleting a region's whole slice makes the xlsx the source of truth: rows the
// file no longer contains are removed. Scoped to region_id so other regions'
// data is never in the blast radius of this file's ingest.
const deleteRegionWeeklyAgg = sql<IDeleteRegionWeeklyAggQuery>`
  DELETE FROM acled_weekly_agg
  WHERE region_id = $regionId!
`;

// Plain insert of the freshly-parsed file. With the region slice deleted first,
// nothing can conflict: the unique key includes region_id and duplicates inside
// the file's own rows were collapsed into one file row each by ACLED.
const insertWeeklyAgg = sql<IInsertWeeklyAggQuery>`
  INSERT INTO acled_weekly_agg (
    week, region_id, country_id, admin1_id, disorder_type, event_type, sub_event_type,
    event_count, fatalities, population_exposure, centroid_longitude, centroid_latitude
  ) SELECT * FROM json_to_recordset($data::json) AS t(
    week timestamptz, region_id int, country_id int, admin1_id int,
    disorder_type disorder_type, event_type event_type, sub_event_type sub_event_type,
    event_count int, fatalities int, population_exposure int,
    centroid_longitude float8, centroid_latitude float8
  )
`;

// Per-file ingest statistics, used to build the end-of-run report.
interface RegionIngestStats {
  rowsTotal: number;
  rowsInserted: number;
  rowsSkipped: number;
}

// A parsed aggregate row, before geographic-area resolution.
interface ParsedAggregateRow {
  week: Date;
  countryName: string;
  admin1Name: string;
  disorder_type: DisorderType;
  event_type: EventType;
  sub_event_type: SubEventType;
  event_count: number;
  fatalities: number;
  population_exposure: number;
  centroid_longitude: number;
  centroid_latitude: number;
}

// Parse an XLSX file into rows, validating every row. Runs outside the
// transaction, so a malformed row fails the run before the database is touched.
function parseRegionFile(filePath: string): {
  rows: ParsedAggregateRow[];
  rowsTotal: number;
  rowsSkipped: number;
} {
  const fileBuffer = readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0] || "default";
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Failed to find worksheet for sheetName ${sheetName}`);
  }
  const rawRows = XLSX.utils.sheet_to_json(worksheet);

  const rows: ParsedAggregateRow[] = [];
  let rowsSkipped = 0;

  for (const row of rawRows as any[]) {
    // Parse data from row (ACLED weekly aggregate columns are all-caps)
    const weekRaw = row['WEEK'];
    const countryName = (row['COUNTRY'] ?? '').toString().trim();
    const admin1Name = (row['ADMIN1'] ?? '').toString().trim();
    const disorderType = (row['DISORDER_TYPE'] ?? '').toString().trim() as DisorderType;
    const eventType = (row['EVENT_TYPE'] ?? '').toString().trim() as EventType;
    const subEventType = (row['SUB_EVENT_TYPE'] ?? '').toString().trim() as SubEventType;
    const eventCount = parseInt(row['EVENTS'] ?? '0');
    const fatalities = parseInt(row['FATALITIES'] ?? '0');
    const popExposure = parseInt(row['POPULATION_EXPOSURE'] ?? '0');
    const longitude = parseFloat(row['CENTROID_LONGITUDE'] ?? '0');
    const latitude = parseFloat(row['CENTROID_LATITUDE'] ?? '0');

    // Required columns: a row is only inserted if all of these are present.
    const required: Array<[string, unknown]> = [
      ['WEEK', weekRaw],
      ['COUNTRY', countryName],
      ['ADMIN1', admin1Name],
      ['DISORDER_TYPE', disorderType],
      ['EVENT_TYPE', eventType],
      ['POPULATION_EXPOSURE', popExposure],
    ];
    const missing = required
      .filter(([, v]) => v === undefined || v === null || v === '')
      .map(([k]) => k);
    if (missing.length > 0) {
      console.warn(`  Skipping row: missing required column(s) ${missing.join(', ')}`);
      rowsSkipped++;
      continue;
    }

    rows.push({
      week: parseWeek(weekRaw),
      countryName,
      admin1Name,
      disorder_type: disorderType,
      event_type: eventType,
      sub_event_type: subEventType,
      event_count: eventCount,
      fatalities,
      population_exposure: popExposure,
      centroid_longitude: longitude,
      centroid_latitude: latitude,
    });
  }

  return { rows, rowsTotal: rawRows.length, rowsSkipped };
}

// Ingest a single region's XLSX file, replacing that region's aggregate rows
// in the database with the file's contents.
async function processRegionFile(region: string, filePath: string, filename: string): Promise<RegionIngestStats> {
  const startTime = Date.now();
  let status = 'successful';
  let errorMessage: string | undefined;
  let rowsTotal = 0;
  let rowsInserted = 0;
  let rowsSkipped = 0;

  try {
    console.log(`  Ingesting ${filename}...`);

    // Phase 1: parse and validate. No database connection is held while the
    // file is parsed, and a bad row fails the run before anything is written.
    const { rows, rowsTotal: total, rowsSkipped: skipped } = parseRegionFile(filePath);
    rowsTotal = total;
    rowsSkipped = skipped;

    console.log(`  Found ${rowsTotal} rows (${skipped} skipped)`);

    // Phase 2: atomically replace this region's slice of acled_weekly_agg.
    // The DELETE + INSERT commit together: if anything fails, ROLLBACK leaves
    // the region's previous rows exactly as they were, and rows the file no
    // longer contains are gone once the transaction commits.
    await withTransaction(async (client) => {
      // Get or create region geographic area
      const regionId = await getOrCreateGeographicArea(client, region, 'region');

      // Cache for geographic areas to avoid duplicate lookups
      const countryCache = new Map<string, number>();
      const admin1Cache = new Map<string, number>();

      const aggregateData: Array<{
        week: Date;
        region_id: number;
        country_id: number | null;
        admin1_id: number | null;
        disorder_type: DisorderType;
        event_type: EventType;
        sub_event_type: SubEventType;
        event_count: number;
        fatalities: number;
        population_exposure: number;
        centroid_longitude: number;
        centroid_latitude: number;
      }> = [];

      for (const row of rows) {
        // Get or create country (with caching)
        let countryId: number | null = null;
        if (row.countryName) {
          if (countryCache.has(row.countryName)) {
            countryId = countryCache.get(row.countryName)!;
          } else {
            countryId = await getOrCreateGeographicArea(client, row.countryName, 'country', regionId);
            countryCache.set(row.countryName, countryId);
          }
        }

        // Get or create admin1 (with caching)
        let admin1Id: number | null = null;
        if (row.admin1Name && countryId) {
          const cacheKey = `${countryId}:${row.admin1Name}`;
          if (admin1Cache.has(cacheKey)) {
            admin1Id = admin1Cache.get(cacheKey)!;
          } else {
            admin1Id = await getOrCreateGeographicArea(client, row.admin1Name, 'admin_1', countryId);
            admin1Cache.set(cacheKey, admin1Id);
          }
        }

        aggregateData.push({
          week: row.week,
          region_id: regionId,
          country_id: countryId,
          admin1_id: admin1Id,
          disorder_type: row.disorder_type,
          event_type: row.event_type,
          sub_event_type: row.sub_event_type,
          event_count: row.event_count,
          fatalities: row.fatalities,
          population_exposure: row.population_exposure,
          centroid_longitude: row.centroid_longitude,
          centroid_latitude: row.centroid_latitude,
        });
      }

      if (aggregateData.length > 0) {
        console.log(`  Replacing region slice: deleting old rows, inserting ${aggregateData.length}...`);
        await deleteRegionWeeklyAgg.run({ regionId }, client);
        // Bulk insert via a single json_to_recordset parameter so a large
        // region's rows don't exceed Postgres' bind-parameter limit.
        await insertWeeklyAgg.run({ data: JSON.stringify(aggregateData) }, client);
      } else if (rowsTotal === 0) {
        // The file is genuinely empty, so the source of truth says the region
        // has no data; wipe the slice.
        console.log('  File has no rows, deleting region slice...');
        await deleteRegionWeeklyAgg.run({ regionId }, client);
      } else {
        // Every row failed validation. Leave the previous rows untouched so a
        // parse drift can't silently wipe a region; the report shows the rows
        // as skipped.
        console.warn('  All rows skipped by validation, leaving region slice unchanged');
      }

      console.log(`  Successfully processed ${rowsTotal} rows for ${region}`);
      rowsInserted = aggregateData.length;
    });

    return { rowsTotal, rowsInserted, rowsSkipped };
  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing ${region}:`, error);
    throw error;
  } finally {
    // Record data job (outside transaction, even if processing failed)
    const duration = Date.now() - startTime;
    await insertAsyncJob.run({
      source: region,
      status,
      duration,
      type: 'acled_weekly_agg',
      meta: { filename, error: errorMessage ?? null },
    }, pool);
  }
}

const getLatestDownloadJob = sql<IGetLatestDownloadJobQuery>`
  SELECT status, meta FROM async_job
  WHERE type = 'acled_weekly_agg_download'
  ORDER BY created_at DESC
  LIMIT 1
`;

type RegionReportStatus = 'processed' | 'failed' | 'missing' | 'unchanged';

interface RegionReport {
  region: string;
  filename: string;
  status: RegionReportStatus;
  rowsTotal: number;
  rowsInserted: number;
  rowsSkipped: number;
}

// Print a per-region summary of what this run did.
function printReport(reports: RegionReport[]): void {
  console.log('\n================ Ingest Report ================');

  const statusLabel: Record<RegionReportStatus, string> = {
    processed: 'processed',
    failed: 'failed',
    missing: 'missing on disk',
    unchanged: 'unchanged (skipped)',
  };

  for (const r of reports) {
    const line = [
      `- ${r.region} (${r.filename})`,
      `status: ${statusLabel[r.status]}`,
    ];
    if (r.status === 'processed') {
      line.push(
        `rows: ${r.rowsTotal} total, ${r.rowsInserted} inserted, ${r.rowsSkipped} skipped`,
      );
    }
    console.log(line.join(' | '));
  }

  const processed = reports.filter((r) => r.status === 'processed');
  const totals = processed.reduce(
    (acc, r) => ({
      rowsTotal: acc.rowsTotal + r.rowsTotal,
      rowsInserted: acc.rowsInserted + r.rowsInserted,
      rowsSkipped: acc.rowsSkipped + r.rowsSkipped,
    }),
    { rowsTotal: 0, rowsInserted: 0, rowsSkipped: 0 },
  );

  console.log('\nTotals:');
  console.log(`  files: ${reports.length} total, ${processed.length} processed, ${reports.length - processed.length} skipped/failed`);
  console.log(`  rows: ${totals.rowsTotal} total, ${totals.rowsInserted} inserted, ${totals.rowsSkipped} skipped`);
  console.log('===============================================\n');
}

// Main function
async function main() {
  const force = process.argv.includes('--force');
  try {
    // The download process records the files it saved; ingest reads the latest record
    const jobs = await getLatestDownloadJob.run(undefined, pool);

    if (!jobs.length) {
      throw new Error('No download job recorded yet — run download-weekly-aggregates.ts first');
    }

    const meta = jobs[0]?.meta as DownloadJobMeta | null;
    const files = meta?.files ?? [];

    if (!files.length) {
      console.log('Latest download job saved no files, nothing to ingest');
      return;
    }

    console.log(`Latest download job (status: ${jobs[0]?.status}) saved ${files.length} file(s)`);

    const reports: RegionReport[] = [];

    for (const { region, filename } of files) {
      try {
        console.log(`\nRegion: ${region} (${filename})`);

        const filePath = join(DOWNLOADS_DIR, filename);
        if (!existsSync(filePath)) {
          console.warn('  File missing from disk, skipping');
          reports.push({ region, filename, status: 'missing', rowsTotal: 0, rowsInserted: 0, rowsSkipped: 0 });
          continue;
        }

        if (!force && !await hasFilenameChanged(region, filename)) {
          console.log('  Filename unchanged since last successful run, skipping');
          reports.push({ region, filename, status: 'unchanged', rowsTotal: 0, rowsInserted: 0, rowsSkipped: 0 });
          continue;
        }

        const stats = await processRegionFile(region, filePath, filename);
        reports.push({ region, filename, status: 'processed', ...stats });
      } catch (error) {
        console.error(`Failed to process region ${region}:`, error);
        reports.push({ region, filename, status: 'failed', rowsTotal: 0, rowsInserted: 0, rowsSkipped: 0 });
        // Continue with next region
      }
    }

    printReport(reports);
  } finally {
    await pool.end();
  }
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
