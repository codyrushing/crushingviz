/** Types generated for queries found in "acled/ingest-weekly-aggregates.ts" */
export type geographic_area_type = 'admin_1' | 'country' | 'region';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** 'FindGeographicArea' parameters type */
export interface IFindGeographicAreaParams {
  name: string;
  parent?: number | null | void;
  type: geographic_area_type;
}

/** 'FindGeographicArea' return type */
export interface IFindGeographicAreaResult {
  id: number;
}

/** 'FindGeographicArea' query type */
export interface IFindGeographicAreaQuery {
  params: IFindGeographicAreaParams;
  result: IFindGeographicAreaResult;
}

/** 'InsertGeographicArea' parameters type */
export interface IInsertGeographicAreaParams {
  name: string;
  parent?: number | null | void;
  type: geographic_area_type;
}

/** 'InsertGeographicArea' return type */
export interface IInsertGeographicAreaResult {
  id: number;
}

/** 'InsertGeographicArea' query type */
export interface IInsertGeographicAreaQuery {
  params: IInsertGeographicAreaParams;
  result: IInsertGeographicAreaResult;
}

/** 'GetLastSuccessfulIngestMeta' parameters type */
export interface IGetLastSuccessfulIngestMetaParams {
  region: string;
}

/** 'GetLastSuccessfulIngestMeta' return type */
export interface IGetLastSuccessfulIngestMetaResult {
  meta: Json | null;
}

/** 'GetLastSuccessfulIngestMeta' query type */
export interface IGetLastSuccessfulIngestMetaQuery {
  params: IGetLastSuccessfulIngestMetaParams;
  result: IGetLastSuccessfulIngestMetaResult;
}

/** 'DeleteRegionWeeklyAgg' parameters type */
export interface IDeleteRegionWeeklyAggParams {
  regionId: number;
}

/** 'DeleteRegionWeeklyAgg' return type */
export type IDeleteRegionWeeklyAggResult = void;

/** 'DeleteRegionWeeklyAgg' query type */
export interface IDeleteRegionWeeklyAggQuery {
  params: IDeleteRegionWeeklyAggParams;
  result: IDeleteRegionWeeklyAggResult;
}

/** 'InsertWeeklyAgg' parameters type */
export interface IInsertWeeklyAggParams {
  data?: Json | null | void;
}

/** 'InsertWeeklyAgg' return type */
export type IInsertWeeklyAggResult = void;

/** 'InsertWeeklyAgg' query type */
export interface IInsertWeeklyAggQuery {
  params: IInsertWeeklyAggParams;
  result: IInsertWeeklyAggResult;
}

/** 'GetLatestDownloadJob' parameters type */
export type IGetLatestDownloadJobParams = void;

/** 'GetLatestDownloadJob' return type */
export interface IGetLatestDownloadJobResult {
  meta: Json | null;
  status: string | null;
}

/** 'GetLatestDownloadJob' query type */
export interface IGetLatestDownloadJobQuery {
  params: IGetLatestDownloadJobParams;
  result: IGetLatestDownloadJobResult;
}

