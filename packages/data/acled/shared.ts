import { join } from 'path';

// Where downloaded weekly aggregate .xlsx files are written (gitignored).
// Only the latest file per region is kept.
export const DOWNLOADS_DIR = join(import.meta.dir, 'downloads');
