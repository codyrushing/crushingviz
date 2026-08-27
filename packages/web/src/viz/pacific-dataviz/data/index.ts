import countriesJSON from "./countries.json";
import populationByCountryJSON from "./population_by_country.json";
import GDPByCountryJSON from "./gdp_by_country.json";
import disasterAffectedMergedJSON from "./disaster_affected_merged.json";
import disasterLossPctGDPMergedJSON from "./disaster_loss_pct_gdp_merged.json";
import disasterEmdatByTypeJSON from "./disaster_emdat_by_type.json";

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

export type EmdatEvent = {
  year: number,
  type: string,
  subtype: string,
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
    [typeName: string]: YearSeries
  },
  regional_damage_usd_by_type: {
    [typeName: string]: number
  },
  flood_damage_pct_gdp: {
    [countryCode: string]: FloodDamagePctGDPCountryData
  },
  countries: {
    [countryCode: string]: EmdatByTypeCountryData
  }
};

export const disasterEmdatByType = disasterEmdatByTypeJSON as DisasterEmdatByTypeData;
