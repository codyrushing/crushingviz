"""Build per-country per-year flood-related damage as % of GDP from EM-DAT.

Uses EM-DAT's flood_relevant aggregate (Storm + Flood + Mass movement wet) —
the appropriate scope for Pacific flooding since most flood damage is cyclone-driven.

No UNDRR merge needed: UNDRR/Sendai reports total loss only, not by disaster type.
Purely EM-DAT-based with GDP joins.

Output: derived/flood_loss_pct_gdp.json
"""

import json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EMDAT_FILE = os.path.join(BASE, "derived", "disaster_emdat_by_type.json")
GDP_FILE = os.path.join(BASE, "derived", "gdp_by_country.json")
OUT = os.path.join(BASE, "derived", "flood_loss_pct_gdp.json")


def main():
    emdat_all = json.load(open(EMDAT_FILE))
    gdp_data = json.load(open(GDP_FILE))

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

    countries = {}
    for pict, c in emdat_all.get("countries", {}).items():
        fr = c.get("flood_relevant", {})
        series = fr.get("series_damage_usd", {})
        if not series:
            continue

        by_year = {}
        for y_str, v in series.items():
            if v is None or v <= 0:
                continue
            g = gdp_for_year(pict, y_str)
            by_year[y_str] = {
                "loss_usd": v,
                "gdp_usd": g,
                "pct_of_gdp": (v / g * 100) if g else None,
            }

        if not by_year:
            continue

        entries_with_pct = [(y, e) for y, e in by_year.items() if e["pct_of_gdp"] is not None]
        if entries_with_pct:
            worst_year, worst = max(entries_with_pct, key=lambda x: x[1]["pct_of_gdp"])
        else:
            entries_with_loss = [(y, e) for y, e in by_year.items() if e["loss_usd"] is not None]
            if entries_with_loss:
                worst_year, worst = max(entries_with_loss, key=lambda x: x[1]["loss_usd"])
            else:
                worst_year, worst = None, None

        countries[pict] = {
            "by_year": by_year,
            "sources": {y: "EM-DAT (flood_relevant)" for y in by_year},
            "total_loss_usd": sum(v["loss_usd"] for v in by_year.values()),
            "n_years": len(by_year),
            "worst": {
                "year": worst_year,
                "pct_of_gdp": worst["pct_of_gdp"] if worst else None,
                "loss_usd": worst["loss_usd"] if worst else None,
            },
        }

    out = {
        "indicator": "Flood-relevant damage as % of GDP (EM-DAT)",
        "label": "Direct economic loss from flood-relevant disasters (% of GDP)",
        "source": "EM-DAT (CRED/UCLouvain)",
        "flood_definition": emdat_all.get("flood_relevant_definition", ""),
        "year_span": [
            min(int(y) for c in countries.values() for y in c["by_year"]),
            max(int(y) for c in countries.values() for y in c["by_year"]),
        ],
        "emdat_threshold": emdat_all.get("emdat_threshold", ""),
        "pre_2005_note": (
            "Pre-2005 loss years normalized against 2005 GDP (earliest available GDP year "
            "for most PICTs). See README for details."
        ),
        "countries": dict(sorted(countries.items())),
    }

    json.dump(out, open(OUT, "w"), indent=2)
    print(f"wrote {OUT}")
    print(f"  {len(countries)} countries")
    for pict, c in sorted(countries.items()):
        years = list(c["by_year"].keys())
        y_span = f"{years[0]}-{years[-1]}"
        pct_str = f"{c['worst']['pct_of_gdp']:.2f}%" if c['worst']['pct_of_gdp'] else "null"
        print(f"  {pict}: {c['n_years']} years ({y_span}), ${c['total_loss_usd']/1e6:.1f}M total, worst={c['worst']['year']} ({pct_str})")


if __name__ == "__main__":
    main()
