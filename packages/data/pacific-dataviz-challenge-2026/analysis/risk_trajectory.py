"""Integrate the spine: exposed population x relative SLR x flood-frequency
amplification, to 2050.

Layers:
  1. exposed pop = LECZ% (static) x population projection (2020 -> 2050)
  2. RSL 2050 = AR6 wf_1e SSP2-4.5 median (cm)
  3. AF = 2^(SLR / D) flood-frequency amplification (Vitousek 2017 /
     Taherkhani 2020); D = doubling interval cm; tropical Pacific sensitive end.

Output: derived/risk_trajectory_2050.json
"""
import json

BASE = ("/home/codyrushing/Projects/crushingviz/packages/data/"
        "pacific-dataviz-challenge-2026/derived/")
pop = json.load(open(BASE + "population_by_country.json"))
lecz = json.load(open(BASE + "pop_lecz_by_country.json"))
slr = json.load(open(BASE + "slr_2050_by_country.json"))

D_RANGE = [5, 8, 10]        # doubling interval (cm); 8 central
D_CENTRAL = 8

names = {"MH":"Marshall Is.","TV":"Tuvalu","KI":"Kiribati","NR":"Nauru",
         "FM":"FSM","PF":"Fr. Polynesia","TO":"Tonga","WS":"Samoa","FJ":"Fiji",
         "SB":"Solomon Is.","VU":"Vanuatu","CK":"Cook Is.","AS":"Am. Samoa",
         "PW":"Palau","NC":"New Caledonia","MP":"N. Marianas","PG":"PNG",
         "GU":"Guam","NU":"Niue","WF":"Wallis & F.","TK":"Tokelau","PN":"Pitcairn"}

def af(slr_cm, d):
    return 2 ** (slr_cm / d)

out = {}
for c in lecz:                      # LECZ missing TK, PN -> excluded
    if c not in slr or c not in pop:
        continue
    p2020 = pop[c].get("2020"); p2050 = pop[c].get("2050")
    pct10 = lecz[c].get("10M", {}).get("pct")
    pct5 = lecz[c].get("5M", {}).get("pct")
    s = slr[c]["slr_cm"]["ssp245"]["p50"]
    dist = slr[c]["dist_km"]
    if None in (p2020, p2050, pct10, s):
        continue
    out[c] = {
        "exposed_10m_2020": round(p2020 * pct10/100),
        "exposed_10m_2050": round(p2050 * pct10/100),
        "exposed_5m_2050": round(p2050 * pct5/100) if pct5 is not None else None,
        "pct_below_10m": pct10,
        "slr_2050_cm": s,
        "af_central": round(af(s, D_CENTRAL), 1),
        "af_range": [round(af(s, d), 1) for d in (D_RANGE[-1], D_RANGE[0])],  # low-D=high AF
        "slr_match_dist_km": dist,
        "slr_low_confidence": dist > 100,
    }

json.dump(out, open(BASE + "risk_trajectory_2050.json", "w"), indent=2)

print("RISK TRAJECTORY TO 2050 (SSP2-4.5; AF = 2^(SLR/8cm), tropical Pacific)\n")
print(f"{'country':<15}{'<10m 2020':>10}{'<10m 2050':>10}{'%<10m':>7}"
      f"{'SLR cm':>8}{'flood x':>9}  note")
for c, v in sorted(out.items(), key=lambda kv: -kv[1]["af_central"]):
    note = "SLR proxy" if v["slr_low_confidence"] else ""
    print(f"{names.get(c,c):<15}{v['exposed_10m_2020']:>10,}{v['exposed_10m_2050']:>10,}"
          f"{v['pct_below_10m']:>6.0f}%{v['slr_2050_cm']:>8.0f}{v['af_central']:>8.0f}x  {note}")

print(f"\nAF sensitivity (doubling interval D): central D=8cm shown above; "
      f"range D=5-10cm widens each AF roughly x0.5..x2.")
print("saved derived/risk_trajectory_2050.json")
