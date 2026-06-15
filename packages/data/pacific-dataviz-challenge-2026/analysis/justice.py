import csv
from collections import defaultdict
import numpy as np

BASE = "/home/codyrushing/Projects/crushingviz/packages/data/pacific-dataviz-challenge-2026/"
CLIMATE = BASE + "SPC,DF_CLIMATE_CHANGE,1.0,complete,2026-06-14 16-08-23.csv"
SDG = BASE + "SPC,DF_SDG_11,3.0,complete,2026-06-14 18-16-49.csv"

names = {}
ghg = defaultdict(list)      # recent GHG per capita
disaster_affct = defaultdict(float)  # cumulative affected
disaster_mort = defaultdict(float)   # cumulative deaths
disaster_loss = defaultdict(float)   # cumulative econ loss (USD millions)

with open(CLIMATE) as fh:
    for r in csv.DictReader(fh):
        names[r["GEO_PICT"]] = r["Pacific Island Countries and territories"]
        if r["CLIMATE_CHANGE_INDICATORS"] == "GHG_EMI_CAPITA":
            try:
                y = int(r["TIME_PERIOD"]); v = float(r["OBS_VALUE"])
                if y >= 2015:
                    ghg[r["GEO_PICT"]].append(v)
            except (ValueError, KeyError):
                pass

with open(SDG) as fh:
    for r in csv.DictReader(fh):
        names[r["GEO_PICT"]] = r["Pacific Island Countries and territories"]
        ind = r["INDICATOR"]
        try:
            v = float(r["OBS_VALUE"])
        except (ValueError, KeyError):
            continue
        if ind == "VC_DSR_AFFCT":
            disaster_affct[r["GEO_PICT"]] += v
        elif ind == "VC_DSR_MORT":
            disaster_mort[r["GEO_PICT"]] += v
        elif ind == "VC_DSR_AALT":
            disaster_loss[r["GEO_PICT"]] += v

codes = sorted(set(list(ghg) + list(disaster_affct) + list(disaster_mort)))
print(f"{'ctry':<5}{'name':<22}{'GHG/cap(t)':>11}{'cumAffected':>13}{'cumDeaths':>10}{'cumLoss$M':>11}")
for c in codes:
    g = round(np.mean(ghg[c]), 2) if ghg[c] else None
    print(f"{c:<5}{names.get(c,c)[:21]:<22}{str(g):>11}"
          f"{int(disaster_affct[c]):>13}{int(disaster_mort[c]):>10}"
          f"{round(disaster_loss[c],1)!s:>11}")

# global context: typical high-emitter per-capita ~ 15 (USA), world avg ~4.7
print("\nContext: USA ~15 t/capita, world avg ~4.7 t/capita, China ~8 t/capita")
