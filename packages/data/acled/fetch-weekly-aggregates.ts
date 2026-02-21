#!/usr/bin/env bun

/**
This script fetches the ACLED weekly aggregates.

This data is available as static .xslx files per region which are updated weekly. Use puppeteer to navigate to the ACLED website, login with email and password, and download those files

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

import puppeteer, { type Browser, type Page } from 'puppeteer';
import * as XLSX from 'xlsx';
import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DisorderType, EventType, GeographicAreaType, GeographicArea } from '@crushingviz/types'

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

// Database connection pool
const pool = new Pool({
  connectionString: POSTGRES_CONNECTION_STRING,
});

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

// Helper function to get or create geographic area
async function getOrCreateGeographicArea(
  client: PoolClient,
  name: string,
  type: GeographicAreaType,
  parentId?: number
): Promise<number> {
  const trimmedName = name.trim();

  // Try to find existing area
  let existing;
  if (parentId) {
    existing = await client.query<GeographicArea>(
      'SELECT id FROM geographic_area WHERE name = $1 AND type = $2 AND parent = $3 LIMIT 1',
      [trimmedName, type, parentId]
    );
  } else {
    existing = await client.query<GeographicArea>(
      'SELECT id FROM geographic_area WHERE name = $1 AND type = $2 AND parent IS NULL LIMIT 1',
      [trimmedName, type]
    );
  }

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // Create new area
  const inserted = await client.query<GeographicArea>(
    'INSERT INTO geographic_area (name, type, parent) VALUES ($1, $2, $3) RETURNING id',
    [trimmedName, type, parentId || null]
  );

  return inserted.rows[0].id;
}

// Helper function to check if filename has changed
async function hasFilenameChanged(region: string, filename: string): Promise<boolean> {
  const result = await pool.query<{ meta: any }>(
    `SELECT meta FROM data_job
     WHERE type = 'acled_weekly_agg'
       AND source = $1
       AND status = 'successful'
     ORDER BY created_at DESC
     LIMIT 1`,
    [region]
  );

  if (result.rows.length === 0) {
    return true;
  }

  const lastFilename = result.rows[0]?.meta?.filename;
  return lastFilename !== filename;
}

// Process a single region's XLSX file
async function processRegionFile(region: string, filePath: string, filename: string): Promise<void> {
  const startTime = Date.now();
  let status = 'successful';
  let errorMessage: string | undefined;

  const client = await pool.connect();

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

    // Start transaction
    await client.query('BEGIN');

    try {
      // Get or create region geographic area
      const regionId = await getOrCreateGeographicArea(client, region, 'region');

      // Cache for geographic areas to avoid duplicate lookups
      const countryCache = new Map<string, number>();
      const admin1Cache = new Map<string, number>();

      // Collect all data for batch insert
      const aggregateData: Array<{
        week: Date;
        regionId: number;
        countryId: number | null;
        admin1Id: number | null;
        disorderType: DisorderType;
        eventType: EventType;
        eventCount: number;
        fatalities: number;
        popExposure: number;
        longitude: number;
        latitude: number;
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
              countryId = await getOrCreateGeographicArea(client, countryName, 'country', regionId);
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
              admin1Id = await getOrCreateGeographicArea(client, admin1Name, 'admin_1', countryId);
              admin1Cache.set(cacheKey, admin1Id);
            }
          }

          aggregateData.push({
            week,
            regionId,
            countryId,
            admin1Id,
            disorderType,
            eventType,
            eventCount,
            fatalities,
            popExposure,
            longitude,
            latitude,
          });
        } catch (rowError) {
          console.error('  Error processing row:', rowError);
          throw rowError; // Re-throw to rollback transaction
        }
      }

      // Batch insert all aggregates in chunks to avoid hitting parameter limits
      // PostgreSQL has a limit of 65535 parameters, and each row has 11 fields
      // So we'll chunk at 5000 rows to be safe (5000 * 11 = 55000 parameters)
      const BATCH_SIZE = 5000;
      if (aggregateData.length > 0) {
        console.log(`  Batch inserting ${aggregateData.length} rows in chunks of ${BATCH_SIZE}...`);

        for (let i = 0; i < aggregateData.length; i += BATCH_SIZE) {
          const chunk = aggregateData.slice(i, i + BATCH_SIZE);
          console.log(`  Inserting chunk ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(aggregateData.length / BATCH_SIZE)} (${chunk.length} rows)...`);

          // Build the VALUES clause with parameterized queries
          const values: any[] = [];
          const placeholders: string[] = [];

          chunk.forEach((data, idx) => {
            const offset = idx * 11;
            placeholders.push(
              `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`
            );
            values.push(
              data.week,
              data.regionId,
              data.countryId,
              data.admin1Id,
              data.disorderType,
              data.eventType,
              data.eventCount,
              data.fatalities,
              data.popExposure,
              data.longitude,
              data.latitude
            );
          });

          const query = `
            INSERT INTO acled_weekly_agg (
              week, region_id, country_id, admin1_id, disorder_type, event_type,
              event_count, fatalities, population_exposure, centroid_longitude, centroid_latitude
            ) VALUES ${placeholders.join(', ')}
          `;

          await client.query(query, values);
        }
      }

      // Delete old data for this region
      const deleted = await client.query(
        `DELETE FROM acled_weekly_agg
         WHERE region_id = $1
           AND week < (SELECT MIN(week) FROM (
             SELECT week FROM acled_weekly_agg WHERE region_id = $1 ORDER BY week DESC LIMIT $2
           ) AS recent)`,
        [regionId, rows.length]
      );

      console.log(`  Deleted ${deleted.rowCount} old rows`);
      console.log(`  Successfully processed ${rows.length} rows for ${region}`);

      // Commit transaction
      await client.query('COMMIT');
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing ${region}:`, error);
    throw error;
  } finally {
    client.release();

    // Record data job (outside transaction, even if processing failed)
    const duration = Date.now() - startTime;
    await pool.query(
      `INSERT INTO data_job (source, status, duration, type, meta)
       VALUES ($1, $2, $3, $4, $5)`,
      [region, status, duration, 'acled_weekly_agg', JSON.stringify({ filename, error: errorMessage })]
    );
  }
}

// Main function
async function main() {
  let browser: Browser | undefined;

  try {
    console.log('Starting ACLED weekly aggregates fetch...');

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Login
    console.log('Logging in to ACLED...');
    await page.goto('https://acleddata.com/');

    // Wait for and click login link/button
    await page.waitForSelector('a[href*="login"], button:has-text("Login"), a:has-text("Login")');
    await page.click('a[href*="login"], button:has-text("Login"), a:has-text("Login")');

    // Fill in credentials
    await page.waitForSelector('input[type="email"], input[name="email"]');
    await page.type('input[type="email"], input[name="email"]', ACLED_EMAIL);
    await page.type('input[type="password"], input[name="password"]', ACLED_PASSWORD);

    // Submit form
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForNavigation();

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

        // Download file
        const downloadPath = join('/tmp', filename);
        const response = await page.goto(href);
        const buffer = await response!.buffer();
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
    await pool.end();
  }
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
