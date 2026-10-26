/** Types generated for queries found in "acled/queries.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** 'InsertAsyncJob' parameters type */
export interface IInsertAsyncJobParams {
  duration: number;
  meta: Json;
  source: string;
  status: string;
  type: string;
}

/** 'InsertAsyncJob' return type */
export interface IInsertAsyncJobResult {
  id: number;
}

/** 'InsertAsyncJob' query type */
export interface IInsertAsyncJobQuery {
  params: IInsertAsyncJobParams;
  result: IInsertAsyncJobResult;
}

const insertAsyncJobIR: any = {"usedParamSet":{"source":true,"status":true,"duration":true,"type":true,"meta":true},"params":[{"name":"source","required":true,"transform":{"type":"scalar"},"locs":[{"a":69,"b":76}]},{"name":"status","required":true,"transform":{"type":"scalar"},"locs":[{"a":79,"b":86}]},{"name":"duration","required":true,"transform":{"type":"scalar"},"locs":[{"a":89,"b":98}]},{"name":"type","required":true,"transform":{"type":"scalar"},"locs":[{"a":101,"b":106}]},{"name":"meta","required":true,"transform":{"type":"scalar"},"locs":[{"a":109,"b":114}]}],"statement":"INSERT INTO async_job (source, status, duration, type, meta)\nVALUES (:source!, :status!, :duration!, :type!, :meta!)\nRETURNING id"};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO async_job (source, status, duration, type, meta)
 * VALUES (:source!, :status!, :duration!, :type!, :meta!)
 * RETURNING id
 * ```
 */
export const insertAsyncJob = new PreparedQuery<IInsertAsyncJobParams,IInsertAsyncJobResult>(insertAsyncJobIR);


