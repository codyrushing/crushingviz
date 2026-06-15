import csv, json
from collections import defaultdict

PICT = ["AS","CK","FJ","FM","GU","KI","MH","MP","NC","NR","NU","PF",
        "PG","PN","PW","SB","TK","TO","TV","VU","WF","WS"]
pop = defaultdict(dict)  # country -> {year: pop}
for r in csv.DictReader(open("/tmp/pop_proj.csv")):
    if (r["INDICATOR"] == "MIDYEARPOPEST" and r["SEX"] == "_T"
            and r["AGE"] == "_T" and r["GEO_PICT"] in PICT):
        try:
            pop[r["GEO_PICT"]][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
        except ValueError:
            pass

missing = [c for c in PICT if c not in pop]
print("countries with pop:", len(pop), "| missing:", missing)
# coverage + latest value
out = {}
print(f"\n{'ctry':<5}{'yrs':>14}{'pop_2020':>12}{'pop_latest':>14}")
for c in PICT:
    if c not in pop:
        continue
    yrs = sorted(pop[c])
    latest_y = max(yrs)
    out[c] = {str(y): pop[c][y] for y in yrs}
    p2020 = pop[c].get(2020)
    print(f"{c:<5}{f'{min(yrs)}-{max(yrs)}':>14}{(int(p2020) if p2020 else None)!s:>12}"
          f"{int(pop[c][latest_y]):>14}")

json.dump(out, open("/home/codyrushing/Projects/crushingviz/packages/data/"
                    "pacific-dataviz-challenge-2026/derived/population_by_country.json", "w"))
print("\nsaved derived/population_by_country.json")
