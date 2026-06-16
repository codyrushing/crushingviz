"""P0f exploration: previously-unexplored SDG datasets.

Profiles SDG_03 (health), SDG_06 (water/sanitation), SDG_15 (biodiversity) and
extracts the two viable new leads to derived/:
  - Red List Index (ER_RSK_LST)  -> redlist_index_by_country.json
  - safely-managed drinking water / sanitation / open defecation -> water_sanitation_by_country.json

Stdlib only (no pandas in this env), matching the other analysis scripts.
"""
import csv, json, os
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DERIVED = os.path.join(BASE, "derived")

SDG15 = os.path.join(BASE, "SPC,DF_SDG_15,3.0,complete,2026-06-15 00-08-35.csv")
SDG06 = os.path.join(BASE, "SPC,DF_SDG_06,3.0,complete,2026-06-15 00-29-26.csv")


def load(path):
    with open(path, newline="") as fh:
        return list(csv.DictReader(fh))


def total_series(rows, code, unit=None):
    """National-total series {country: {year: value}} for one indicator."""
    by = defaultdict(dict)
    for r in rows:
        if r["INDICATOR"] != code:
            continue
        if unit and r["UNIT_MEASURE"] != unit:
            continue
        # keep national totals only (no sub-group disaggregation)
        if r.get("URBANIZATION", "") not in ("_T", ""):
            continue
        try:
            by[r["GEO_PICT"]][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
        except (ValueError, KeyError):
            continue
    return by


def to_records(by):
    out = {}
    for c, s in by.items():
        yrs = sorted(s)
        if not yrs:
            continue
        out[c] = {
            "series": {str(y): round(s[y], 3) for y in yrs},
            "first_year": yrs[0],
            "last_year": yrs[-1],
            "first": round(s[yrs[0]], 3),
            "last": round(s[yrs[-1]], 3),
            "delta": round(s[yrs[-1]] - s[yrs[0]], 3),
        }
    return out


# ---- Red List Index (biodiversity / extinction risk) ----
sdg15 = load(SDG15)
rli = to_records(total_series(sdg15, "ER_RSK_LST", "INDEX"))
with open(os.path.join(DERIVED, "redlist_index_by_country.json"), "w") as f:
    json.dump(rli, f, indent=2)
print("redlist_index_by_country.json:", len(rli), "countries")

# ---- Water & sanitation ----
sdg06 = load(SDG06)
water = {
    "drinking_water_safe": to_records(total_series(sdg06, "SH_H2O_SAFE", "PERCENT")),
    "sanitation_safe": to_records(total_series(sdg06, "SH_SAN_SAFE", "PERCENT")),
    "open_defecation": to_records(total_series(sdg06, "SH_SAN_DEFECT", "PERCENT")),
}
with open(os.path.join(DERIVED, "water_sanitation_by_country.json"), "w") as f:
    json.dump(water, f, indent=2)
print("water_sanitation_by_country.json:", {k: len(v) for k, v in water.items()})
