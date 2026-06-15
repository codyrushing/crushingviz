import json, urllib.parse, urllib.request

# GEO_PICT (alpha-2) -> ISO alpha-3 (Marine Regions iso_ter1)
PICT = {
    "AS": "ASM", "CK": "COK", "FJ": "FJI", "FM": "FSM", "GU": "GUM",
    "KI": "KIR", "MH": "MHL", "MP": "MNP", "NC": "NCL", "NR": "NRU",
    "NU": "NIU", "PF": "PYF", "PG": "PNG", "PN": "PCN", "PW": "PLW",
    "SB": "SLB", "TK": "TKL", "TO": "TON", "TV": "TUV", "VU": "VUT",
    "WF": "WLF", "WS": "WSM",
}
iso3 = sorted(PICT.values())
cql = "iso_ter1 IN (" + ",".join(f"'{c}'" for c in iso3) + ")"
base = "https://geo.vliz.be/geoserver/MarineRegions/wfs"
params = {
    "service": "WFS", "version": "2.0.0", "request": "GetFeature",
    "typeName": "MarineRegions:eez",
    "CQL_FILTER": cql,
    "outputFormat": "application/json",
    "srsName": "EPSG:4326",
}
url = base + "?" + urllib.parse.urlencode(params)
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
data = json.load(urllib.request.urlopen(req, timeout=180))
feats = data.get("features", [])
print("features returned:", len(feats))
got = {}
for ft in feats:
    iso = ft["properties"]["iso_ter1"]
    got.setdefault(iso, []).append(ft["properties"].get("pol_type"))
for c in iso3:
    pol = c in got
    print(f"  {c}: {len(got.get(c, []))} polygon(s)  {got.get(c)}")
missing = [c for c in iso3 if c not in got]
print("MISSING ISO3:", missing)
with open("/tmp/pict_eez.geojson", "w") as f:
    json.dump(data, f)
print("saved /tmp/pict_eez.geojson")
