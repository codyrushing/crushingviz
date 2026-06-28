"""Merge EM-DAT HDX Country Profiles into existing UNDRR disaster-affected data
to fill reporting gaps. The key fix: Vanuatu 2015 (Cyclone Pam) = 188,000 in EM-DAT
but 0 in UNDRR Sendai data (Vanuatu didn't report to Sendai that year).

Stdlib only. Emits derived/disaster_affected_merged.json
"""

import json
import os
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from urllib.request import urlretrieve

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EMDAT_URL = "https://data.humdata.org/dataset/74163686-a029-4e27-8fbf-c5bfcd13f953/resource/c5ce40d6-07b1-4f36-955a-d6196436ff6b/download/emdat-country-profiles_2026_06_23.xlsx"
EMDAT_PATH = os.path.join(BASE, "raw", "emdat-country-profiles.xlsx")
EXISTING = os.path.join(BASE, "derived", "disaster_affected_by_country.json")
POP = os.path.join(BASE, "derived", "population_by_country.json")
OUT = os.path.join(BASE, "derived", "disaster_affected_merged.json")

ISO3_TO_PICT = {
    "ASM": "AS",
    "COK": "CK",
    "FJI": "FJ",
    "FSM": "FM",
    "GUM": "GU",
    "KIR": "KI",
    "MHL": "MH",
    "MNP": "MP",
    "NCL": "NC",
    "NRU": "NR",
    "NIU": "NU",
    "PYF": "PF",
    "PNG": "PG",
    "PCN": "PN",
    "PLW": "PW",
    "SLB": "SB",
    "TKL": "TK",
    "TON": "TO",
    "TUV": "TV",
    "VUT": "VU",
    "WLF": "WF",
    "WSM": "WS",
}
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def cell_text(c):
    t = c.get("t")
    if t == "inlineStr":
        is_elem = c.find("s:is", NS)
        if is_elem is not None:
            return "".join(te.text or "" for te in is_elem.findall("s:t", NS))
    v = c.find("s:v", NS)
    return v.text if v is not None else ""


def parse_emdat_xlsx(path):
    z = zipfile.ZipFile(path)
    sheet = z.read("xl/worksheets/sheet1.xml")
    root = ET.fromstring(sheet)
    rows = root.findall(".//s:row", NS)
    emdat = defaultdict(lambda: defaultdict(float))
    for row in rows[2:]:
        cells = row.findall("s:c", NS)
        if len(cells) < 9:
            continue
        iso = cell_text(cells[2])
        pict = ISO3_TO_PICT.get(iso)
        if not pict:
            continue
        try:
            year = int(cell_text(cells[0]))
        except (ValueError, TypeError):
            continue
        affected_str = cell_text(cells[8])
        if not affected_str or affected_str.strip() == "":
            continue
        try:
            affected = float(affected_str)
        except ValueError:
            continue
        if affected <= 0:
            continue
        emdat[pict][year] += int(affected)
    z.close()
    return emdat


def load_existing():
    return json.load(open(EXISTING))


def load_pop():
    return json.load(open(POP))


def pop_of(pop, c, y):
    return pop.get(c, {}).get(str(y))


def merge(existing, emdat, pop):
    countries = {}
    fills = {}
    all_picts = set(list(existing["countries"].keys()) + list(emdat.keys()))
    for pict in sorted(all_picts):
        undrr_series = existing["countries"].get(pict, {}).get("series", {})
        emdat_series = emdat.get(pict, {})
        merged = {}
        sources = {}
        all_years = set(int(y) for y in undrr_series.keys()) | set(emdat_series.keys())
        for y in sorted(all_years):
            undrr_val = int(undrr_series.get(str(y), -1))
            emdat_val = emdat_series.get(y, -1)
            if undrr_val >= 0:
                if undrr_val > 0:
                    merged[y] = undrr_val
                    sources[y] = "UNDRR"
                elif emdat_val > 0:
                    merged[y] = int(emdat_val)
                    sources[y] = "EM-DAT (gap fill)"
                    fills.setdefault(pict, {})[y] = int(emdat_val)
                else:
                    merged[y] = 0
                    sources[y] = "UNDRR"
            elif emdat_val > 0:
                merged[y] = int(emdat_val)
                sources[y] = "EM-DAT (new year)"
                fills.setdefault(pict, {})[y] = int(emdat_val)
            else:
                continue
        cum = sum(merged.values())
        pref = pop_of(pop, pict, 2014)
        big_y = max(merged, key=lambda y: merged[y])
        big = merged[big_y]
        pbig = pop_of(pop, pict, big_y) or pref
        countries[pict] = {
            "series": {str(y): merged[y] for y in sorted(merged)},
            "sources": {str(y): sources[y] for y in sorted(merged)},
            "years_reported": len(merged),
            "cumulative": cum,
            "pop_ref_2014": int(pref) if pref else None,
            "cumulative_per_capita": round(cum / pref, 3) if pref else None,
            "biggest": {
                "year": big_y,
                "count": big,
                "pct_of_pop": round(100 * big / pbig, 1) if pbig else None,
            },
        }
    return countries, fills


def main():
    if not os.path.exists(EMDAT_PATH):
        print("downloading EM-DAT country profiles ...")
        urlretrieve(EMDAT_URL, EMDAT_PATH)
        print("downloaded", EMDAT_PATH)
    emdat = parse_emdat_xlsx(EMDAT_PATH)
    print(
        f"parsed {sum(len(v) for v in emdat.values())} country-year entries from EM-DAT"
    )
    existing = load_existing()
    pop = load_pop()
    countries, fills = merge(existing, emdat, pop)
    by_year = defaultdict(float)
    for c, data in countries.items():
        for y, v in data["series"].items():
            by_year[int(y)] += v
    out = {
        "indicator": "VC_DSR_AFFCT (merged with EM-DAT)",
        "label": "Number of directly affected persons attributed to disasters",
        "source": "UNDRR (Sendai/DesInventar) + EM-DAT (CRED/UCLouvain) gap fills",
        "year_span": [min(by_year), max(by_year)],
        "merge_note": "UNDRR zeros that correspond to known disasters were replaced with EM-DAT values. UNDRR non-zero values retained as primary. EM-DAT-only years appended where UNDRR has no reporting.",
        "emdat_threshold": "EM-DAT includes disasters with >=10 deaths, >=100 affected, emergency declaration, or international appeal. Smaller events (captured in UNDRR) may not appear here.",
        "fills_summary": {c: fills[c] for c in sorted(fills)},
        "countries": countries,
        "regional_by_year": {str(y): int(by_year[y]) for y in sorted(by_year)},
    }
    json.dump(out, open(OUT, "w"), indent=2)
    print(f"wrote {OUT} — {len(countries)} countries")
    n_fills = sum(len(f) for f in fills.values())
    print(f"filled {n_fills} gaps across {len(fills)} countries:")
    for pict in sorted(fills):
        for y, v in sorted(fills[pict].items()):
            print(f"  {pict} {y}: {v:,} (was 0/missing in UNDRR)")
    print(
        "Vanuatu 2015 (Cyclone Pam):", countries["VU"]["series"].get("2015"), "← was 0"
    )


if __name__ == "__main__":
    main()
