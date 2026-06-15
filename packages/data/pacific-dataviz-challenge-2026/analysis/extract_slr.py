"""Pull IPCC AR6 relative sea-level rise (RSL) at 2050 for each PICT.

Source: AR6 FACTS tide-gauge full-sample workflows on public GCS (zarr), with
vertical land motion (= relative SL). Workflow wf_1e, scenarios SSP1-2.6 /
2-4.5 / 5-8.5. Computes 17/50/83rd percentiles (AR6 "likely range") across the
20,000 Monte Carlo samples at year 2050. Output in cm.

  derived/slr_2050_by_country.json
    { country: {station_lat, station_lon, dist_km,
                slr_cm: {ssp126:{p17,p50,p83}, ssp245:{...}, ssp585:{...}}} }
"""
import json, math, warnings
import numpy as np
import xarray as xr
warnings.filterwarnings("ignore")

BASE = ("https://storage.googleapis.com/ar6-lsl-simulations-public-standard/"
        "tide-gauges/full_sample_workflows/wf_1e/")
SCENARIOS = ["ssp126", "ssp245", "ssp585"]
OUT = ("/home/codyrushing/Projects/crushingviz/packages/data/"
       "pacific-dataviz-challenge-2026/derived/slr_2050_by_country.json")

# representative capital / main-island coords per PICT
PICT = {
    "AS": (-14.28, -170.70), "CK": (-21.21, -159.78), "FJ": (-18.14, 178.44),
    "FM": (6.92, 158.16),    "GU": (13.47, 144.75),   "KI": (1.36, 172.92),
    "MH": (7.10, 171.38),    "MP": (15.21, 145.75),   "NC": (-22.28, 166.46),
    "NR": (-0.55, 166.92),   "NU": (-19.06, -169.92), "PF": (-17.54, -149.57),
    "PG": (-9.48, 147.16),   "PN": (-25.07, -130.10), "PW": (7.34, 134.48),
    "SB": (-9.43, 159.95),   "TK": (-9.20, -171.85),  "TO": (-21.14, -175.20),
    "TV": (-8.52, 179.20),   "VU": (-17.73, 168.32),  "WF": (-13.28, -176.17),
    "WS": (-13.83, -171.77),
}

def haversine(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(((lon2 - lon1 + 180) % 360) - 180)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * r * math.asin(math.sqrt(a))

# map each PICT to nearest tide-gauge location index (using ssp245 coords)
ds0 = xr.open_zarr(BASE + "ssp245/total-workflow.zarr")
lats = ds0["lat"].values
lons = ds0["lon"].values
idx_map = {}
for c, (clat, clon) in PICT.items():
    d = [haversine(clat, clon, lats[i], lons[i]) for i in range(len(lats))]
    i = int(np.argmin(d))
    idx_map[c] = (i, round(d[i], 1), round(float(lats[i]), 2), round(float(lons[i]), 2))
print("country -> nearest gauge (idx, dist_km, lat, lon):")
for c, v in idx_map.items():
    print(f"  {c}: {v}")

out = {c: {"station_lat": idx_map[c][2], "station_lon": idx_map[c][3],
           "dist_km": idx_map[c][1], "slr_cm": {}} for c in PICT}

idxs = [idx_map[c][0] for c in PICT]
for sc in SCENARIOS:
    print(f"reading {sc} ...", flush=True)
    ds = xr.open_zarr(BASE + sc + "/total-workflow.zarr")
    arr = ds["sea_level_change"].sel(years=2050).isel(locations=idxs).load().values  # (samples, 22) mm
    pcts = np.percentile(arr, [17, 50, 83], axis=0)  # mm
    for j, c in enumerate(PICT):
        out[c]["slr_cm"][sc] = {
            "p17": round(float(pcts[0, j]) / 10, 1),
            "p50": round(float(pcts[1, j]) / 10, 1),
            "p83": round(float(pcts[2, j]) / 10, 1),
        }

json.dump(out, open(OUT, "w"), indent=2)
print("\n=== RSL at 2050 (cm, median [17-83]) ===")
print(f"{'ctry':<5}{'dist':>6}  {'ssp126':>16}{'ssp245':>16}{'ssp585':>16}")
for c in PICT:
    s = out[c]["slr_cm"]
    def f(x): return f"{x['p50']:.0f} [{x['p17']:.0f}-{x['p83']:.0f}]"
    print(f"{c:<5}{out[c]['dist_km']:>6.0f}  {f(s['ssp126']):>16}{f(s['ssp245']):>16}{f(s['ssp585']):>16}")
print("\nsaved", OUT)
