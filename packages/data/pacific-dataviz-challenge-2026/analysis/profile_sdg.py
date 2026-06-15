import csv
from collections import defaultdict, Counter

F = "/home/codyrushing/Projects/crushingviz/packages/data/pacific-dataviz-challenge-2026/SPC,DF_SDG_11,3.0,complete,2026-06-14 18-16-49.csv"

inds = {}
ind_years = defaultdict(list)
ind_ctry = defaultdict(set)
ind_unit = defaultdict(set)
ind_distinct = defaultdict(set)
# check disaggregation dims for non-total values
disagg_cols = ["SEX", "AGE", "URBANIZATION", "INCOME", "EDUCATION",
               "OCCUPATION", "COMPOSITE_BREAKDOWN", "DISABILITY"]
disagg_nontotal = defaultdict(Counter)

with open(F) as fh:
    for r in csv.DictReader(fh):
        i = r["INDICATOR"]
        inds[i] = r["Indicator"]
        ind_unit[i].add(r["UNIT_MEASURE"])
        ind_ctry[i].add(r["GEO_PICT"])
        if r["TIME_PERIOD"].isdigit():
            ind_years[i].append(int(r["TIME_PERIOD"]))
        if r["OBS_VALUE"]:
            try:
                ind_distinct[i].add(float(r["OBS_VALUE"]))
            except ValueError:
                pass
        for c in disagg_cols:
            v = r.get(c, "")
            if v not in ("_T", "_Z", ""):
                disagg_nontotal[i][c] += 1

print(f"{len(inds)} indicators:\n")
for i in sorted(inds):
    ys = ind_years[i]
    span = f"{min(ys)}-{max(ys)}" if ys else "n/a"
    da = dict(disagg_nontotal[i])
    print(f"{i}: {inds[i][:70]}")
    print(f"    years={span}  #ctry={len(ind_ctry[i])}  units={','.join(ind_unit[i])}  "
          f"distinct_vals={len(ind_distinct[i])}  disagg={da if da else 'none'}")
