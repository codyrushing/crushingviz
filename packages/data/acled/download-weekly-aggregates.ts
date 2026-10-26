#!/usr/bin/env bun

/**
Downloads ACLED weekly aggregate .xlsx files to disk for later ingestion.

This process owns the browser. It reuses the saved session in .acled-auth.json
when available; session usability is not probed by cookie shape or framework
endpoints but verified at the point of use — a gated page answering non-2xx
triggers the credential login once, after which the page is retried. Each run
downloads every region's .xlsx file into ./downloads, keeping only the latest
file per region, and records the files it saved in an `async_job` row
(type `acled_weekly_agg_download`). The ingest process reads that row to
decide what to process from disk.
**/

import { chromium, type Browser, type Page } from 'playwright';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { pool } from '../db';
import { insertAsyncJob } from './queries.queries';
import { DOWNLOADS_DIR } from './shared';

// Environment variables
const ACLED_EMAIL = process.env.ACLED_EMAIL!;
const ACLED_PASSWORD = process.env.ACLED_PASSWORD || process.env.ACLED_KEY!;

if (!ACLED_EMAIL || !ACLED_PASSWORD) {
  throw new Error('ACLED_EMAIL and ACLED_PASSWORD (or ACLED_KEY) environment variables are required');
}

// Saved browser session so the credential login only runs when this is missing or expired
const AUTH_STATE_PATH = join(import.meta.dirname, '.acled-auth.json');

// Credential login flow. Only called after a gated page answered non-2xx, so
// the login page should only be visited when we actually lack access. If it
// still answers non-2xx despite that, surface a diagnostic and fail rather
// than trying to fill a form that is not there — ACLED 403s the login page
// when a session is already valid, and anti-bot challenges look the same.
async function login(page: Page): Promise<void> {
  console.log('Logging in to ACLED...');
  const response = await page.goto('https://acleddata.com/user/login');
  if (!response.ok()) {
    throw new Error(
      `Login page returned ${response.status()} ${response.statusText()} `
      + '(a session already being valid and an anti-bot challenge both look like this — '
      + 'compare against the gated-page responses earlier in this run)',
    );
  }

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

    // The saved session is reused as-is; its usability is not probed here but
    // verified at the point of use — when the first gated page answers. That
    // keeps the script agnostic of how the server implements authentication.
    if (existsSync(AUTH_STATE_PATH)) {
      console.log('Saved ACLED session found; will sign in only if a gated page rejects it');
    }
    // Login runs at most once per run, on demand. After a successful login the
    // refreshed session is persisted so future runs resume from it.
    let loginDone = false;
    const ensureLogin = async () => {
      if (loginDone) return;
      await login(page);
      await context.storageState({ path: AUTH_STATE_PATH });
      loginDone = true;
    };

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
        if (match?.[1]) {
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
        let response = await page.goto(url);

        // Gated region pages answer non-2xx when the session is not usable
        // (verified anonymously: ACLED serves a plain 403 there). Recover by
        // signing in once and reloading this page — no assumptions about how
        // the server implements or signals authentication.
        if (!response.ok() && !loginDone) {
          console.log(`  Gated page returned ${response.status()}; signing in`);
          await ensureLogin();
          response = await page.goto(url);
        }
        if (!response.ok()) {
          // Even after signing in this page stays inaccessible; skip it the
          // same way a missing download link is skipped.
          console.warn(`  Gated page returned ${response.status()} for ${region}, skipping`);
          continue;
        }

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
        const downloadResponse = await page.request.get(href);
        if (!downloadResponse.ok()) {
          throw new Error(`Failed to download ${filename}: ${downloadResponse.status()} ${downloadResponse.statusText()}`);
        }
        // A session the server no longer accepts can still yield a 200 here
        // with an HTML body (a login or error page); refuse to save that as .xlsx
        const contentType = downloadResponse.headers()['content-type'] || '';
        if (contentType.includes('text/html')) {
          throw new Error(`Download of ${filename} returned HTML (${contentType}), not the file`);
        }
        const filePath = join(DOWNLOADS_DIR, filename);
        await writeFile(filePath, await downloadResponse.body());
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
    await insertAsyncJob.run({
      source: 'weekly-aggregates',
      status,
      duration: Date.now() - startTime,
      type: 'acled_weekly_agg_download',
      meta: { files: savedFiles },
    }, pool);
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
