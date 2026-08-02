import countriesJSON from "./countries.json";
import populationByCountryJSON from "./population_by_country.json";
import GDPByCountryJSON from "./gdp_by_country.json";

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
  [countryCode: CountryCode]: GDPEntry
}
