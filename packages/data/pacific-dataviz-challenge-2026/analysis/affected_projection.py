"""Project flood-affected population (person-incidents) 2025-2050.

Combines three layers per country:
  1. Baseline flood burden: mean annual EM-DAT `flood_relevant` affected
     over 2000-2024 (2025+ excluded; incomplete years).
  2. Exposure growth: exposed(t) = static LECZ% x SPC yearly population
     projection (follows the real demographic curve, not a straight line).
  3. Flood-frequency amplification: AF(t) = af ^ ((t-2020)/30), ramping
     exponentially from 1 in 2020 to af_central (or af_range bound) in 2050.
     Valid because AF = 2^(SLR/D) is exponential in SLR and AR6 SLR ramps
     ~linearly to 2050, so the time-interpolation is a simple power curve.

  affected(t) = baseline_annual_affected x (exposed(t) / baseline_exposed) x AF(t)

Also emits a return-period framing per country (no baseline rate needed):
today's worst flood was a ~1-in-25-yr event; by 2050 that class arrives
~af_central times more often.

Output: derived/affected_projection_2050.json
Illustrative, not site-calibrated (Vitousek et al. 2017; Taherkhani et al. 2020).
"""
import json

BASE = ("/home/codyrushing/Projects/crushingviz/packages/data/"
        "pacific-dataviz-challenge-2026/derived/")
rt = json.load(open(BASE + "risk_trajectory_2050.json"))
pop = json.load(open(BASE + "population_by_country.json"))
emdat = json.load(open(BASE + "disaster_emdat_by_type.json"))

WINDOW = (2000, 2024)          # baseline window; 2025+ incomplete in EM-DAT
N_WINDOW = WINDOW[1] - WINDOW[0] + 1
T0, T1 = 2020, 2050            # AF ramp anchors (AF=1 at T0, af at T1)
YEARS = list(range(2025, T1 + 1))
FLOOD_RELEVANT_TYPES = {"Storm", "Flood", "Mass movement (wet)"}

names = {"MH": "Marshall Is.", "TV": "Tuvalu", "KI": "Kiribati", "NR": "Nauru",
         "FM": "FSM", "PF": "Fr. Polynesia", "TO": "Tonga", "WS": "Samoa", "FJ": "Fiji",
         "SB": "Solomon Is.", "VU": "Vanuatu", "CK": "Cook Is.", "AS": "Am. Samoa",
         "PW": "Palau", "NC": "New Caledonia", "MP": "N. Marianas", "PG": "PNG",
         "GU": "Guam", "NU": "Niue", "WF": "Wallis & F.", "TK": "Tokelau", "PN": "Pitcairn"}


def ramp_af(af_2050, t):
    """AF at year t: exponential ramp 1 -> af_2050 over T0..T1."""
    return af_2050 ** ((t - T0) / (T1 - T0))


out = {}
for c, r in rt.items():
    pct10 = r["pct_below_10m"]
    af_c, (af_lo, af_hi) = r["af_central"], r["af_range"]
    e = emdat["countries"].get(c)

    # --- baseline flood burden (EM-DAT flood_relevant, 2000-2024) ---
    if e is None:
        out[c] = {"no_emdat_records": True,
                  "note": "No EM-DAT disaster records for this country; projection not computed.",
                  "pct_below_10m": pct10, "af_central": af_c, "af_range": r["af_range"]}
        continue

    fr = e["flood_relevant"]["series_affected"]
    total = sum(v for y, v in fr.items() if WINDOW[0] <= int(y) <= WINDOW[1])
    R = total / N_WINDOW          # mean annual affected, zero years included
    baseline_events = sum(
        ev["events_count"] for ev in e["events"]
        if WINDOW[0] <= ev["year"] <= WINDOW[1] and ev["type"] in FLOOD_RELEVANT_TYPES)

    # --- baseline exposure: mean annual exposed pop over the window ---
    base_exposed = pct10 / 100 * sum(pop[c][str(y)] for y in range(WINDOW[0], WINDOW[1] + 1)) / N_WINDOW

    # --- yearly trajectory 2025-2050 ---
    series, series_lo, series_hi = {}, {}, {}
    for t in YEARS:
        exposed = pct10 / 100 * pop[c][str(t)]
        scale = exposed / base_exposed if base_exposed else 0
        series[t] = {"exposed": round(exposed),
                     "af": round(ramp_af(af_c, t), 2),
                     "affected": round(R * scale * ramp_af(af_c, t))}
        series_lo[t] = {"affected": round(R * scale * ramp_af(af_lo, t))}
        series_hi[t] = {"affected": round(R * scale * ramp_af(af_hi, t))}

    cum = {k: sum(s[t]["affected"] for t in YEARS)
           for k, s in (("central", series), ("low", series_lo), ("high", series_hi))}

    # --- return-period framing: worst EM-DAT Flood event in the window ---
    flood_years = e["by_type"].get("Flood", {}).get("series_affected", {})
    in_window = {int(y): v for y, v in flood_years.items() if WINDOW[0] <= int(y) <= WINDOW[1]}
    if in_window:
        yr = max(in_window, key=in_window.get)
        worst = {"year": yr, "affected": in_window[yr],
                 "return_period_today_yrs": N_WINDOW,
                 "return_period_2050_yrs": round(N_WINDOW / af_c, 1)}
    else:
        worst = None

    out[c] = {
        "baseline_window": list(WINDOW),
        "baseline_annual_affected": round(R),
        "baseline_events": baseline_events,
        "baseline_exposed_pop": round(base_exposed),
        "pct_below_10m": pct10,
        "af_central": af_c, "af_range": r["af_range"],
        "small_n_flag": baseline_events < 3,
        "series": series, "series_low": series_lo, "series_high": series_hi,
        "cumulative_affected": cum,
        "affected_2050_vs_baseline": round(series[T1]["affected"] / R, 1) if R else None,
        "worst_historical_flood": worst,
    }

# --- regional roll-up (countries with projections only) ---
proj = {c: v for c, v in out.items() if "series" in v}
reg_series = {t: {"affected": sum(v["series"][t]["affected"] for v in proj.values())} for t in YEARS}
reg_lo = {t: {"affected": sum(v["series_low"][t]["affected"] for v in proj.values())} for t in YEARS}
reg_hi = {t: {"affected": sum(v["series_high"][t]["affected"] for v in proj.values())} for t in YEARS}

result = {
    "indicator": "Projected flood-affected population (person-incidents) 2025-2050",
    "label": ("Historical EM-DAT flood burden scaled by exposure growth x "
              "time-varying flood-frequency amplification"),
    "source": ("EM-DAT (CRED/UCLouvain) via HDX Country Profiles; SPC DF_POP_PROJ; "
               "IPCC AR6 RSL; Vitousek et al. 2017; Taherkhani et al. 2020"),
    "method": {
        "af_t": "af_central^((t-2020)/30) -- exponential ramp from 1 in 2020 to af_central in 2050; valid because AF=2^(SLR/D) is exponential in SLR and AR6 SLR ramps ~linearly to 2050",
        "exposed_t": "pct_below_10m/100 x SPC yearly population projection (static LECZ share; follows the real demographic curve, not a linear endpoint interpolation)",
        "affected_t": "baseline_annual_affected x (exposed_t / baseline_exposed_pop) x af_t",
        "af_source": "af_central / af_range from risk_trajectory_2050.json (doubling interval D=5/8/10 cm, central 8)",
        "baseline": "mean annual EM-DAT flood_relevant affected over 2000-2024 (25 yrs, zero years included; 2025+ excluded as incomplete)",
        "return_period": "worst EM-DAT Flood event in window treated as 1-in-25-yr; 2050 return period = 25 / af_central",
    },
    "caveat": ("Illustrative, not site-calibrated. Affected = person-incidents "
               "(EM-DAT repeat/overlap counting). flood_relevant includes tropical-cyclone "
               "wind/crop damage not driven by SLR. Assumes per-event affected size stays "
               "constant; only frequency scales. AF ramp treats SLR as zero at 2020, "
               "excluding the few cm of pre-2020 rise since the AR6 baseline (~1995-2011) -- "
               "slightly conservative. LECZ share held static (no coastal-migration projection). "
               "Small-n countries (see small_n_flag / baseline_events) rest on 1-2 events; "
               "prefer the return_period framing for those."),
    "countries": out,
    "regional": {
        "series": reg_series, "series_low": reg_lo, "series_high": reg_hi,
        "cumulative_affected": {
            "central": sum(v["cumulative_affected"]["central"] for v in proj.values()),
            "low": sum(v["cumulative_affected"]["low"] for v in proj.values()),
            "high": sum(v["cumulative_affected"]["high"] for v in proj.values()),
        },
    },
}

json.dump(result, open(BASE + "affected_projection_2050.json", "w"), indent=2)

print("PROJECTED FLOOD-AFFECTED POPULATION 2025-2050 (illustrative; central D=8cm)\n")
print(f"{'country':<15}{'base/yr':>9}{'events':>7}{'2050/yr':>9}{'cum 25-50':>11}{'low':>9}{'high':>9}  flag")
for c, v in sorted(proj.items(), key=lambda kv: -kv[1]["cumulative_affected"]["central"]):
    flag = "small-n" if v["small_n_flag"] else ""
    print(f"{names.get(c, c):<15}{v['baseline_annual_affected']:>9,}{v['baseline_events']:>7}"
          f"{v['series'][T1]['affected']:>9,}{v['cumulative_affected']['central']:>11,}"
          f"{v['cumulative_affected']['low']:>9,}{v['cumulative_affected']['high']:>9,}  {flag}")
reg = result["regional"]["cumulative_affected"]
print(f"{'REGIONAL':<15}{'':>9}{'':>7}{'':>9}{reg['central']:>11,}{reg['low']:>9,}{reg['high']:>9,}")
print(f"\nNo EM-DAT records (excluded): {[c for c, v in out.items() if v.get('no_emdat_records')]}")
print("saved derived/affected_projection_2050.json")
