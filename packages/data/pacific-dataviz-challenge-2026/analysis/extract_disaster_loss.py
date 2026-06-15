"""Normalize VC_DSR_AALT (disaster direct economic loss) to a single unit (USD).

Source rows mix UNIT_MEASURE = USD (raw dollars) and USD_MILLIONS (millions).
Fix: convert USD_MILLIONS -> USD by x1e6 so all values are comparable.
Output: derived/disaster_econ_loss_by_country.json
  { country: { "by_year": {year: usd}, "total_usd": float, "n_years": int } }
"""
import csv, json
from collections import defaultdict

BASE = ("/home/codyrushing/Projects/crushingviz/packages/data/"
        "pacific-dataviz-challenge-2026/")
SDG = BASE + "SPC,DF_SDG_11,3.0,complete,2026-06-14 18-16-49.csv"

TO_USD = {"USD": 1.0, "USD_MILLIONS": 1_000_000.0}

by_year = defaultdict(dict)
converted = 0
for r in csv.DictReader(open(SDG)):
    if r["INDICATOR"] != "VC_DSR_AALT" or not r["OBS_VALUE"]:
        continue
    unit = r["UNIT_MEASURE"]
    if unit not in TO_USD:
        raise SystemExit(f"Unexpected unit {unit!r} — review before trusting output")
    usd = float(r["OBS_VALUE"]) * TO_USD[unit]
    if unit == "USD_MILLIONS":
        converted += 1
    by_year[r["GEO_PICT"]][int(r["TIME_PERIOD"])] = usd

out = {}
for c, yrs in by_year.items():
    out[c] = {
        "by_year": {str(y): round(v, 2) for y, v in sorted(yrs.items())},
        "total_usd": round(sum(yrs.values()), 2),
        "n_years": len(yrs),
    }

json.dump(out, open(BASE + "derived/disaster_econ_loss_by_country.json", "w"), indent=2)
print(f"normalized {sum(len(v) for v in by_year.values())} rows "
      f"({converted} converted from USD_MILLIONS)")
print(f"\n{'ctry':<5}{'n_yrs':>6}{'total_USD':>18}{'total_$M':>10}")
for c, v in sorted(out.items(), key=lambda kv: -kv[1]["total_usd"]):
    print(f"{c:<5}{v['n_years']:>6}{v['total_usd']:>18,.0f}{v['total_usd']/1e6:>10,.1f}")
print("\nsaved derived/disaster_econ_loss_by_country.json")
