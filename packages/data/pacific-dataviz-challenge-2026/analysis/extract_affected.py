"""Extract VC_DSR_AFFCT (directly affected persons, SDG 1.5.1 / 11.5.1) from
DF_SDG_11 into a per-country panel with per-capita normalization.

Emits derived/disaster_affected_by_country.json:
  per country: {series:{year:count}, cumulative, pop_ref, cumulative_per_capita,
                biggest:{year,count,pct_of_pop}}
  plus a regional {by_year} total for the shock-year timeline.

Stdlib only, matching the other analysis scripts.
"""
import csv, json, os
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SDG11 = os.path.join(BASE, "SPC,DF_SDG_11,3.0,complete,2026-06-14 18-16-49.csv")
POP = os.path.join(BASE, "derived", "population_by_country.json")
OUT = os.path.join(BASE, "derived", "disaster_affected_by_country.json")

aff = defaultdict(dict)
for r in csv.DictReader(open(SDG11, newline="")):
    if r["INDICATOR"] != "VC_DSR_AFFCT":
        continue
    try:
        aff[r["GEO_PICT"]][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    except (ValueError, KeyError):
        continue

pop = json.load(open(POP))


def pop_of(c, y):
    return pop.get(c, {}).get(str(y))


countries = {}
by_year = defaultdict(float)
for c, s in aff.items():
    yrs = sorted(s)
    cum = sum(s.values())
    for y in yrs:
        by_year[y] += s[y]
    pref = pop_of(c, 2014)  # mid-period reference population
    big_y = max(yrs, key=lambda y: s[y])
    big = s[big_y]
    pbig = pop_of(c, big_y) or pref
    countries[c] = {
        "series": {str(y): int(s[y]) for y in yrs},
        "years_reported": len(yrs),
        "cumulative": int(cum),
        "pop_ref_2014": int(pref) if pref else None,
        "cumulative_per_capita": round(cum / pref, 3) if pref else None,
        "biggest": {
            "year": big_y,
            "count": int(big),
            "pct_of_pop": round(100 * big / pbig, 1) if pbig else None,
        },
    }

out = {
    "indicator": "VC_DSR_AFFCT",
    "label": "Number of directly affected persons attributed to disasters (SDG 1.5.1 / 11.5.1)",
    "source": "UNDRR (Sendai/DesInventar)",
    "year_span": [min(by_year), max(by_year)],
    "countries": countries,
    "regional_by_year": {str(y): int(by_year[y]) for y in sorted(by_year)},
}
json.dump(out, open(OUT, "w"), indent=2)
print("wrote", OUT, "-", len(countries), "countries")
