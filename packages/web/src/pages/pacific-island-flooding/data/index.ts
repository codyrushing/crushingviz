import countriesJSON from "./countries.json";

export const countries = countriesJSON as {
  [countryCode: string]: {
    name: string,
    flag: string
  }
};
