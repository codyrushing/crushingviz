import csv, json, os
from collections import defaultdict

PICT = ["AS","CK","FJ","FM","GU","KI","MH","MP","NC","NR","NU","PF",
        "PG","PN","PW","SB","TK","TO","TV","VU","WF","WS"]
DATA = ("/home/codyrushing/Projects/crushingviz/packages/data/"
        "pacific-dataviz-challenge-2026/")
os.makedirs(DATA+"raw", exist_ok=True)

def extract(path, band_col, rf_ind, af_ind):
    out = defaultdict(lambda: defaultdict(dict))  # country -> band -> {pct,n}
    for r in csv.DictReader(open(path)):
        if r["GEO_PICT"] not in PICT:
            continue
        try: v = float(r["OBS_VALUE"])
        except ValueError: continue
        band = r[band_col]
        if band == "_T":
            continue
        if r["INDICATOR"] == rf_ind:
            out[r["GEO_PICT"]][band]["pct"] = v
        elif r["INDICATOR"] == af_ind:
            out[r["GEO_PICT"]][band]["n"] = int(v)
    return {c: dict(b) for c, b in out.items()}

lecz = extract("/tmp/pop_lecz.csv", "ELEVATION", "LECZPOPRF", "LECZPOPAF")
coast = extract("/tmp/pop_coast.csv", "RANGE", "COASTALPOPRF", "COASTALPOPAF")

json.dump(lecz, open(DATA+"derived/pop_lecz_by_country.json","w"), indent=2)
json.dump(coast, open(DATA+"derived/pop_coast_by_country.json","w"), indent=2)

for name, d in [("LECZ (low-elevation)", lecz), ("COAST (dist to coast)", coast)]:
    miss = [c for c in PICT if c not in d]
    print(f"{name}: {len(d)}/22 countries; missing: {miss}")

print("\n% pop below 5m / 10m / 20m elevation (most exposed first):")
rows = sorted(lecz.items(), key=lambda kv: -(kv[1].get("10M",{}).get("pct") or 0))
for c, b in rows:
    print(f"  {c:<4} 5m={b.get('5M',{}).get('pct','-')!s:>5}  "
          f"10m={b.get('10M',{}).get('pct','-')!s:>5}  20m={b.get('20M',{}).get('pct','-')!s:>5}")
