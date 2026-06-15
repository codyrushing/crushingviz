import csv, json
from collections import defaultdict

BASE = "/home/codyrushing/Projects/crushingviz/packages/data/pacific-dataviz-challenge-2026/"
SDG = BASE + "SPC,DF_SDG_11,3.0,complete,2026-06-14 18-16-49.csv"
pop = json.load(open(BASE + "derived/population_by_country.json"))
names = {}

affct = defaultdict(float); mort = defaultdict(float)
yrs_aff = defaultdict(list)
for r in csv.DictReader(open(SDG)):
    names[r["GEO_PICT"]] = r["Pacific Island Countries and territories"]
    try:
        v = float(r["OBS_VALUE"])
    except (ValueError, KeyError):
        continue
    c = r["GEO_PICT"]
    if r["INDICATOR"] == "VC_DSR_AFFCT":
        affct[c] += v; yrs_aff[c].append(int(r["TIME_PERIOD"]))
    elif r["INDICATOR"] == "VC_DSR_MORT":
        mort[c] += v

def pop2020(c):
    return pop.get(c, {}).get("2020")

rows = []
for c in affct:
    p = pop2020(c)
    if not p:
        continue
    aff_ratio = affct[c] / p            # cumulative affected-events per resident
    deaths_100k = mort[c] / p * 1e5     # cumulative deaths per 100k
    rows.append((aff_ratio, c, affct[c], aff_ratio, mort[c], deaths_100k, p))

print("Per-capita disaster burden (cumulative ~2005-2023, normalized by 2020 pop)\n")
print(f"{'ctry':<5}{'name':<20}{'pop2020':>9}{'cumAffct':>10}{'affct/cap':>10}{'deaths':>8}{'d/100k':>8}")
for _, c, aff, ar, m, d100, p in sorted(rows, reverse=True):
    print(f"{c:<5}{names[c][:19]:<20}{int(p):>9}{int(aff):>10}{ar:>10.2f}{int(m):>8}{d100:>8.1f}")
