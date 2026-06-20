"""Extract the economic / vulnerability dimensions from the 2026-06-20 Pacific
Data Hub pull (P0g) into per-country derived panels.

Emits five files into derived/:
  - gdp_by_country.json            GDP total / per-capita / growth (USD + domestic)
  - disaster_loss_pct_gdp.json     disaster econ loss joined to same-year GDP (USD)
  - max_elevation_by_country.json  highest point (m) + reported area (km2)
  - household_expenditure.json     food / fish / energy budget shares by quintile
  - remittances_renewables.json    remittances %GDP + renewable energy share + elec access

Parsing landmines handled here (these SDMX exports are irregular):
  - DF_KEYFACTS / DF_POP_DENSITY store the YEAR in the `INDICATOR` column and the
    value in `OBS_VALUE`; the real fact type is carried by `UNIT_MEASURE`.
  - DF_NATIONAL_ACCOUNTS carries `UNIT_MULT` (10^n) and two CURRENCY rows
    (USD vs DOM domestic); we keep USD for cross-country comparison, DOM alongside.
  - DF_HHEXP is a single survey snapshot per country (TIME_PERIOD is blank).

Stdlib only, matching the other analysis scripts.
"""
import csv, json, os
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "raw")
DERIVED = os.path.join(BASE, "derived")

NA = os.path.join(RAW, "SPC,DF_NATIONAL_ACCOUNTS,1.0,complete,2026-06-20 01-36-47.csv")
KEYFACTS = os.path.join(RAW, "SPC,DF_KEYFACTS,1.0,complete,2026-06-20 01-31-15.csv")
HHEXP = os.path.join(RAW, "SPC,DF_HHEXP,1.0,complete,2026-06-20 01-40-27.csv")
NMDI = os.path.join(RAW, "SPC,DF_NMDI,1.0,complete,2026-06-20 01-27-44.csv")
LOSS = os.path.join(DERIVED, "disaster_econ_loss_by_country.json")


def rows(path):
    return csv.DictReader(open(path, newline=""))


def fnum(v):
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def latest(series):
    """series: {year(str)->value}; return (year, value) for max year."""
    if not series:
        return None, None
    y = max(series, key=lambda k: int(k))
    return y, series[y]


# ---------------------------------------------------------------------------
# 1. GDP  (DF_NATIONAL_ACCOUNTS)
# ---------------------------------------------------------------------------
# INDICATOR: GDPC=total current, GDPCPC=per-capita current,
#            GDPCVR=growth rate total, GDPCPCVR=growth rate per-capita.
def gdp_value(r):
    v = fnum(r["OBS_VALUE"])
    if v is None:
        return None
    return v * (10 ** int(r["UNIT_MULT"] or 0))


gdp = defaultdict(lambda: defaultdict(dict))  # country -> ind -> {currency -> {year: val}}
for r in rows(NA):
    v = gdp_value(r)
    if v is None:
        continue
    gdp[r["GEO_PICT"]][r["INDICATOR"]].setdefault(r["CURRENCY"], {})[r["TIME_PERIOD"]] = v

gdp_out = {}
for c, inds in gdp.items():
    usd_total = inds.get("GDPC", {}).get("USD", {})
    dom_total = inds.get("GDPC", {}).get("DOM", {})
    usd_pc = inds.get("GDPCPC", {}).get("USD", {})
    dom_pc = inds.get("GDPCPC", {}).get("DOM", {})
    growth = inds.get("GDPCVR", {}).get("DOM", {}) or inds.get("GDPCVR", {}).get("USD", {})
    ly_t, lv_t = latest(usd_total)
    ly_pc, lv_pc = latest(usd_pc)
    gdp_out[c] = {
        "gdp_usd": {y: usd_total[y] for y in sorted(usd_total)},
        "gdp_dom": {y: dom_total[y] for y in sorted(dom_total)},
        "gdp_pc_usd": {y: usd_pc[y] for y in sorted(usd_pc)},
        "gdp_pc_dom": {y: dom_pc[y] for y in sorted(dom_pc)},
        "growth_rate": {y: growth[y] for y in sorted(growth)},
        "latest_gdp_usd": {"year": ly_t, "value": lv_t},
        "latest_gdp_pc_usd": {"year": ly_pc, "value": lv_pc},
    }
json.dump(gdp_out, open(os.path.join(DERIVED, "gdp_by_country.json"), "w"), indent=1)

# convenience: USD total GDP by (country, year) for the loss join below.
# Guard against corrupt source rows (e.g. VU 2018 USD reads $95M between two
# $935M years -- an off-by-10x export glitch). Flag any year deviating >3x from
# its series median and exclude it from the loss join.
gdp_usd_year = {}
gdp_usd_suspect = []
for c, inds in gdp.items():
    series = inds.get("GDPC", {}).get("USD", {})
    if not series:
        continue
    vals = sorted(series.values())
    med = vals[len(vals) // 2]
    for y, v in series.items():
        if med and (v / med > 3 or v / med < 1 / 3):
            gdp_usd_suspect.append((c, y, v, med))
            continue
        gdp_usd_year[(c, y)] = v
if gdp_usd_suspect:
    print("GDP USD rows flagged as suspect (excluded from loss join):")
    for c, y, v, med in gdp_usd_suspect:
        print(f"  {c} {y}: ${v/1e6:.1f}M vs series median ${med/1e6:.1f}M")

# ---------------------------------------------------------------------------
# 2. Disaster loss as % of GDP  (join derived loss <-> same-year USD GDP)
# ---------------------------------------------------------------------------
loss = json.load(open(LOSS))
loss_out = {}
for c, d in loss.items():
    by_year = {}
    for y, v in d["by_year"].items():
        g = gdp_usd_year.get((c, y))
        by_year[y] = {
            "loss_usd": v,
            "gdp_usd": g,
            "pct_of_gdp": (v / g * 100) if g else None,
        }
    worst = max(
        (e for e in by_year.values() if e["pct_of_gdp"] is not None),
        key=lambda e: e["pct_of_gdp"],
        default=None,
    )
    worst_year = next((y for y, e in by_year.items() if e is worst), None) if worst else None
    loss_out[c] = {
        "by_year": by_year,
        "total_loss_usd": d["total_usd"],
        "worst": {
            "year": worst_year,
            "pct_of_gdp": worst["pct_of_gdp"] if worst else None,
            "loss_usd": worst["loss_usd"] if worst else None,
        },
    }
json.dump(loss_out, open(os.path.join(DERIVED, "disaster_loss_pct_gdp.json"), "w"), indent=1)

# ---------------------------------------------------------------------------
# 3. Max elevation + reported area  (DF_KEYFACTS; year-in-INDICATOR quirk)
# ---------------------------------------------------------------------------
# NOTE: the KM2 area in KEYFACTS matches each country's maritime/EEZ footprint
# (e.g. PG ~2.4M km2), NOT land area -- do not use it for land density.
elev = {}
for r in rows(KEYFACTS):
    v = fnum(r["OBS_VALUE"])
    if v is None:
        continue
    c = r["GEO_PICT"]
    rec = elev.setdefault(c, {})
    if r["UNIT_MEASURE"] == "METER":
        rec["max_elevation_m"] = v
    elif r["UNIT_MEASURE"] == "KM2":
        rec["area_km2_reported"] = v  # maritime/EEZ footprint, see note
json.dump(elev, open(os.path.join(DERIVED, "max_elevation_by_country.json"), "w"), indent=1)

# ---------------------------------------------------------------------------
# 4. Household expenditure shares  (DF_HHEXP; snapshot, no year)
# ---------------------------------------------------------------------------
# HHEXPPROP = % of household budget. National urbanization. Budget quintiles:
#   _T total, Q5-1 poorest, Q5-2, Q5-345 richest 60%.
# Commodities of climate interest: 01 food&non-alc, 01_1_3 fish/seafood,
#   04_5 electricity/gas/other fuels.
COMM = {"01": "food", "01_1_3": "fish", "04_5": "energy"}
hh = defaultdict(lambda: defaultdict(dict))  # country -> budget -> commodity -> val
for r in rows(HHEXP):
    if r["INDICATOR"] != "HHEXPPROP" or r["Urbanization"] != "National":
        continue
    if r["COMMODITY"] not in COMM:
        continue
    v = fnum(r["OBS_VALUE"])
    if v is None:
        continue
    hh[r["GEO_PICT"]][r["BUDGET"]][COMM[r["COMMODITY"]]] = v

hh_out = {}
for c, budgets in hh.items():
    total = budgets.get("_T", {})
    q1 = budgets.get("Q5-1", {})
    q5 = budgets.get("Q5-345", {})
    hh_out[c] = {
        "national": total,                       # {food, fish, energy} % of budget
        "food_poorest_q": q1.get("food"),
        "food_richest_q": q5.get("food"),
        "food_quintile_gap": (q1.get("food") - q5.get("food"))
        if (q1.get("food") is not None and q5.get("food") is not None) else None,
    }
json.dump(hh_out, open(os.path.join(DERIVED, "household_expenditure.json"), "w"), indent=1)

# ---------------------------------------------------------------------------
# 5. Remittances + renewables + electricity access  (DF_NMDI)
# ---------------------------------------------------------------------------
NMDI_IND = {
    "BX_TRF_PWKR": "remittances_pct_gdp",
    "EG_FEC_RNEW": "renewable_energy_pct",
    "EG_ACS_ELEC": "electricity_access_pct",
}
nmdi = defaultdict(lambda: defaultdict(dict))  # country -> field -> {year: val}
for r in rows(NMDI):
    ind = r["INDICATOR"]
    if ind not in NMDI_IND:
        continue
    # take the all-groups total where breakdown dims exist
    if r.get("SEX", "_T") not in ("_T", "") or r.get("URBANIZATION", "_T") not in ("_T", ""):
        continue
    v = fnum(r["OBS_VALUE"])
    if v is None or not r.get("TIME_PERIOD"):
        continue
    nmdi[r["GEO_PICT"]][NMDI_IND[ind]][r["TIME_PERIOD"]] = v

rr_out = {}
for c, fields in nmdi.items():
    rec = {}
    for field, series in fields.items():
        y, v = latest(series)
        rec[field] = {"year": y, "value": v, "series": {k: series[k] for k in sorted(series)}}
    rr_out[c] = rec
json.dump(rr_out, open(os.path.join(DERIVED, "remittances_renewables.json"), "w"), indent=1)

# ---------------------------------------------------------------------------
print("Wrote derived files:")
for f in ("gdp_by_country", "disaster_loss_pct_gdp", "max_elevation_by_country",
          "household_expenditure", "remittances_renewables"):
    p = os.path.join(DERIVED, f + ".json")
    print(f"  {f}.json  ({len(json.load(open(p)))} countries)")
