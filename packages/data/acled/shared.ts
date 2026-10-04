import { join } from 'path';

// Where downloaded weekly aggregate files are written (gitignored)
export const DOWNLOADS_DIR = join(import.meta.dir, 'downloads');
export const MANIFEST_PATH = join(DOWNLOADS_DIR, 'manifest.json');

// One entry per file downloaded by download-weekly-aggregates.ts
export interface DownloadedFile {
  region: string;
  filename: string;
  // Absolute path to the .xlsx file on disk
  path: string;
  // Source URL the file was downloaded from
  href: string;
  downloadedAt: string;
}

// Written by the download process, consumed by the ingest process
export interface WeeklyAggManifest {
  files: DownloadedFile[];
}
