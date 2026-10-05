#!/usr/bin/env bun

/**
Downloads ACLED weekly aggregate .xlsx files to disk for later ingestion.

This process owns the browser. It reuses the saved session in .acled-auth.json
when available and only performs the credential login when the session is
missing or expired. Each run downloads every region's .xlsx file into
./downloads, keeping only the latest file per region, and records the files it
saved in an `async_job` row (type `acled_weekly_agg_download`). The ingest
process reads that row to decide what to process from disk.
**/

import { chromium, type Browser, type Page } from 'playwright';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { DOWNLOADS_DIR } from './shared';

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

// Saved browser session so the credential login only runs when this is missing or expired
const AUTH_STATE_PATH = join(import.meta.dir, '.acled-auth.json');

// Credential login flow. Only called when no saved session is available.
async function login(page: Page): Promise<void> {
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
}

// Main function
async function main() {
  let browser: Browser | undefined;

  try {
    console.log('Starting ACLED weekly aggregates download...');
    const startTime = Date.now();

    // Launch browser (headed so a first-run login / Cloudflare challenge can be handled manually)
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext(
      existsSync(AUTH_STATE_PATH) ? { storageState: AUTH_STATE_PATH } : undefined,
    );
    const page = await context.newPage();

    // Reuse the saved session instead of logging in on every run — repeated
    // automated credential logins risk tripping ACLED's rate limiting.
    const hasSession = (await context.cookies('https://acleddata.com'))
      .some(c => c.name.startsWith('wordpress_logged_in_'));
    if (hasSession) {
      console.log('Using saved ACLED session');
    } else {
      await login(page);
      // Persist the session so future runs skip the login flow entirely
      await context.storageState({ path: AUTH_STATE_PATH });
    }

    // Ensure the downloads directory exists before writing files
    mkdirSync(DOWNLOADS_DIR, { recursive: true });

    // Navigate to download page
    console.log('Navigating to download page...');
    await page.goto('https://acleddata.com/conflict-data/download-data-files/aggregated-data');
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

    // Files saved this run; recorded in the async_job table when the run completes
    const savedFiles: { region: string; filename: string }[] = [];

    // Download each region's file
    for (const { region, url } of regionLinks) {
      try {
        console.log(`\nProcessing region: ${region}`);
        console.log(`Navigating to URL: ${url}`);
        await page.goto(url);
        await page.waitForSelector('a[href$=".xlsx"], a[download]', { state: "attached" });

        // Get the download link
        const downloadInfo = await page.evaluate(() => {
          const link = document.querySelector('a[href$=".xlsx"]') as HTMLAnchorElement;
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

        // Download file (uses the context's authenticated cookies)
        const response = await page.request.get(href);
        if (!response.ok()) {
          throw new Error(`Failed to download ${filename}: ${response.status()} ${response.statusText()}`);
        }
        const filePath = join(DOWNLOADS_DIR, filename);
        await Bun.write(filePath, await response.body());
        console.log(`  Downloaded to ${filePath}`);
        savedFiles.push({ region, filename });
      } catch (error) {
        console.error(`Failed to download region ${region}:`, error);
        // Continue with next region
      }
    }

    console.log(`\nDownload complete: ${savedFiles.length}/${regionLinks.length} file(s) written to ${DOWNLOADS_DIR}`);

    // Keep only the latest file per region
    const savedFilenames = new Set(savedFiles.map(f => f.filename));
    for (const entry of readdirSync(DOWNLOADS_DIR)) {
      if (!entry.endsWith('.xlsx') || savedFilenames.has(entry)) continue;
      rmSync(join(DOWNLOADS_DIR, entry));
      console.log(`  Removed stale file ${entry}`);
    }

    // Record what this run saved so the ingest process knows what to process
    const status = savedFiles.length === regionLinks.length ? 'successful' : 'failed';
    await sql`
      INSERT INTO async_job (source, status, duration, type, meta)
      VALUES ('weekly-aggregates', ${status}, ${Date.now() - startTime}, 'acled_weekly_agg_download', ${JSON.stringify({ files: savedFiles })}::jsonb)
    `;
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
