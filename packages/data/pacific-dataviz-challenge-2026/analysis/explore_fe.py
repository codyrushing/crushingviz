import csv, math
from collections import defaultdict
import numpy as np

BASE = "/home/codyrushing/Projects/crushingviz/packages/data/pacific-dataviz-challenge-2026/"
CLIMATE = BASE + "SPC,DF_CLIMATE_CHANGE,1.0,complete,2026-06-14 16-08-23.csv"
SDG = BASE + "SPC,DF_SDG_11,3.0,complete,2026-06-14 18-16-49.csv"

panel = defaultdict(dict)
labels = {}

def load(path, ind_col, label_col, disagg_cols=()):
    with open(path) as fh:
        for r in csv.DictReader(fh):
            if any(r.get(c, "_T") not in ("_T", "_Z", "") for c in disagg_cols):
                continue
            ind = r[ind_col]; labels[ind] = r[label_col]
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

def pearson(x, y):
    x = x - x.mean(); y = y - y.mean()
    d = math.sqrt((x*x).sum()*(y*y).sum())
    return float((x*y).sum()/d) if d else None

def two_way_demean(cells, ia, ib):
    # cells: list of (country, year, va, vb)
    rows = [(c, y, va, vb) for (c, y, va, vb) in cells]
    if len(rows) < 20:
        return None, len(rows)
    cs = sorted({c for c, *_ in rows}); ys = sorted({y for _, y, *_ in rows})
    if len(cs) < 3 or len(ys) < 3:
        return None, len(rows)
    A = np.array([va for *_, va, vb in rows], float)
    B = np.array([vb for *_, vb in [(r[3],) for r in rows]], float)
    # rebuild B correctly
    B = np.array([r[3] for r in rows], float)
    cidx = {c: i for i, c in enumerate(cs)}; yidx = {y: i for i, y in enumerate(ys)}
    ci = np.array([cidx[r[0]] for r in rows]); yi = np.array([yidx[r[1]] for r in rows])
    def resid(v):
        v = v.copy()
        for _ in range(50):  # iterative two-way demeaning
            cm = np.array([v[ci == k].mean() for k in range(len(cs))])
            v = v - cm[ci]
            ym = np.array([v[yi == k].mean() for k in range(len(ys))])
            v = v - ym[yi]
        return v
    ra, rb = resid(A), resid(B)
    if ra.std() < 1e-9 or rb.std() < 1e-9:
        return None, len(rows)
    return pearson(ra, rb), len(rows)

results = []
for a in range(len(indicators)):
    for b in range(a+1, len(indicators)):
        ia, ib = indicators[a], indicators[b]
        cells = [(c, y, d[ia], d[ib]) for (c, y), d in panel.items()
                 if ia in d and ib in d]
        r, n = two_way_demean(cells, ia, ib)
        if r is not None:
            results.append((abs(r), r, ia, ib, n))

results.sort(reverse=True)
print("=== Within-country, within-year (fixed-effects) correlations, n>=20 ===")
print("Country size AND common time trends removed. This is genuine co-movement.\n")
for _, r, ia, ib, n in results[:18]:
    print(f"  r={r:+.2f}  n={n:>4}  {ia} ~ {ib}")
    print(f"{'':>16}{labels[ia][:50]}")
    print(f"{'':>16}{labels[ib][:50]}\n")
