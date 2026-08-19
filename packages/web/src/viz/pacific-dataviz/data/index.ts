import countriesJSON from "./countries.json";
import populationByCountryJSON from "./population_by_country.json";
import GDPByCountryJSON from "./gdp_by_country.json";
import disasterAffectedMergedJSON from "./disaster_affected_merged.json";
import disasterLossPctGDPMergedJSON from "./disaster_loss_pct_gdp_merged.json";

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
