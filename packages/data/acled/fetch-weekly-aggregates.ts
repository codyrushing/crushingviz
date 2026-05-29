#!/usr/bin/env bun

/**
This script fetches the ACLED weekly aggregates.

This data is available as static .xslx files per region which are updated weekly. Use playwright to navigate to the ACLED website, login with email and password, and download those files

Here is a list of operations this script should complete:

- login with email/password at https://acleddata.com/
- navigate to https://acleddata.com/conflict-data/download-data-files
- for each of the links titled "Aggregated data on [region]"
  - click the link to open the region aggregate page
  - if the filename has not changed since the last successful data_job run for this region, continue
  - download the .xlsx file
  - parse the contents of the file
  - for each row (aggregate) in the file
    - insert a new row in the acled_weekly_agg postgres table
    - insert a new geographic area for the region, country, and admin_1 values for the aggregate if they don't already exist
  - after processing all rows, delete any preexisting acled_weekly_agg rows for this region
  - save a new data_job row for this region. the `status` should only be successful if there were no errors. the filename can be saved to the `meta` jsonb column so that it can be queried by future runs

Other notes:
* All database operations for each region and associated .xlsx file should be done as part of a transaction. The transaction should only be committed if there were no errors
* Trim whitespace from all strings before inserting into the database
* The `week` row of each item in the xlsx file may appear in different formats (eg. "11/19/2022", "Nov 19 2022", "2022-11-19", etc).
**/

import { chromium, type Browser, type Page } from 'playwright';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DisorderType, EventType, SubEventType, GeographicAreaType, GeographicArea } from '@crushingviz/types'

// Environment variables
const ACLED_EMAIL = process.env.ACLED_EMAIL!;
const ACLED_PASSWORD = process.env.ACLED_PASSWORD || process.env.ACLED_KEY!;
const POSTGRES_CONNECTION_STRING = process.env.POSTGRES_CONNECTION_STRING!;

if (!ACLED_EMAIL || !ACLED_PASSWORD) {
  throw new Error('ACLED_EMAIL and ACLED_PASSWORD (or ACLED_KEY) environment variables are required');
}

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

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create new area
  const inserted: GeographicArea[] = await tx`
    INSERT INTO geographic_area (name, type, parent) VALUES (${trimmedName}, ${type}, ${parentId ?? null}) RETURNING id
  `;

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

// Process a single region's XLSX file
async function processRegionFile(region: string, filePath: string, filename: string): Promise<void> {
  const startTime = Date.now();
  let status = 'successful';
  let errorMessage: string | undefined;

  try {
    console.log(`Processing ${region} from ${filename}...`);

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
  let browser: Browser | undefined;

  try {
    console.log('Starting ACLED weekly aggregates fetch...');

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    console.log('Logging in to ACLED...');
    await page.goto('https://acleddata.com/user/login');

    // Wait for and click login link/button
    const loginWithEmailButton = page.locator('button', { hasText: 'Login with email' });
    await loginWithEmailButton.click();

    // Fill in credentials
    console.log('Filling out login form');
    await page.fill('input[type="email"], input[name="email"]', ACLED_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', ACLED_PASSWORD);

    // Submit form
    await Promise.all([
      page.waitForNavigation(),
      page.click('input[type="submit"]'),
    ]);

    console.log('Logged in successfully');

    // Navigate to download page
    console.log('Navigating to download page...');
    await page.goto('https://acleddata.com/conflict-data/download-data-files');
    await page.waitForSelector('a');

    // Find all "Aggregated data on [region]" links
    const regionLinks = await page.evaluate(() => {
      const links: { region: string; url: string }[] = [];
      const anchors = Array.from(document.querySelectorAll('a'));

      for (const anchor of anchors) {
        const text = anchor.textContent || '';
        const match = text.match(/Aggregated data on (.+)/i);
        if (match) {
          links.push({
            region: match[1].trim(),
            url: anchor.href
          });
        }
      }

      return links;
    });

    if (!regionLinks.length) {
      throw new Error("Failed to find links for region aggregate pages");
    }

    console.log(`Found ${regionLinks.length} regions:`, regionLinks.map(r => r.region).join(', '));

    // Process each region
    for (const { region, url } of regionLinks) {
      try {
        console.log(`\nProcessing region: ${region}`);
        await page.goto(url);
        await page.waitForSelector('a[href$=".xlsx"], a[download]');

        // Get the filename
        const downloadInfo = await page.evaluate(() => {
          const link = document.querySelector('a[href$=".xlsx"], a[download]') as HTMLAnchorElement;
          if (!link) return null;

          const href = link.href;
          const filename = href.split('/').pop() || link.getAttribute('download') || 'unknown.xlsx';

          return { href, filename };
        });

        if (!downloadInfo) {
          console.warn(`  No download link found for ${region}, skipping`);
          continue;
        }

        const { href, filename } = downloadInfo;
        console.log(`  Found file: ${filename}`);

        // Check if filename has changed
        if (!await hasFilenameChanged(region, filename)) {
          console.log(`  Filename unchanged since last run, skipping`);
          continue;
        }

        // Download file (uses the context's authenticated cookies)
        const downloadPath = join('/tmp', filename);
        const response = await page.request.get(href);
        if (!response.ok()) {
          throw new Error(`Failed to download ${filename}: ${response.status()} ${response.statusText()}`);
        }
        const buffer = await response.body();
        await Bun.write(downloadPath, buffer);

        console.log(`  Downloaded to ${downloadPath}`);

        // Process the file
        await processRegionFile(region, downloadPath, filename);
      } catch (error) {
        console.error(`Failed to process region ${region}:`, error);
        // Continue with next region
      }
    }

    console.log('\nCompleted successfully!');
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    await sql.end();
  }
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
