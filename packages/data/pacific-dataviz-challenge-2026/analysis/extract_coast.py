import math, gzip, json
import numpy as np
from collections import defaultdict
from pmtiles.reader import MmapSource, all_tiles
import mapbox_vector_tile
from shapely.geometry import shape, Point
from shapely import STRtree

PM = "/home/codyrushing/Projects/crushingviz/packages/data/pacific-dataviz-challenge-2026/dep_ls_coastlines_0-7-0-55.pmtiles"
ZOOM = 11
LAYER = "rates_of_change"
SIG_P = 0.01  # DEA Coastlines: trend significant if p <= 0.01

ISO2 = {  # iso3 -> alpha2 (GEO_PICT)
    "ASM": "AS", "COK": "CK", "FJI": "FJ", "FSM": "FM", "GUM": "GU",
    "KIR": "KI", "MHL": "MH", "MNP": "MP", "NCL": "NC", "NRU": "NR",
    "NIU": "NU", "PYF": "PF", "PNG": "PG", "PCN": "PN", "PLW": "PW",
    "SLB": "SB", "TKL": "TK", "TON": "TO", "TUV": "TV", "VUT": "VU",
    "WLF": "WF", "WSM": "WS",
}

# --- load EEZ polygons ---
gj = json.load(open("/tmp/pict_eez.geojson"))
polys, poly_iso = [], []
for ft in gj["features"]:
    iso = ft["properties"]["iso_ter1"]
    polys.append(shape(ft["geometry"]))
    poly_iso.append(ISO2[iso])
tree = STRtree(polys)
print(f"loaded {len(polys)} EEZ polygons")

# --- extract points from tiles ---
def tile_to_lonlat(z, x, y, px, py, extent):
    wx = (x + px / extent) / (2 ** z)
    wy = (y + py / extent) / (2 ** z)
    lon = wx * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * wy))))
    return lon, lat

lons, lats, rates, sigs = [], [], [], []
ntiles = 0
with open(PM, "rb") as f:
    src = MmapSource(f)
    for (z, x, y), data in all_tiles(src):
        if z != ZOOM:
            continue
        ntiles += 1
        try:
            tile = mapbox_vector_tile.decode(gzip.decompress(data))
        except OSError:
            tile = mapbox_vector_tile.decode(data)
        layer = tile.get(LAYER)
        if not layer:
            continue
        ext = layer.get("extent", 4096)
        for ft in layer["features"]:
            g = ft["geometry"]
            if g["type"] != "Point":
                continue
            cx, cy = g["coordinates"]
            lon, lat = tile_to_lonlat(z, x, y, cx, cy, ext)
            p = ft["properties"]
            lons.append(lon); lats.append(lat)
            rates.append(p.get("rate_time")); sigs.append(p.get("sig_time"))

lons = np.array(lons); lats = np.array(lats)
rates = np.array([np.nan if r is None else r for r in rates], dtype=float)
sigs = np.array([np.nan if s is None else s for s in sigs], dtype=float)
print(f"z{ZOOM}: {ntiles} tiles, {len(lons)} points")

# --- vectorized point-in-polygon ---
# shapely 2.x: predicate is point.predicate(polygon); array query returns
# rows (input_idx, tree_idx).
pts = np.array([Point(xy) for xy in zip(lons, lats)], dtype=object)
res = tree.query(pts, predicate="intersects")
input_idx, tree_idx = res[0], res[1]
country = np.array([None] * len(pts), dtype=object)
country[input_idx] = [poly_iso[i] for i in tree_idx]
matched = np.sum(country != None)
print(f"matched to a country: {matched} ({100*matched/len(pts):.1f}%)")

# --- aggregate per country ---
out = {}
for c in sorted(set(poly_iso)):
    m = country == c
    r = rates[m]; s = sigs[m]
    r = r[~np.isnan(r)]
    valid = m & ~np.isnan(rates) & ~np.isnan(sigs)
    rv = rates[valid]; sv = sigs[valid]
    sig = sv <= SIG_P
    rsig = rv[sig]
    out[c] = {
        "n": int(m.sum()),
        "n_sig": int(sig.sum()),
        "median_rate": round(float(np.median(r)), 3) if len(r) else None,
        "median_rate_sig": round(float(np.median(rsig)), 3) if len(rsig) else None,
        "pct_eroding": round(100*float(np.mean(r < 0)), 1) if len(r) else None,
        "pct_eroding_sig": round(100*float(np.mean(rsig < 0)), 1) if len(rsig) else None,
    }

json.dump(out, open("/tmp/coast_by_country.json", "w"), indent=2)
print(f"\n{'ctry':<6}{'n':>8}{'n_sig':>8}{'medRate':>9}{'medRateSig':>11}{'%erode':>8}{'%erodeSig':>10}")
for c, v in sorted(out.items(), key=lambda kv: (kv[1]['median_rate_sig'] if kv[1]['median_rate_sig'] is not None else 0)):
    print(f"{c:<6}{v['n']:>8}{v['n_sig']:>8}{str(v['median_rate']):>9}{str(v['median_rate_sig']):>11}{str(v['pct_eroding']):>8}{str(v['pct_eroding_sig']):>10}")
print("\nsaved /tmp/coast_by_country.json")
