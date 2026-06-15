import csv, math
from collections import defaultdict
import numpy as np

BASE = "/home/codyrushing/Projects/crushingviz/packages/data/pacific-dataviz-challenge-2026/"
CLIMATE = BASE + "SPC,DF_CLIMATE_CHANGE,1.0,complete,2026-06-14 16-08-23.csv"
SDG = BASE + "SPC,DF_SDG_11,3.0,complete,2026-06-14 18-16-49.csv"

# panel[(country, year)][indicator] = value
panel = defaultdict(dict)
labels = {}

def load(path, ind_col, label_col, disagg_cols=()):
    with open(path) as fh:
        for r in csv.DictReader(fh):
            # keep only fully-aggregated (national total) rows
            if any(r.get(c, "_T") not in ("_T", "_Z", "") for c in disagg_cols):
                continue
            ind = r[ind_col]
            labels[ind] = r[label_col]
            try:
                y = int(r["TIME_PERIOD"]); v = float(r["OBS_VALUE"])
            except (ValueError, KeyError):
                continue
            panel[(r["GEO_PICT"], y)][ind] = v

load(CLIMATE, "CLIMATE_CHANGE_INDICATORS", "Climate Change Indicators")
load(SDG, "INDICATOR", "Indicator",
     disagg_cols=["SEX", "AGE", "URBANIZATION", "INCOME", "EDUCATION",
                  "OCCUPATION", "COMPOSITE_BREAKDOWN", "DISABILITY"])

indicators = sorted({i for d in panel.values() for i in d})
print(f"panel: {len(panel)} country-year cells, {len(indicators)} indicators\n")

def spearman(xy):
    n = len(xy)
    if n < 3:
        return None
    xs = np.array([p[0] for p in xy]); ys = np.array([p[1] for p in xy])
    rx = xs.argsort().argsort().astype(float)
    ry = ys.argsort().argsort().astype(float)
    rx -= rx.mean(); ry -= ry.mean()
    d = math.sqrt((rx*rx).sum() * (ry*ry).sum())
    return float((rx*ry).sum()/d) if d else None

# pooled (country-year) pairwise correlations
MIN_N = 12
results = []
for a in range(len(indicators)):
    for b in range(a+1, len(indicators)):
        ia, ib = indicators[a], indicators[b]
        xy = [(c[ia], c[ib]) for c in panel.values() if ia in c and ib in c]
        if len(xy) < MIN_N:
            continue
        rho = spearman(xy)
        if rho is not None:
            results.append((abs(rho), rho, ia, ib, len(xy)))

results.sort(reverse=True)
print("=== Strongest pooled Spearman correlations (country-year obs, n>=12) ===")
print("(NOTE: count vars are size-confounded — big countries score high on everything)\n")
for _, rho, ia, ib, n in results[:25]:
    print(f"  rho={rho:+.2f}  n={n:>3}  {ia:<14} ~ {ib}")
    print(f"{'':>30}{labels[ia][:46]}")
    print(f"{'':>30}{labels[ib][:46]}")
