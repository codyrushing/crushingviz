import { createSignal } from "solid-js";
import { disasterAffected, disasterLossPctGDP } from "../data";

// remove countries whose population is too statistically small
// and could confound per-capita values
disasterAffected.countries = Object.fromEntries(
  Object.entries(disasterAffected.countries)
    .filter(([k, v]) => v.pop_ref_2014 > 10000)
    .map(([k, v]) => [k, v])
);

export const minYear = Math.min(disasterAffected.year_span[0], disasterLossPctGDP.year_span[0]);
// there is incomplete 2026 data in the dataset, let's only show full years
export const maxYear = Math.min(Math.max(disasterAffected.year_span[1], disasterLossPctGDP.year_span[1]), 2025);

export const [selectedYear, setSelectedYear] = createSignal<number>(minYear);
export const [selectedCountry, setSelectedCountry] = createSignal<string | null>(null);
export const [hoveredCountry, setHoveredCountry] = createSignal<string | null>(null);

export const GDP_LABEL = "GDP per capita";

export function toggleSelectedCountry(code: string) {
  if (selectedCountry() === code) {
    setHoveredCountry(null);
  }
  setSelectedCountry(prev => (prev === code ? null : code));
}

// Which country is currently highlighted: a locked selection wins, else the hovered one.
export function activeCountry() {
  return selectedCountry() ?? hoveredCountry();
}
