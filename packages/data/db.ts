import { Pool, types } from 'pg';

// node-postgres returns json/jsonb columns as strings by default. Parse them
// into JS values globally so every query gets objects/arrays back.
types.setTypeParser(114, JSON.parse); // json
types.setTypeParser(3802, JSON.parse); // jsonb

// Specific shapes stored in async_job.meta, keyed by async_job.type.
export interface DownloadJobMeta {
  files: { region: string; filename: string }[];
}
export interface IngestJobMeta {
  filename: string;
  error?: string;
}

const connectionString = process.env.POSTGRES_CONNECTION_STRING;
if (!connectionString) {
  throw new Error('POSTGRES_CONNECTION_STRING environment variable is required');
}

export const pool = new Pool({ connectionString });
