"""Re-extract EM-DAT preserving disaster type/subtype, and group events into
flood-relevant vs. other categories. The existing merge_emdat.py aggregates all
disaster types into one count, which conflates cyclones, floods, droughts,
earthquakes, and volcanic events. For a flood-risk spine we need the
flood-relevant subset isolated.

EM-DAT HDX Country Profiles (already downloaded by merge_emdat.py):
  raw/emdat-country-profiles.xlsx

Each xlsx row = one country-year-disaster-type record (Total Events may be >1
when multiple events of that subtype hit the same country in the same year).

Columns:
  [0] Year  [1] Country  [2] ISO
  [3] Disaster Group  [4] Disaster Subgroup
  [5] Disaster Type  [6] Disaster Subtype
  [7] Total Events  [8] Total Affected  [9] Total Deaths
  [10] Total Damage (USD, original)  [11] Total Damage (USD, adjusted)

Disaster-type grouping for the flood spine:
  flood_relevant     = Storm + Flood + Mass movement (wet)
    rationale: tropical cyclones drive storm surge + coastal flooding; the
    "affected" count for cyclones includes flood victims but also wind/crop
    damage -- not a pure flood count, but the flood component is real and
    these are the events SLR amplifies via surge. Use the narrower
    coastal_flood_subset (Coastal flood + Storm surge) for a strict
    flood-only count (very small n).
  coastal_flood_only = Coastal flood + Storm surge (strict; ~96k affected)
  non_flood          = everything else (Drought, Earthquake, Volcanic, etc.)

Also joins flood_relevant damage to same-year USD GDP for pct_of_gdp, reusing
the corrupt-row exclusion logic from extract_economic.py (VU 2018 USD reads
$95M between two $935M years -- off-by-10x export glitch).

Emits derived/disaster_emdat_by_type.json. Stdlib only.
"""

import json
import os
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EMDAT_PATH = os.path.join(BASE, "raw", "emdat-country-profiles.xlsx")
POP = os.path.join(BASE, "derived", "population_by_country.json")
GDP = os.path.join(BASE, "derived", "gdp_by_country.json")
OUT = os.path.join(BASE, "derived", "disaster_emdat_by_type.json")

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

FLOOD_RELEVANT_TYPES = {"Storm", "Flood", "Mass movement (wet)"}
COASTAL_FLOOD_SUBTYPES = {"Coastal flood", "Storm surge"}


def cell_text(c):
    t = c.get("t")
    if t == "inlineStr":
        is_elem = c.find("s:is", NS)
        if is_elem is not None:
            return "".join(te.text or "" for te in is_elem.findall("s:t", NS))
    v = c.find("s:v", NS)
    return v.text if v is not None else ""


def fnum(s):
    if s is None or s == "":
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def parse_emdat(path):
    """Return list of event dicts for PICTs."""
    z = zipfile.ZipFile(path)
    sheet = z.read("xl/worksheets/sheet1.xml")
    root = ET.fromstring(sheet)
    rows = root.findall(".//s:row", NS)
    events = []
    for r in rows[2:]:  # skip header + HXL tag rows
        cells = r.findall("s:c", NS)
        if len(cells) < 11:
            continue
        iso = cell_text(cells[2])
        pict = ISO3_TO_PICT.get(iso)
        if not pict:
            continue
        year = fnum(cell_text(cells[0]))
        if year is None:
            continue
        events.append(
            {
                "pict": pict,
                "year": int(year),
                "group": cell_text(cells[3]),
                "subgroup": cell_text(cells[4]),
                "type": cell_text(cells[5]),
                "subtype": cell_text(cells[6]),
                "events_count": int(fnum(cell_text(cells[7])) or 1),
                "affected": int(fnum(cell_text(cells[8])) or 0),
                "deaths": int(fnum(cell_text(cells[9])) or 0),
                "damage_usd": fnum(cell_text(cells[10])),
            }
        )
    z.close()
    return events


def load_pop():
    return json.load(open(POP))


def pop_of(pop, c, y):
    return pop.get(c, {}).get(str(y))


def is_flood_relevant(ev):
    return ev["type"] in FLOOD_RELEVANT_TYPES


def is_coastal_flood(ev):
    return ev["subtype"] in COASTAL_FLOOD_SUBTYPES


def aggregate_events(events):
    """Group event records by year (summing affected/deaths/damage/events_count).
    Returns (series_affected, series_deaths, series_damage, total_events_count,
             total_affected, biggest_year_dict)."""
    by_year = defaultdict(
        lambda: {"affected": 0, "deaths": 0, "damage_usd": 0.0, "events": 0}
    )
    for ev in events:
        b = by_year[ev["year"]]
        b["affected"] += ev["affected"]
        b["deaths"] += ev["deaths"]
        if ev["damage_usd"] is not None:
            b["damage_usd"] += ev["damage_usd"]
        b["events"] += ev["events_count"]
    series_aff = {str(y): by_year[y]["affected"] for y in sorted(by_year)}
    series_dth = {str(y): by_year[y]["deaths"] for y in sorted(by_year)}
    series_dmg = {str(y): round(by_year[y]["damage_usd"], 2) for y in sorted(by_year)}
    total_aff = sum(b["affected"] for b in by_year.values())
    total_dmg = round(sum(b["damage_usd"] for b in by_year.values()), 2)
    total_events = sum(b["events"] for b in by_year.values())
    biggest = None
    if by_year:
        by = max(by_year, key=lambda y: by_year[y]["affected"])
        biggest = {
            "year": by,
            "count": by_year[by]["affected"],
            "events": by_year[by]["events"],
        }
    return {
        "series_affected": series_aff,
        "series_deaths": series_dth,
        "series_damage_usd": series_dmg,
        "total_affected": total_aff,
        "total_damage_usd": total_dmg,
        "total_events": total_events,
        "years_reported": len(by_year),
        "biggest": biggest,
    }


def build_country(events_for_country, pop, pict):
    """Per-country panel: by_type, flood_relevant, coastal_flood_only, all_types."""
    by_type = defaultdict(list)
    for ev in events_for_country:
        by_type[ev["type"]].append(ev)

    type_panels = {}
    for dtype, evs in by_type.items():
        agg = aggregate_events(evs)
        # biggest with pct_of_pop
        if agg["biggest"]:
            by = agg["biggest"]["year"]
            pbig = pop_of(pop, pict, by) or pop_of(pop, pict, 2014)
            agg["biggest"]["pct_of_pop"] = (
                round(100 * agg["biggest"]["count"] / pbig, 1) if pbig else None
            )
        type_panels[dtype] = agg

    flood_rel_events = [ev for ev in events_for_country if is_flood_relevant(ev)]
    coastal_events = [ev for ev in events_for_country if is_coastal_flood(ev)]

    flood_rel = aggregate_events(flood_rel_events)
    coastal = aggregate_events(coastal_events)
    all_agg = aggregate_events(events_for_country)

    for panel, evs in (
        (flood_rel, flood_rel_events),
        (coastal, coastal_events),
        (all_agg, events_for_country),
    ):
        if panel["biggest"]:
            by = panel["biggest"]["year"]
            pbig = pop_of(pop, pict, by) or pop_of(pop, pict, 2014)
            panel["biggest"]["pct_of_pop"] = (
                round(100 * panel["biggest"]["count"] / pbig, 1) if pbig else None
            )

    # per-event detail for annotation (sorted by year, then affected desc)
    event_detail = sorted(
        [
            {
                "year": ev["year"],
                "type": ev["type"],
                "subtype": ev["subtype"],
                "events_count": ev["events_count"],
                "affected": ev["affected"],
                "deaths": ev["deaths"],
                "damage_usd": round(ev["damage_usd"], 2)
                if ev["damage_usd"] is not None
                else None,
            }
            for ev in events_for_country
            if ev["affected"] > 0 or ev["deaths"] > 0
        ],
        key=lambda e: (e["year"], -e["affected"]),
    )

    return {
        "by_type": type_panels,
        "flood_relevant": flood_rel,
        "coastal_flood_only": coastal,
        "all_types": all_agg,
        "events": event_detail,
    }


def build_gdp_join(events, gdp_usd_year):
    """Join flood_relevant damage to same-year USD GDP -> pct_of_gdp.
    gdp_usd_year: {(pict, year_str): gdp_usd_value} with suspect rows excluded."""
    by_country_year = defaultdict(float)
    for ev in events:
        if is_flood_relevant(ev) and ev["damage_usd"] is not None:
            by_country_year[(ev["pict"], ev["year"])] += ev["damage_usd"]

    join = {}
    for (pict, year), dmg in by_country_year.items():
        g = gdp_usd_year.get((pict, str(year)))
        join.setdefault(pict, {})[str(year)] = {
            "flood_damage_usd": round(dmg, 2),
            "gdp_usd": g,
            "pct_of_gdp": round(dmg / g * 100, 2) if g else None,
        }
    # attach worst-year summary per country
    for pict, yrs in join.items():
        valid = [(y, e) for y, e in yrs.items() if e["pct_of_gdp"] is not None]
        if valid:
            wy, we = max(valid, key=lambda x: x[1]["pct_of_gdp"])
            yrs["_worst"] = {"year": wy, **we}
    return join


def load_gdp_usd_year():
    """Load gdp_by_country.json and return {(pict, year): gdp_usd} excluding
    suspect off-by-10x rows (deviation >3x from series median). Mirrors
    extract_economic.py."""
    g = json.load(open(GDP))
    out = {}
    suspect = []
    for pict, d in g.items():
        series = d.get("gdp_usd", {})
        if not series:
            continue
        vals = sorted(series.values())
        med = vals[len(vals) // 2]
        for y, v in series.items():
            if med and (v / med > 3 or v / med < 1 / 3):
                suspect.append((pict, y, v, med))
                continue
            out[(pict, y)] = v
    if suspect:
        print("GDP USD rows flagged as suspect (excluded from flood-damage join):")
        for pict, y, v, med in suspect:
            print(f"  {pict} {y}: ${v / 1e6:.1f}M vs series median ${med / 1e6:.1f}M")
    return out


def main():
    if not os.path.exists(EMDAT_PATH):
        raise SystemExit(
            f"missing {EMDAT_PATH} -- run merge_emdat.py first to download"
        )
    events = parse_emdat(EMDAT_PATH)
    print(f"parsed {len(events)} EM-DAT rows for PICTs")
    pop = load_pop()
    gdp_usd_year = load_gdp_usd_year()

    by_country_events = defaultdict(list)
    for ev in events:
        by_country_events[ev["pict"]].append(ev)

    countries = {}
    for pict in sorted(by_country_events):
        countries[pict] = build_country(by_country_events[pict], pop, pict)

    # Regional by_year by category
    regional = defaultdict(lambda: defaultdict(int))
    for ev in events:
        y = ev["year"]
        regional["all"][y] += ev["affected"]
        if is_flood_relevant(ev):
            regional["flood_relevant"][y] += ev["affected"]
        if is_coastal_flood(ev):
            regional["coastal_flood_only"][y] += ev["affected"]
        regional[ev["type"]][y] += ev["affected"]
    regional_out = {
        cat: {str(y): v for y, v in sorted(d.items())} for cat, d in regional.items()
    }

    # Regional damage by type
    damage_by_type = defaultdict(float)
    for ev in events:
        if ev["damage_usd"] is not None:
            damage_by_type[ev["type"]] += ev["damage_usd"]
    damage_out = {
        t: round(v, 2) for t, v in sorted(damage_by_type.items(), key=lambda x: -x[1])
    }

    # Flood-relevant damage -> % GDP join
    gdp_join = build_gdp_join(events, gdp_usd_year)

    year_span = [min(ev["year"] for ev in events), max(ev["year"] for ev in events)]
    out = {
        "indicator": "EM-DAT disaster events by type (PICTs)",
        "label": "Disaster events from EM-DAT HDX Country Profiles, preserving disaster type/subtype",
        "source": "EM-DAT (CRED/UCLouvain) via HDX Country Profiles, 2000-2026",
        "emdat_threshold": "EM-DAT includes disasters with >=10 deaths, >=100 affected, emergency declaration, or international appeal. Smaller events may not appear.",
        "year_span": year_span,
        "flood_relevant_definition": "Storm + Flood + Mass movement (wet) -- events where coastal flooding / storm surge is a component. Tropical cyclone 'affected' includes wind/crop/displacement damage too, not only flood victims.",
        "coastal_flood_only_definition": "Coastal flood + Storm surge subtypes only (strict flood-only count; small n).",
        "caveat": "Affected counts >100% of population = affected-person-incidents (repeat/overlap counting), not unique people. UNDRR captures smaller events below EM-DAT's threshold; this file is EM-DAT-only -- see disaster_affected_merged.json for the UNDRR+EM-DAT superset (but that file does not preserve disaster type).",
        "regional_by_year_affected": regional_out,
        "regional_damage_usd_by_type": damage_out,
        "flood_damage_pct_gdp": gdp_join,
        "countries": countries,
    }
    json.dump(out, open(OUT, "w"), indent=2)
    print(
        f"wrote {OUT} -- {len(countries)} countries, years {year_span[0]}-{year_span[1]}"
    )

    # summary
    print("\nRegional affected totals by disaster type:")
    type_totals = defaultdict(int)
    for ev in events:
        type_totals[ev["type"]] += ev["affected"]
    for t, n in sorted(type_totals.items(), key=lambda x: -x[1]):
        print(f"  {t:<28} {n:>12,}")
    fr = sum(ev["affected"] for ev in events if is_flood_relevant(ev))
    cf = sum(ev["affected"] for ev in events if is_coastal_flood(ev))
    all_aff = sum(ev["affected"] for ev in events)
    print(
        f"  {'flood_relevant (Storm+Flood+MMwet)':<28} {fr:>12,}  ({fr / all_aff * 100:.0f}%)"
    )
    print(
        f"  {'coastal_flood_only (strict)':<28} {cf:>12,}  ({cf / all_aff * 100:.0f}%)"
    )
    print(f"  {'ALL':<28} {all_aff:>12,}")

    print("\nRegional damage (USD original) by type:")
    for t, v in sorted(damage_by_type.items(), key=lambda x: -x[1]):
        print(f"  {t:<28} ${v / 1e6:>10,.1f}M")

    print("\nFlood-relevant damage as % of GDP (worst year per country):")
    for pict in sorted(gdp_join):
        w = gdp_join[pict].get("_worst")
        if w and w["pct_of_gdp"] is not None:
            print(
                f"  {pict} {w['year']}: ${w['flood_damage_usd'] / 1e6:,.1f}M = {w['pct_of_gdp']:.1f}% of GDP"
            )


if __name__ == "__main__":
    main()
