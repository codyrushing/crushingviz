"""Merge EM-DAT economic damage data into UNDRR disaster economic loss data
to fill reporting gaps, mirroring the approach in merge_emdat.py for affected.

UNDRR non-zero values preserved as primary. EM-DAT fills zeros/missing years.

Output: derived/disaster_loss_pct_gdp_merged.json
"""

import json, os
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNDRR_LOSS_PCT = os.path.join(BASE, "derived", "disaster_loss_pct_gdp.json")
UNDRR_LOSS = os.path.join(BASE, "derived", "disaster_econ_loss_by_country.json")
EMDAT_FILE = os.path.join(BASE, "derived", "disaster_emdat_by_type.json")
GDP_FILE = os.path.join(BASE, "derived", "gdp_by_country.json")
OUT = os.path.join(BASE, "derived", "disaster_loss_pct_gdp_merged.json")


def main():
    undrr_pct = json.load(open(UNDRR_LOSS_PCT))
    undrr_loss = json.load(open(UNDRR_LOSS))
    emdat_all = json.load(open(EMDAT_FILE))
    gdp_data = json.load(open(GDP_FILE))

    emdat_damage = {}
    for c, d in emdat_all.get("countries", {}).items():
        series = d.get("all_types", {}).get("series_damage_usd", {})
        emdat_damage[c] = {int(y): v for y, v in series.items() if v and v > 0}

    gdp_usd = {}
    for c, d in gdp_data.items():
        series = d.get("gdp_usd", {})
        if not series:
            continue
        vals = sorted(series.values())
        med = vals[len(vals) // 2]
        filtered = {}
        for y, v in series.items():
            if med and (v / med > 3 or v / med < 1 / 3):
                continue
            filtered[y] = v
        gdp_usd[c] = filtered

    def gdp_for_year(country, year_str):
        g = gdp_usd.get(country, {}).get(year_str)
        if g is None and int(year_str) < 2005:
            g = gdp_usd.get(country, {}).get("2005")
        return g

    all_picts = sorted(set(list(undrr_loss.keys()) + list(emdat_damage.keys())))
    merged = {}
    fills = {}
    emdat_new_countries = []

    for pict in all_picts:
        undrr_pct_by_year = undrr_pct.get(pict, {}).get("by_year", {})
        undrr_loss_by_year = undrr_loss.get(pict, {}).get("by_year", {})
        emdat_series = emdat_damage.get(pict, {})

        by_year = {}
        sources = {}

        for y_str, entry in undrr_pct_by_year.items():
            by_year[y_str] = dict(entry)
            if undrr_loss_by_year.get(y_str, 0) > 0:
                sources[y_str] = "UNDRR"
            else:
                sources[y_str] = "UNDRR"

        for y in emdat_series:
            y_str = str(y)
            if y_str in by_year:
                continue
            emdat_val = emdat_series[y]
            if emdat_val is None or emdat_val <= 0:
                continue
            g = gdp_for_year(pict, y_str)
            by_year[y_str] = {
                "loss_usd": emdat_val,
                "gdp_usd": g,
                "pct_of_gdp": (emdat_val / g * 100) if g else None,
            }
            sources[y_str] = "EM-DAT (new year)"
            fills.setdefault(pict, {})[y_str] = emdat_val

        if not by_year:
            continue

        total_undrr_only = undrr_loss.get(pict, {}).get("total_usd", 0)
        total_merged = sum(v["loss_usd"] for v in by_year.values())

        entries_with_pct = [(y, e) for y, e in by_year.items() if e["pct_of_gdp"] is not None]
        if entries_with_pct:
            worst_year, worst = max(entries_with_pct, key=lambda x: x[1]["pct_of_gdp"])
        else:
            entries_with_loss = [(y, e) for y, e in by_year.items() if e["loss_usd"] is not None]
            if entries_with_loss:
                worst_year, worst = max(entries_with_loss, key=lambda x: x[1]["loss_usd"])
            else:
                worst_year, worst = None, None

        merged[pict] = {
            "by_year": by_year,
            "sources": sources,
            "total_loss_usd": total_merged,
            "total_undrr_loss_usd": total_undrr_only,
            "n_undrr_years": len([s for s in sources.values() if s == "UNDRR"]),
            "n_emdat_fill_years": len([s for s in sources.values() if s != "UNDRR"]),
            "worst": {
                "year": worst_year,
                "pct_of_gdp": worst["pct_of_gdp"] if worst else None,
                "loss_usd": worst["loss_usd"] if worst else None,
            },
        }

        if pict not in undrr_loss:
            emdat_new_countries.append(pict)

    out = {
        "indicator": "VC_DSR_AALT (merged with EM-DAT)",
        "label": "Direct economic loss attributed to disasters (% of GDP)",
        "source": "UNDRR (Sendai/DesInventar) + EM-DAT (CRED/UCLouvain) gap fills",
        "year_span": [
            min(int(y) for c in merged.values() for y in c["by_year"]),
            max(int(y) for c in merged.values() for y in c["by_year"]),
        ],
        "merge_note": (
            "UNDRR non-zero values preserved as primary. UNDRR zeros / missing years "
            "replaced with EM-DAT all_type damage_usd values. EM-DAT-only countries appended."
        ),
        "emdat_threshold": (
            "EM-DAT includes disasters with >=10 deaths, >=100 affected, emergency declaration, "
            "or international appeal. Smaller events may not appear."
        ),
        "pre_2005_note": (
            "Pre-2005 loss years normalized against 2005 GDP (earliest available GDP year "
            "for most PICTs). See README for details."
        ),
        "fills_summary": {c: fills[c] for c in sorted(fills)},
        "countries": dict(sorted(merged.items())),
    }

    json.dump(out, open(OUT, "w"), indent=2)
    print(f"wrote {OUT}")
    print(f"  {len(merged)} countries (UNDRR: {len(undrr_loss)}, +{len(emdat_new_countries)} new from EM-DAT: {', '.join(emdat_new_countries)})")
    n_fills = sum(len(f) for f in fills.values())
    print(f"  {n_fills} EM-DAT fills across {len(fills)} countries")
    total_undrr = sum(c["total_undrr_loss_usd"] for c in merged.values())
    total_merged = sum(c["total_loss_usd"] for c in merged.values())
    print(f"  total loss: UNDRR-only ${total_undrr/1e6:.1f}M -> merged ${total_merged/1e6:.1f}M")
    for pict in sorted(fills):
        for y, v in sorted(fills[pict].items()):
            print(f"  fill: {pict} {y}: ${v:,.0f}")


if __name__ == "__main__":
    main()
