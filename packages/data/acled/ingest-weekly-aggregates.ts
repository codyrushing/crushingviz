#!/usr/bin/env bun

/**
Reads ACLED weekly aggregate .xlsx files downloaded by
download-weekly-aggregates.ts and ingests them into Postgres.

For each file listed in the download manifest:
- skips files whose filename is unchanged since the last successful data_job run
- parses the xlsx and upserts geographic areas and acled_weekly_agg rows in a
  single transaction per region, committed only if there were no errors
- records a data_job row for the region whether processing succeeded or failed

This process never talks to the ACLED website; it only reads files from disk.
**/

import * as XLSX from 'xlsx';
import { existsSync, readFileSync } from 'fs';
import assert from 'node:assert';
import { DisorderType, EventType, SubEventType, GeographicAreaType, GeographicArea } from '@crushingviz/types';
import { MANIFEST_PATH, type WeeklyAggManifest } from './shared';

// Environment variables
const POSTGRES_CONNECTION_STRING = process.env.POSTGRES_CONNECTION_STRING!;

if (!POSTGRES_CONNECTION_STRING) {
  throw new Error('POSTGRES_CONNECTION_STRING environment variable is required');
}

const sql = new Bun.SQL(POSTGRES_CONNECTION_STRING);

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

type Transaction = ReturnType<typeof sql.begin> extends Promise<infer T> ? T : never;

// Helper function to get or create geographic area
async function getOrCreateGeographicArea(
  tx: Transaction,
  name: string,
  type: GeographicAreaType,
  parentId?: number
): Promise<number> {
  const trimmedName = name.trim();

  // Try to find existing area
  let existing: GeographicArea[];
  if (parentId !== undefined) {
    existing = await tx`SELECT id FROM geographic_area WHERE name = ${trimmedName} AND type = ${type} AND parent = ${parentId} LIMIT 1`;
  } else {
    existing = await tx`SELECT id FROM geographic_area WHERE name = ${trimmedName} AND type = ${type} AND parent IS NULL LIMIT 1`;
  }

  if (existing[0]?.id) {
    return existing[0]?.id;
  }

  // Create new area
  const inserted: GeographicArea[] = await tx`
    INSERT INTO geographic_area (name, type, parent) VALUES (${trimmedName}, ${type}, ${parentId ?? null}) RETURNING id
  `;

  assert(inserted[0], `Inserting geographic area failed ${JSON.stringify({trimmedName, type, parentId})}`, )

  return inserted[0].id;
}

// Helper function to check if filename has changed
async function hasFilenameChanged(region: string, filename: string): Promise<boolean> {
  const rows: { meta: any }[] = await sql`
    SELECT meta FROM data_job
    WHERE type = 'acled_weekly_agg'
      AND source = ${region}
      AND status = 'successful'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    return true;
  }

  const lastFilename = rows[0]?.meta?.filename;
  return lastFilename !== filename;
}

// Ingest a single region's XLSX file
async function processRegionFile(region: string, filePath: string, filename: string): Promise<void> {
  const startTime = Date.now();
  let status = 'successful';
  let errorMessage: string | undefined;

  try {
    console.log(`  Ingesting ${filename}...`);

    // Parse XLSX file
    const fileBuffer = readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0] || "default";
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error(`Failed to find worksheet for sheetName ${sheetName}`);
    }
    const rows = XLSX.utils.sheet_to_json(worksheet);

    console.log(`  Found ${rows.length} rows`);

    await sql.begin(async (tx) => {
      // Get or create region geographic area
      const regionId = await getOrCreateGeographicArea(tx, region, 'region');

      // Cache for geographic areas to avoid duplicate lookups
      const countryCache = new Map<string, number>();
      const admin1Cache = new Map<string, number>();

      // Collect all data for batch insert
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

      // Process each row and collect data
      for (const row of rows as any[]) {
        try {
          // Parse data from row
          const weekStr = row['Week'] || row['week'] || row['DATE'] || row['date'];
          const countryName = (row['Country'] || row['country'] || '').trim();
          const admin1Name = (row['Admin1'] || row['admin1'] || row['Admin 1'] || '').trim();
          const disorderType = (row['Disorder Type'] || row['disorder_type'] || '').trim() as DisorderType;
          const eventType = (row['Event Type'] || row['event_type'] || '').trim() as EventType;
          const subEventType = (row['Sub Event Type'] || row['sub_event_type'] || '').trim() as SubEventType;
          const eventCount = parseInt(row['Events'] || row['events'] || row['event_count'] || '0');
          const fatalities = parseInt(row['Fatalities'] || row['fatalities'] || '0');
          const popExposure = parseInt(row['Population Exposure'] || row['population_exposure'] || '0');
          const longitude = parseFloat(row['Longitude'] || row['longitude'] || row['centroid_longitude'] || '0');
          const latitude = parseFloat(row['Latitude'] || row['latitude'] || row['centroid_latitude'] || '0');

          if (!weekStr) {
            console.warn('  Skipping row with no week data');
            continue;
          }

          const week = parseDate(weekStr);

          // Get or create country (with caching)
          let countryId: number | null = null;
          if (countryName) {
            if (countryCache.has(countryName)) {
              countryId = countryCache.get(countryName)!;
            } else {
              countryId = await getOrCreateGeographicArea(tx, countryName, 'country', regionId);
              countryCache.set(countryName, countryId);
            }
          }

          // Get or create admin1 (with caching)
          let admin1Id: number | null = null;
          if (admin1Name && countryId) {
            const cacheKey = `${countryId}:${admin1Name}`;
            if (admin1Cache.has(cacheKey)) {
              admin1Id = admin1Cache.get(cacheKey)!;
            } else {
              admin1Id = await getOrCreateGeographicArea(tx, admin1Name, 'admin_1', countryId);
              admin1Cache.set(cacheKey, admin1Id);
            }
          }

          aggregateData.push({
            week,
            region_id: regionId,
            country_id: countryId,
            admin1_id: admin1Id,
            disorder_type: disorderType,
            event_type: eventType,
            sub_event_type: subEventType,
            event_count: eventCount,
            fatalities,
            population_exposure: popExposure,
            centroid_longitude: longitude,
            centroid_latitude: latitude,
          });
        } catch (rowError) {
          console.error('  Error processing row:', rowError);
          throw rowError; // Re-throw to rollback transaction
        }
      }

      if (aggregateData.length > 0) {
        console.log(`  Upserting ${aggregateData.length} rows...`);
        await tx`
          INSERT INTO acled_weekly_agg (
            week, region_id, country_id, admin1_id, disorder_type, event_type, sub_event_type,
            event_count, fatalities, population_exposure, centroid_longitude, centroid_latitude
          ) SELECT * FROM json_to_recordset(${JSON.stringify(aggregateData)}::json) AS t(
            week timestamptz, region_id int, country_id int, admin1_id int,
            disorder_type text, event_type text, sub_event_type text, event_count int, fatalities int,
            population_exposure int, centroid_longitude float8, centroid_latitude float8
          )
          ON CONFLICT (week, region_id, country_id, admin1_id, disorder_type, event_type, sub_event_type) DO UPDATE SET
            event_count = EXCLUDED.event_count,
            fatalities = EXCLUDED.fatalities,
            population_exposure = EXCLUDED.population_exposure,
            centroid_longitude = EXCLUDED.centroid_longitude,
            centroid_latitude = EXCLUDED.centroid_latitude
        `;
      }

      console.log(`  Successfully processed ${rows.length} rows for ${region}`);
    });
  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing ${region}:`, error);
    throw error;
  } finally {
    // Record data job (outside transaction, even if processing failed)
    const duration = Date.now() - startTime;
    await sql`
      INSERT INTO data_job (source, status, duration, type, meta)
      VALUES (${region}, ${status}, ${duration}, 'acled_weekly_agg', ${JSON.stringify({ filename, error: errorMessage })}::jsonb)
    `;
  }
}

// Main function
async function main() {
  try {
    if (!existsSync(MANIFEST_PATH)) {
      throw new Error(`No download manifest at ${MANIFEST_PATH} — run download-weekly-aggregates.ts first`);
    }

    const manifest: WeeklyAggManifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

    if (!manifest.files.length) {
      console.log('Manifest contains no files, nothing to ingest');
      return;
    }

    console.log(`Ingesting ${manifest.files.length} file(s) from manifest`);

    for (const file of manifest.files) {
      try {
        console.log(`\nRegion: ${file.region}`);

        if (!await hasFilenameChanged(file.region, file.filename)) {
          console.log('  Filename unchanged since last successful run, skipping');
          continue;
        }

        await processRegionFile(file.region, file.path, file.filename);
      } catch (error) {
        console.error(`Failed to process region ${file.region}:`, error);
        // Continue with next region
      }
    }

    console.log('\nIngest completed!');
  } finally {
    await sql.end();
  }
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
