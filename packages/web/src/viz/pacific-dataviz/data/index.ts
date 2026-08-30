import countriesJSON from "./countries.json";
import populationByCountryJSON from "./population_by_country.json";
import GDPByCountryJSON from "./gdp_by_country.json";
import disasterAffectedMergedJSON from "./disaster_affected_merged.json";
import disasterLossPctGDPMergedJSON from "./disaster_loss_pct_gdp_merged.json";
import disasterEmdatByTypeJSON from "./disaster_emdat_by_type.json";
import disasterEmdatRegionalEventsJSON from "./disaster_emdat_regional_events.json";
import popLeczByCountryJSON from "./pop_lecz_by_country.json";

export const countries = countriesJSON as {
  [countryCode: string]: {
    name: string,
    flag: string
  }
};


type CountryCode = Extract<keyof typeof countries, string>;
type YearSeries = {
  [year: string]: number
};
export const populationByCountry = populationByCountryJSON as {
  [countryCode: CountryCode]: YearSeries
}

export type GDPData = {
  gdp_usd: YearSeries,
  gdp_dom: YearSeries,
  gdp_pc_usd: YearSeries,
  gdp_pc_dom: YearSeries,
  growth_rate: YearSeries,
  latest_gdp_usd: {
    year: string,
    value: number
  },
  latest_gdp_pc_usd: {
    year: string,
    value: number
  }
};
export const GDPByCountry = GDPByCountryJSON as {
  [countryCode: CountryCode]: GDPData
}

type YearSourceMap = {
  [year: string]: string
};

export type DisasterAffectedCountryData = {
  series: YearSeries,
  sources: YearSourceMap,
  years_reported: number,
  cumulative: number,
  pop_ref_2014: number,
  cumulative_per_capita: number,
  biggest: {
    year: number,
    count: number,
    pct_of_pop: number
  }
};

export type DisasterAffectedData = {
  indicator: string,
  label: string,
  source: string,
  year_span: number[],
  merge_note: string,
  emdat_threshold: string,
  fills_summary: {
    [countryCode: CountryCode]: YearSeries
  },
  countries: {
    [countryCode: CountryCode]: DisasterAffectedCountryData
  },
  regional_by_year: YearSeries
};

export const disasterAffected = disasterAffectedMergedJSON as DisasterAffectedData;

export type DisasterLossYearData = {
  loss_usd: number,
  gdp_usd: number | null,
  pct_of_gdp: number | null
};

export type DisasterLossCountryData = {
  by_year: {
    [year: string]: DisasterLossYearData
  },
  sources: YearSourceMap,
  total_loss_usd: number,
  total_undrr_loss_usd: number,
  n_undrr_years: number,
  n_emdat_fill_years: number,
  worst: {
    year: string,
    pct_of_gdp: number,
    loss_usd: number
  }
};

export type DisasterLossPctGDPData = {
  indicator: string,
  label: string,
  source: string,
  year_span: number[],
  merge_note: string,
  emdat_threshold: string,
  pre_2005_note: string,
  fills_summary: {
    [countryCode: CountryCode]: YearSeries
  },
  countries: {
    [countryCode: CountryCode]: DisasterLossCountryData
  }
};

export const disasterLossPctGDP = disasterLossPctGDPMergedJSON as DisasterLossPctGDPData;

export type EmdatDisasterTypeData = {
  series_affected: YearSeries,
  series_deaths: YearSeries,
  series_damage_usd: YearSeries,
  total_affected: number,
  total_damage_usd: number,
  total_events: number,
  years_reported: number,
  biggest: {
    year: number,
    count: number,
    events: number,
    pct_of_pop: number
  }
};

export type EmdatSummaryData = {
  series_affected: YearSeries,
  series_deaths: YearSeries,
  series_damage_usd: YearSeries,
  total_affected: number,
  total_damage_usd: number,
  total_events: number,
  years_reported: number,
  biggest: {
    year: number,
    count: number,
    events: number,
    pct_of_pop: number
  } | null
};

export type EmdatEventSubtypeByType = {
  Drought: 'Drought',
  Earthquake: 'Ground movement' | 'Tsunami',
  Flood: 'Coastal flood' | 'Flash flood' | 'Flood (General)' | 'Riverine flood',
  'Mass movement (dry)': 'Landslide (dry)',
  'Mass movement (wet)': 'Landslide (wet)' | 'Mudslide',
  Storm: 'Storm surge' | 'Tropical cyclone',
  'Volcanic activity': 'Ash fall' | 'Volcanic activity (General)'
};

export type EmdatDisasterTypeWithSubtypes = keyof EmdatEventSubtypeByType;

export type EmdatEventSubtype = EmdatEventSubtypeByType[EmdatDisasterTypeWithSubtypes];

export type EmdatEvent = {
  year: number,
  type: EmdatDisasterTypeWithSubtypes,
  subtype: EmdatEventSubtypeByType[EmdatDisasterTypeWithSubtypes],
  events_count: number,
  affected: number,
  deaths: number,
  damage_usd: number | null
};

export type EmdatByTypeCountryData = {
  by_type: {
    [typeName: string]: EmdatDisasterTypeData
  },
  flood_relevant: EmdatSummaryData,
  coastal_flood_only: EmdatSummaryData,
  all_types: EmdatSummaryData,
  events: EmdatEvent[]
};

export type FloodDamagePctGDPYearData = {
  flood_damage_usd: number,
  gdp_usd: number | null,
  pct_of_gdp: number | null
};

export type FloodDamagePctGDPCountryData = {
  [year: string]: FloodDamagePctGDPYearData
} & {
  _worst?: {
    year: string,
    flood_damage_usd: number,
    gdp_usd: number,
    pct_of_gdp: number
  }
};

export type EmdatDisasterTypeName =
  | 'all'
  | 'flood_relevant'
  | 'coastal_flood_only'
  | 'Earthquake'
  | 'Storm'
  | 'Flood'
  | 'Volcanic activity'
  | 'Mass movement (wet)'
  | 'Mass movement (dry)'
  | 'Drought';

export type EmdatDamageableDisasterTypeName =
  | 'Earthquake'
  | 'Storm'
  | 'Flood'
  | 'Volcanic activity'
  | 'Drought'
  | 'Mass movement (wet)';

export type DisasterEmdatByTypeData = {
  indicator: string,
  label: string,
  source: string,
  emdat_threshold: string,
  year_span: number[],
  flood_relevant_definition: string,
  coastal_flood_only_definition: string,
  caveat: string,
  regional_by_year_affected: {
    [typeName in EmdatDisasterTypeName]: YearSeries
  },
  regional_damage_usd_by_type: {
    [typeName in EmdatDamageableDisasterTypeName]: number
  },
  flood_damage_pct_gdp: {
    [countryCode: string]: FloodDamagePctGDPCountryData
  },
  countries: {
    [countryCode: string]: EmdatByTypeCountryData
  }
};

export const disasterEmdatByType = disasterEmdatByTypeJSON as DisasterEmdatByTypeData;

export type RegionalEmdatEvent = {
  year: number,
  type: EmdatDisasterTypeWithSubtypes,
  subtype: EmdatEventSubtypeByType[EmdatDisasterTypeWithSubtypes],
  events_count: number,
  affected: number,
  deaths: number,
  damage_usd: number | null,
  countries_affected: CountryCode[],
  name?: string,
  note?: string
};

export type RegionalEmdatEventsData = {
  indicator: string,
  label: string,
  source: string,
  emdat_threshold: string,
  year_span: number[],
  merge_note: string,
  events: RegionalEmdatEvent[]
};

export const disasterEmdatRegionalEvents = disasterEmdatRegionalEventsJSON as RegionalEmdatEventsData;

export type PopLeczElevation = '5M' | '10M' | '20M';

export type PopLeczElevationData = {
  pct: number,
  n: number
};

export type PopLeczCountryData = Partial<Record<PopLeczElevation, PopLeczElevationData>>;

export const popLeczByCountry = popLeczByCountryJSON as {
  [countryCode: CountryCode]: PopLeczCountryData
};
