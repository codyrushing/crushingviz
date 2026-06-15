"""Refine the 5 distant-proxy SLR sites using the AR6 GRIDDED product (1-deg).

These countries lacked a nearby tide gauge: Niue, Tokelau, Wallis & Futuna,
Pitcairn (snapped to Apia ~500 km), and PNG (Torres Strait gauge, anomalous).
Pulls the nearest valid ocean grid cell at 2050 and overwrites their entries in
slr_2050_by_country.json (marking source='gridded', low_confidence=False).
"""
import json, math, warnings
import numpy as np
import xarray as xr
warnings.filterwarnings("ignore")

BASE = ("https://storage.googleapis.com/ar6-lsl-simulations-public-standard/"
        "gridded/full_sample_workflows/wf_1e/")
SCENARIOS = ["ssp126", "ssp245", "ssp585"]
OUT = ("/home/codyrushing/Projects/crushingviz/packages/data/"
       "pacific-dataviz-challenge-2026/derived/slr_2050_by_country.json")

FIX = {  # country -> (lat, lon) of populated coast
    "NU": (-19.06, -169.92), "TK": (-9.20, -171.85), "WF": (-13.28, -176.17),
    "PN": (-25.07, -130.10), "PG": (-9.48, 147.16),
}

def haversine(a1, o1, a2, o2):
    r = 6371.0
    p1, p2 = math.radians(a1), math.radians(a2)
    dp, dl = math.radians(a2-a1), math.radians(((o2-o1+180) % 360)-180)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.asin(math.sqrt(h))

slr = json.load(open(OUT))

# candidate cells: 5x5 integer-degree window around each point
cand = {}
for c, (la, lo) in FIX.items():
    pts = []
    for dla in range(-2, 3):
        for dlo in range(-2, 3):
            pts.append((round(la)+dla, ((round(lo)+dlo + 180) % 360) - 180))
    cand[c] = pts

per_scn = {}
for sc in SCENARIOS:
    print(f"reading gridded {sc} ...", flush=True)
    ds = xr.open_zarr(BASE + sc + "/total-workflow.zarr")
    da = ds["sea_level_change"].sel(years=2050)
    for c, pts in cand.items():
        las = xr.DataArray([p[0] for p in pts], dims="k")
        los = xr.DataArray([p[1] for p in pts], dims="k")
        sub = da.sel(lat=las, lon=los, method="nearest").load().values  # (samples, k)
        med = np.median(sub, axis=0)  # per candidate
        # choose nearest candidate with valid (non-NaN) data
        best, bestd = None, 1e9
        for j, (pla, plo) in enumerate(pts):
            if np.isnan(med[j]):
                continue
            d = haversine(FIX[c][0], FIX[c][1], pla, plo)
            if d < bestd:
                bestd, best = d, j
        if best is None:
            print(f"  WARN {c}: no valid cell"); continue
        p = np.percentile(sub[:, best], [17, 50, 83]) / 10  # cm
        per_scn.setdefault(c, {})[sc] = {
            "p17": round(float(p[0]), 1), "p50": round(float(p[1]), 1),
            "p83": round(float(p[2]), 1),
            "_cell": (pts[best][0], pts[best][1]), "_dist": round(bestd, 1),
        }

# patch the JSON
for c, scn in per_scn.items():
    cell = scn["ssp245"]["_cell"]; dist = scn["ssp245"]["_dist"]
    slr[c]["station_lat"], slr[c]["station_lon"] = cell[0], cell[1]
    slr[c]["dist_km"] = dist
    slr[c]["source"] = "gridded"
    slr[c]["slr_cm"] = {sc: {k: scn[sc][k] for k in ("p17", "p50", "p83")}
                        for sc in SCENARIOS}
json.dump(slr, open(OUT, "w"), indent=2)

print("\nRefined sites (SSP2-4.5 median, cm):")
for c in FIX:
    print(f"  {c}: {slr[c]['slr_cm']['ssp245']['p50']} cm  "
          f"(cell {slr[c]['station_lat']},{slr[c]['station_lon']}, "
          f"{slr[c]['dist_km']} km)")
print("saved", OUT)
