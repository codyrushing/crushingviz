import csv, json, math
from collections import defaultdict

CSV = "/home/codyrushing/Projects/crushingviz/packages/data/pacific-dataviz-challenge-2026/SPC,DF_CLIMATE_CHANGE,1.0,complete,2026-06-14 16-08-23.csv"
coast = json.load(open("/tmp/coast_by_country.json"))

# per-country trend (OLS slope) for indicators over 1999-2023
series = defaultdict(lambda: defaultdict(list))
names = {}
with open(CSV) as fh:
    for r in csv.DictReader(fh):
        names[r["GEO_PICT"]] = r["Pacific Island Countries and territories"]
        try:
            y = int(r["TIME_PERIOD"]); v = float(r["OBS_VALUE"])
        except (ValueError, KeyError):
            continue
        if 1999 <= y <= 2023:
            series[r["CLIMATE_CHANGE_INDICATORS"]][r["GEO_PICT"]].append((y, v))

def slope(pts):
    n = len(pts)
    if n < 3:
        return None
    sx = sum(y for y, _ in pts); sy = sum(v for _, v in pts)
    sxx = sum(y*y for y, _ in pts); sxy = sum(y*v for y, v in pts)
    d = n*sxx - sx*sx
    return (n*sxy - sx*sy)/d if d else None

sst = {c: slope(p) for c, p in series["SST_ANOM"].items()}
rain = {c: slope(p) for c, p in series["RAIN_ANOM"].items()}

def pearson(xs, ys):
    pairs = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    n = len(pairs)
    if n < 3:
        return None, n
    mx = sum(x for x, _ in pairs)/n; my = sum(y for _, y in pairs)/n
    sxy = sum((x-mx)*(y-my) for x, y in pairs)
    sxx = sum((x-mx)**2 for x, _ in pairs); syy = sum((y-my)**2 for _, y in pairs)
    if sxx == 0 or syy == 0:
        return None, n
    return sxy/math.sqrt(sxx*syy), n

# build aligned table
codes = sorted(coast.keys())
print(f"{'ctry':<5}{'name':<24}{'medRateSig':>11}{'%erodeSig':>10}{'sstTrend':>10}{'rainTrend':>10}")
erode_metric, sst_v, rain_v = [], [], []
for c in codes:
    cs = coast[c]
    er = cs.get("median_rate_sig")
    st = sst.get(c); rn = rain.get(c)
    erode_metric.append(er); sst_v.append(st); rain_v.append(rn)
    nm = names.get(c, c)[:23]
    print(f"{c:<5}{nm:<24}{str(er):>11}{str(cs.get('pct_eroding_sig')):>10}"
          f"{(round(st,4) if st is not None else None)!s:>10}{(round(rn,3) if rn is not None else None)!s:>10}")

print("\n--- correlations across countries (median_rate_sig vs climate trend) ---")
r1, n1 = pearson(erode_metric, sst_v)
r2, n2 = pearson(erode_metric, rain_v)
print(f"coastline-rate vs SST trend : r={r1:.3f} (n={n1})" if r1 is not None else f"SST: n={n1}")
print(f"coastline-rate vs RAIN trend: r={r2:.3f} (n={n2})" if r2 is not None else f"RAIN: n={n2}")

# also vs %eroding_sig
ep = [coast[c].get("pct_eroding_sig") for c in codes]
r3, n3 = pearson(ep, sst_v)
r4, n4 = pearson(ep, rain_v)
print(f"%eroding vs SST trend       : r={r3:.3f} (n={n3})" if r3 is not None else f"SST%: n={n3}")
print(f"%eroding vs RAIN trend      : r={r4:.3f} (n={n4})" if r4 is not None else f"RAIN%: n={n4}")
