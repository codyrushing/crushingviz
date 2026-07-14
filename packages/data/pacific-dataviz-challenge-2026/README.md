# Pacific Data Viz Challenge 2026 — Planning

Working notes and plan for this entry. Living document — scope is still open.

See companion doc [KEY.md](./KEY.md) for a description of the data files in this directory .

## Goal / framing

Tell a story about **coastline change across the Pacific Islands**, combining
satellite-derived coastline data with per-country climate indicators. The
compelling thread: pair *physical* coastline change (erosion / accretion) with
*contextual* climate signals (sea level, sea-surface temperature) over the same
years, per country/atoll.

**Current lean (not final):**
- **Per-country / per-atoll** views rather than one whole-Pacific map. A single
  region-wide interactive map is likely too dense to read.
- The core may be **quantitative** (coastline change plotted alongside other
  historical series) rather than strictly geographic.
- A regional map showing the blue→green coastline change over time remains an
  optional "hero" visual, not the backbone.

## Datasets

All raw data lives in `packages/data/pacific-dataviz-challenge-2026/`.

### 1. Coastlines — `dep_ls_coastlines_0-7-0-55.pmtiles` (~389 MB)

Digital Earth Pacific **Landsat Coastlines** product. Vector tiles (MVT),
zoom 0–13, covers the Pacific island region (bounds ≈ lon −180→180,
lat −27.9→20.6). Five layers:

| Layer | Geom | Features | Key fields | Notes |
|---|---|--:|---|---|
| `shorelines_annual` | LineString | 947,089 | `year` (1999–2023), `certainty` | One coastline per year, 25 yrs |
| `rates_of_change` | Point | 10,397,031 | `rate_time` (m/yr), `sig_time` (p-val), `se_time`, `certainty` | Full-res per-transect change rate |
| `hotspots_zoom_1` | Point | 127,313 | `rate_time`, `sig_time`, `certainty` | Coarse summary, for low zoom |
| `hotspots_zoom_2` | Point | 291,318 | same | Mid-zoom summary |
| `hotspots_zoom_3` | Point | 1,047,549 | same | Fine summary, for high zoom |

Key semantics (verified by decoding sample tiles):
- `rate_time` = linear rate of shoreline movement in **m/yr** over 1999–2023.
  **Negative = erosion, positive = accretion.** This is a *single value per
  location for the whole period*, not a per-year series.
- `sig_time` = statistical significance (p-value, 0–1) of that rate.
- `hotspots_*` are smoothed, zoom-optimized summaries of `rates_of_change`
  (narrower value ranges; extremes averaged out). Use these for display,
  `rates_of_change` for analysis.
- The per-year *position* of the coast lives only in `shorelines_annual`
  geometry — deriving a clean per-year scalar requires aggregation work
  (see Open Questions).

CLI: `pmtiles show [--metadata] <file>` (binary symlinked at `~/.local/bin/pmtiles`).

### 2. Climate indicators — `SPC,DF_CLIMATE_CHANGE,1.0,complete,*.csv`

SPC (Pacific Community) Climate Change indicators. **Long format**
(one row per country × year × indicator). 16,568 rows.
Key columns: `GEO_PICT` (country code), `TIME_PERIOD` (year),
`CLIMATE_CHANGE_INDICATORS` (code), `OBS_VALUE`, `UNIT_MEASURE`.

**22 countries/territories:** AS, CK, FJ, FM, GU, KI, MH, MP, NC, NR, NU, PF,
PG, PN, PW, SB, TK, TO, TV, VU, WF, WS.

**13 indicators** (year span / #countries / unit):

| Code | Indicator | Years | #ctry | Unit |
|---|---|---|--:|---|
| `SEA_LVL` | Sea Level Anomalies | 1993–2023 | 21 | m | ⭐ best coastline pairing |
| `SST_ANOM` | Sea Surface Temp anomalies | 1850–2025 | 21 | °C |
| `ST_ANOM` | Surface Temp anomalies | 1850–2025 | 22 | °C |
| `RAIN_ANOM` | Precipitation anomalies | 1979–2025 | 22 | mm |
| `ALT_LAND_COVER` | Climate Altering Land Cover Index | 1992–2022 | 22 | % |
| `GHG_EMI_CAPITA` | GHG emission per capita | 1970–2024 | 17 | t |
| `POWER_GEN` | Power generation | 2000–2023 | 18 | GWh |
| `TRSM_ARR` | Tourism arrivals | 1995–2024 | 13 | count |
| `CROP_YIELD` | Crop yield | 1961–2024 | 15 | kg/ha |
| `LVST_YIELD` | Livestock yield | 1961–2024 | 14 | kg/animal |
| `ENV_TAXES` | Environmental taxes | 2000–2020 | 5 | % |
| `FISH_MNGT_MULT_BILAT_ARGMT` | Fisheries mgmt arrangements | 1903–2026 | 22 | count |
| `METEO_MONITOR_NET` | Meteorological monitoring network | 1889–2026 | 18 | count |

The `*,filtered,*` and `dataflow,*,complete,*` CSVs are subsets / metadata of
the same dataflow; the `complete` one above is the primary source.

## Architecture — Path C (hybrid), no fighting the tiling

Decided approach: **MapLibre + PMTiles for geography, d3 for analytics/UI.**
Do *not* convert the whole PMTiles to GeoJSON.

- **MapLibre GL JS** consumes `.pmtiles` natively via the `pmtiles` protocol
  shim. Serve the file as a static asset over HTTP range requests. Style
  `shorelines_annual` filtered by `year` for a time slider; style
  `hotspots_*` / `rates_of_change` by `rate_time` (diverging ramp) gated by
  `sig_time`. Handles all features without shipping them flat to the browser.
- **d3** drives the linked quantitative charts the map can't: per-country
  time series, small multiples, erosion/accretion distributions, legends,
  the time-slider UI.
- **For focused single-atoll d3 geography** (if needed): extract a small bbox.
  Prefer pulling **upstream source vectors** (Digital Earth Pacific publishes
  GeoJSON/GeoParquet, unclipped) over stitching MVT tiles, which clips features
  at tile edges. As a fallback we can decode z13 tiles for a small bbox.

Stack context: monorepo (`packages/web` = **Astro 5**, `packages/api` = Go,
`packages/data`, `packages/types`). No d3/MapLibre installed yet.

## Open questions / decisions

1. **Scope** — which countries/atolls? Start with 1–3 high-signal cases
   (e.g. Tuvalu TV, Kiribati KI, Marshall Islands MH — low-lying, high stakes).
2. **Coastline metric to plot** — `rate_time` is one value per location for the
   whole period. To plot coastline change *over time* alongside annual
   indicators we need either (a) per-year shoreline-position deltas derived
   from `shorelines_annual` geometry, or (b) accept the rate as a single
   summary stat per country and pair it with the *trend* of the indicators.
   **Needs a decision — affects how much geometry processing is required.**
3. **Per-country aggregation** — turning point/line data into per-country
   numbers needs PICT admin boundaries to clip/aggregate. Source TBD.
4. **Geographic vs quantitative emphasis** — does the final piece need the map,
   or is it charts with an optional map hero?
5. **Hosting** — static hosting with range requests (makes PMTiles trivial)?

## [NOT COMPELLING] P0 findings (2026-06-14)

**Climate-indicator data resolution varies a lot — and the intuitive
`SEA_LVL` pairing is undermined at the source:**

| Indicator | Distinct values | Range | Verdict |
|---|--:|---|---|
| `SEA_LVL` | **5** | ±0.2 m | ❌ quantized to 0.1 m, clamped ±0.2 m — too coarse |
| `SST_ANOM` | 27 | −2.0…+1.1 °C | ✅ usable; clear regional warming (~+0.01–0.025 °C/yr) |
| `ST_ANOM` | 31 | −2.3…+1.2 °C | ✅ usable |
| `RAIN_ANOM` | 460 | −54…+67 mm | ✅✅ genuinely continuous |

- Real Pacific sea-level rise (~3–4 mm/yr) is *below* the `SEA_LVL` rounding
  step, so its per-country trend is near-flat/identical everywhere. **The
  SPC `SEA_LVL` field cannot support a fine coastline-vs-sea-level chart.**
- **Options:** (1) pivot climate pairing to `SST_ANOM`/`RAIN_ANOM` (in-hand,
  real resolution); (2) source true sea-level series externally for P1
  (Australian BoM Pacific Sea Level Monitoring Project tide gauges, or
  satellite altimetry); (3) lead with the coastline data itself, climate as
  context. **Decision pending.**
### Coastline extraction + correlation (rigorous pass)

Method: fetched the 22 PICT **EEZ polygons** from Marine Regions (VLIZ
GeoServer WFS — authoritative upstream of the SPC EEZ dataset; SPC portals are
Cloudflare-walled to scripts). Decoded **2.23M `rate_time` points** from the
PMTiles at z11, projected to lon/lat, point-in-polygon joined to EEZ
(**70% matched**; rest are dateline-gap / non-PICT coast in the bbox).
Aggregated per country; correlated against `SST_ANOM` / `RAIN_ANOM` 1999–2023
trends. Reproducible: `packages/data/.../analysis/*.py`, outputs in
`.../derived/*.json`.

**Coastline result is real and interesting; the climate *correlation* is not:**

- Per-country erosion gradient is clear: **French Polynesia, Kiribati, Vanuatu,
  Cook Islands** erode most; **most atoll nations (Tuvalu, FSM, Marshall Is.,
  Tokelau, N. Marianas) are net stable/accreting** (e.g. Tuvalu only ~18% of
  significant transects eroding). This counterintuitive "atolls aren't
  vanishing" pattern matches published science (Kench et al.) and is a strong,
  honest narrative on its own.
- Cross-country correlation of erosion vs climate trend is **weak**:
  erosion-rate vs SST `r≈0.31`; %eroding vs SST `r≈−0.46` (wrong sign, likely
  confounded); rainfall `|r|<0.16`. Root cause: **SST/rain trends are nearly
  spatially uniform across the region** (little cross-country variance), while
  coastline change is driven by *local* factors. A scatter "erosion vs SST per
  country" would be unconvincing/misleading.

**P0 verdict & recommended pivot:**
1. ❌ Drop the cross-sectional "erosion ↔ climate trend" correlation as a
   headline — the data doesn't support it.
2. ✅ **Lead with the coastline data itself** (option 3): the erosion-hotspot
   vs accreting-atoll story is compelling and defensible. Climate becomes
   supporting context, not a correlation claim.
3. 🔄 If a climate linkage is still wanted, the promising direction is
   **temporal** (per-country year-by-year shoreline change vs SST/rain
   anomalies — ENSO signal), i.e. the (a) metric in Q2 above, not cross-section.

### Per-country erosion summary (z11, significant transects p≤0.01)

Most-eroding → most-accreting (by median significant `rate_time`, m/yr):
PF −0.40, KI −0.32, VU −0.29, CK −0.24, PG −0.18, FJ −0.17 … then accreting:
NC +0.19, SB +0.25, WS +0.33, MH/PW +0.46, TO +0.61, FM +0.71, TK/MP +0.78,
TV/NU/PN +0.84. (Low-n outliers NR, GU noisy.) Full data in
`derived/coast_rate_by_country.json`.

## P0b findings — human / SDG data (2026-06-14)

Pivoted from a pure-climate story toward "human" indicators (tourism, yields,
power, disasters). Added `DF_SDG_11` dataset (650 rows, 12 indicators — mostly
**disaster impact**: deaths, affected persons, economic loss + a DRR-policy
indicator). Built a unified country×year panel (24 indicators across both
dataflows) and scanned correlations rigorously. Scripts: `analysis/explore_*.py`,
`profile_sdg.py`, `justice.py`.

**Correlation hunting is a dead end here — the data resists it:**
- Pooled correlations are dominated by **country size** (PNG big → high on every
  count) and **shared time trends** (anything rising over time "correlates").
- After **two-way fixed-effects** (remove country level *and* year shocks), the
  strong survivors are **trivial** (`SST~ST_ANOM` 0.94), **tautological** (the 3
  disaster-impact measures co-move — same events), or **physically expected**
  (`RAIN~SST` 0.53, ENSO). The only intriguing *human* signal:
  **`CROP_YIELD ~ disaster economic loss ≈ −0.39`** (disasters depress
  agriculture) — but only n≈37.
- **Verdict: don't build on correlations.** This sparse, confounded data suits
  *descriptive/comparative* storytelling, not correlation claims.

**Data-quality landmines found (must fix before use):**
- `VC_DSR_AALT` (disaster econ loss) **mixes units** — 35 rows `USD`, 4
  `USD_MILLIONS`. Summing is off by 10⁶. Normalize first.
- `GHG_EMI_CAPITA`: surprising, real values — **Palau ~82 t/capita** (> Qatar,
  world's highest), New Caledonia ~18, while atolls/Melanesia <1. The "Pacific =
  tiny emitters" narrative is **false**; the real story is intra-regional
  inequality.
- Disaster `deaths`/`affected` are **absolute counts** → unfair to compare
  across countries without a population denominator.

**Biggest gap / highest-leverage next step: add POPULATION (and ideally GDP).**
Nearly every compelling human comparison needs a denominator (deaths per capita,
loss as % GDP, tourism intensity). SPC publishes population (`DF_POP*`).

## ⭐ PROJECT SPINE (chosen 2026-06-14): forward-looking flood-risk trajectory

The backward-looking per-capita disaster burden (Lead 1) is real but **too thin
to carry the project alone** (sparse 2005–2020 reports). Chosen spine extends it
into a **forward-looking flood-risk trajectory to 2050**, reconnecting to the
sea-level theme:

> *How many Pacific Islanders live in the danger zone today, how that grows by
> 2050, and how rising seas turn today's rare floods into routine ones.*

**Model (three data-grounded layers × a cited amplification factor):**
1. **Exposed population over time** = static LECZ% (`pop_lecz_by_country.json`)
   × population projection to 2050 (`population_by_country.json`). Exposure
   grows via demographics alone (e.g. Marshall Is. keeps ~96% of a *growing*
   population <10m).
2. **Relative sea-level rise by scenario** — IPCC AR6, per Pacific tide-gauge
   site, SSP1-2.6 → SSP5-8.5, to 2050. Use *relative* RSL (includes Pacific
   vertical land motion). **TODO: pull (this session).**
3. **Flood-frequency amplification factor** — convert RSL → how much more often
   floods occur: **AF = 2^(SLR / D)**, doubling interval **D ≈ 5–10 cm**, with
   the **tropical Pacific at the sensitive (low-D) end** — the most flood-
   sensitive region on Earth. Cite **Vitousek et al. 2017** (Nature Sci. Rep.,
   "Doubling of coastal flooding frequency…"; tropics: today's 50-yr event →
   5-yr with 10 cm SLR) and **Taherkhani et al. 2020** (exponential SLR→freq).
   Report a **range** (D=5/8/10) and label illustrative, not site-calibrated.

**Decisions locked:** amplification-factor framing (not purely descriptive);
**timeline capped at 2050** (both pop & SLR exist; SSP scenarios barely diverge
by 2050 → cleaner "already locked in" message).

**Caveats to design around:**
- Only 3 elevation bands (5/10/20 m) — can't finely re-slice; SLR's main effect
  is *flood frequency*, not permanent inundation of the band.
- AF is a regional relationship, not per-site extreme-water-level calibration.
- LECZ is a static census profile; missing Tokelau & Pitcairn.
- RSL nominal to a baseline; population projection uncertainty grows toward 2050.

### Spine RESULTS (computed 2026-06-14) — `derived/risk_trajectory_2050.json`

AR6 RSL pulled (`slr_2050_by_country.json`, wf_1e, SSP1-2.6/2-4.5/5-8.5, 17/50/83
pct from 20k samples). **Headline: by 2050 the Pacific gets ~18–28 cm RSL, and
SSP scenarios barely diverge — it's locked in.** Applying AF = 2^(SLR/8cm):

| Country | % <10m | <10m pop 2020→2050 | RSL 2050 | flood ×more often |
|---|--:|--:|--:|--:|
| Marshall Is. | 96 | 41k → 24k* | 23 cm | ~8× |
| Tuvalu | 91 | 9.5k → 8.9k | 22 cm | ~7× |
| Kiribati | 74 | 93k → **135k** | 22 cm | ~6× |
| Fiji | 28 | 256k → **280k** | 21 cm | ~6× |
| Solomon Is. | 33 | 246k → **429k** | 18 cm | ~5× |
| FSM | 40 | 44k → 50k | 23 cm | ~7× |

- Floods that are rare today become **~5–11× more frequent by 2050** (central
  D=8 cm; range D=5–10 cm roughly ×0.5–×2). Illustrative regional factor.
- *Nuance worth a panel:* some exposed counts **fall** (Marshall Is. 41k→24k,
  Cook Is., Palau) because populations are **projected to shrink** (out-
  migration, already partly climate-driven), while Kiribati/Solomon/Vanuatu/
  PNG/FSM **grow** — exposure rises fastest there.
- **SLR sourcing (now clean):** 17/22 from nearest tide gauge (<15 km, incl.
  local VLM); the **5 without a nearby gauge** (Niue, Tokelau, Wallis & F.,
  Pitcairn, PNG) refined from the AR6 **gridded** 1° product — all now <60 km.
  This corrected **PNG's artifactual 9 cm → 17 cm** and pulled the Apia-proxied
  trio (Niue/Tokelau/WF) from inflated ~27 cm to representative ~21–23 cm.
  `source: "gridded"` marks the 5; `slr_low_confidence` now empty.
  (Am. Samoa / Samoa's higher ~27–28 cm is a *real* tide-gauge value, not a
  proxy — that region genuinely projects higher RSL.)

## Story leads (feeding the spine)

Population added (`derived/population_by_country.json`, SPC `DF_POP_PROJ`
`MIDYEARPOPEST`, all 22 PICTs, 1950–2050). This unlocks fair per-capita
comparison. **Two supporting leads:**

### LEAD 1 — Disaster burden (per capita) ⭐ primary

Normalizing disaster impacts by population completely reorders the story and
surfaces the real human cost on small islands:

| Country | affected-events / resident | deaths / 100k |
|---|--:|--:|
| Marshall Islands | **4.2** | 44 |
| Palau | 2.1 | 51 |
| Fiji | 1.4 | 120 |
| Tuvalu | 1.1 | 0 |
| Vanuatu | 0.9 | 9 |
| American Samoa | 0.08 | **369** |
| Samoa | 0.14 | **232** |

- **Absolute counts mislead** (PNG/Fiji top by size); per-capita surfaces
  atolls (Marshall Is., Palau, Tuvalu) — cumulative affected *exceeds their
  whole population*. This is the headline reframe.
- Deaths/100k is event-driven: American Samoa & Samoa spikes = 2009 tsunami.
- **CAVEATS:** zeros (French Polynesia, Tokelau, Niue, Guam) are almost
  certainly **reporting gaps, not absence of disasters** — flag clearly.
  "Affected/capita > 1" = repeated events summed over years.

#### Deep dive — `VC_DSR_AFFCT` "directly affected persons" (2026-06-16)

Pulled the full country×year panel (21 PICTs, 2005–2023, one row/country-year,
no demographic breakdown — all `_T`). Source UNDRR/Sendai. Derived:
`disaster_affected_by_country.json` (per-country series + per-capita + biggest
event + regional `by_year`). Script `analysis/extract_affected.py`. Five distinct
insights, strongest first:

1. **⭐ "Whole-nation events" — the small-island amplifier.** A *single* disaster
   routinely affects a number equal to most — sometimes **more than 100%** — of an
   atoll nation's entire population. Biggest single-year event as % of population:
   **Palau 136% (2021), Marshall Is. 133% (2020), Vanuatu 83% (2020, TC Harold),
   Tonga 80% (2018, TC Gita), Tuvalu 77% (2022), Fiji 69% (2016, TC Winston).**
   No continental country has anything like this (PNG's worst year = 0.8%). This is
   the human-scale headline: one storm = the whole country.
2. **Repeated affliction (cumulative burden).** Over 2005–2023, cumulative
   affected *exceeds total population*: Marshall Is. **3.6×**, Palau 2.1×, Fiji
   1.35×, Vanuatu 1.05×, Tuvalu 1.0×. Disasters aren't rare shocks — the average
   resident has been a disaster victim several times over.
3. **Per-capita inverts the ranking (justice angle).** By raw count Fiji
   (1.24M cumulative), Solomon Is. (562k), PNG dominate; per-capita the atolls
   (Marshall, Palau, Tuvalu, Vanuatu) rise to the top and PNG vanishes (0.01×).
   Same reframe as the emissions-inequality note — smallest/lowest-emitting bear
   the highest relative human cost.
4. **Synchronized regional shock years (ENSO/cyclone signal).** Regional affected
   totals spike in lockstep: 2015 (196k), **2016 (734k — Winston)**, 2018 (463k —
   Gita), **2020 (549k — Harold + Yasa)**. These are severe-cyclone / strong-El
   Niño seasons → a regional timeline with named events annotated pairs naturally
   with `SST_ANOM` / ENSO from the climate dataset.
5. **Long tail — a few named events dominate.** Each country's total is carried by
   one or two identifiable disasters (Winston alone = 633k = half of Fiji's
   18-year cumulative). Supports a "handful of catastrophes" decomposition.

#### Gap-fill with EM-DAT — merged dataset (2026-06-28)

The UNDRR Sendai data has critical reporting gaps (zeros that are missing data,
not absence of disasters). To fill these, we merged **EM-DAT** (CRED/UCLouvain),
the authoritative global disaster database — independent of UNDRR country self-
reporting. Strategy (`analysis/merge_emdat.py`):

- **Where UNDRR = 0 but EM-DAT has a non-zero count**, the 0 is treated as a
  reporting gap and replaced with EM-DAT's value.
- **Where UNDRR has no data for a year but EM-DAT does**, the EM-DAT year is
  appended.
- **UNDRR non-zero values are preserved as primary** (UNDRR captures smaller
  events below EM-DAT's threshold).
- Every value is tagged with its source in `disaster_affected_merged.json`.

EM-DAT has a **higher inclusion threshold** (≥10 deaths, ≥100 affected, or
emergency declaration) — it misses very small events that UNDRR/DesInventar
captures. The merged file is a superset: UNDRR handles the fine-grained small
events; EM-DAT fills the big-event gaps and extends coverage to 2000–2026.

Key fills: **Vanuatu 2015 (Cyclone Pam): 0 → 188,000**; Vanuatu 2023–2024 added;
French Polynesia/Guam/Niue/Tokelau/Wallis & Futuna restored from 0–1 years to
multi-year coverage; PNG 2015 drought (2.55M); 60 fills across 19 countries.

**Impact on the five insights above:**

1. **Whole-nation events** — strengthened, with new leaders. Vanuatu's biggest
   year shifts from 2020 TC Harold (83%) to **2023 cyclones (185%)** — now the
   highest in the Pacific. FSM joins the >100% club (2023: 101%). Guam enters
   at 60%. The headline holds: a single storm routinely exceeds an entire atoll
   nation's population.
2. **Repeated affliction** — amplified. Cumulative per capita jumps for the
   gap-filled countries: Vanuatu 1.05× → **4.63×**, FSM 0.41× → **2.77×**,
   Solomon Is. 0.91× → 1.50×, Fiji 1.35× → 1.80×. PNG rises from 0.01× to
   0.41× (2015 drought). The qualitative claim ("disasters aren't rare shocks")
   holds — if anything it's stronger.
3. **Per-capita inversion** — unchanged in shape, amplified in magnitude. Atolls
   (Marshall 4.8×, Vanuatu 4.6×, Palau 2.9×, FSM 2.8×) still dominate; PNG
   (0.4×) and high islands remain at the bottom. The gap-fill *widens* the
   inequality: the most-exposed atolls had the most hidden disaster burden.
4. **Synchronized shock years** — reordered and strengthened. **2015 becomes
   the #1 shock year at 3.04M** (was 196k — a 15× increase from the PNG El Niño
   drought + Cyclone Pam). 2023 enters at #2 (1.08M, entirely new). 2016
   (Winston) drops from #1 to #3. The ENSO signal is now even clearer: the
   mega-El-Niño of 2015–2016 dominates two consecutive years.
5. **Long tail** — holds, with a stronger regional framing. Most countries'
   totals are carried by 1–2 identifiable disasters (19 of 22 countries have
   a single year >35% of their cumulative). But now the "dominant year" is
   often *different* from the original UNDRR-only analysis — the gap-fill
   surfaced the real biggest events that UNDRR was missing (VU 2023 instead of
   2020; FM 2023 instead of 2019; PG 2015 instead of 2007).

**CAVEATS (critical — data is patchy, even after the merge):** the merged file
substantially improves coverage but does not make the data "complete." EM-DAT
itself misses sub-threshold events; the two sources count "affected" slightly
differently (UNDRR Sendai = directly affected; EM-DAT = injured + homeless +
affected combined); and the merged totals should still be treated as lower-bound
estimates. The *shape* of the data (whole-nation single events, per-capita
ordering) remains the robust story, not precise totals. Also: counts >100% of
pop = affected-person-incidents (repeat/overlap counting), not unique people;
"affected" is UNDRR's broad category.

- Disaster econ loss (`VC_DSR_AALT`) **unit bug fixed** → normalized to USD in
  `derived/disaster_econ_loss_by_country.json` (4 `USD_MILLIONS` rows ×1e6).
  Totals: FJ $617M, VU $151M, TO $36M, PF $30M, FM $29M… Caveats: sparse
  (12 countries, 2007–2020, 1–7 yrs each), **nominal USD** (not inflation-
  adjusted), no GDP denominator yet.
**Coastal exposure (the structural "why") — `DF_POP_LECZ` + `DF_POP_COAST`
now pulled** (`derived/pop_lecz_by_country.json`, `pop_coast_by_country.json`;
each band has both `pct` and absolute `n`). This is the bridge from human burden
back to the coast, and the numbers are stark:

| Country | % pop ≤5m | % pop ≤10m | % pop ≤1km of coast |
|---|--:|--:|--:|
| Marshall Islands | 61 | **96** | 100 |
| Tuvalu | 41 | **91** | 100 |
| Kiribati | 24 | 74 | 100 |
| Nauru | 30 | 76 | 93 |
| Tokelau / Pitcairn | — (no LECZ data) | — | 100 |
| (contrast) PNG | 4 | 10 | 8 |
| (contrast) Niue | 1 | 1 | 25 |

- Atoll nations have **nearly their entire population at low elevation and on
  the coast** — this *explains* the disaster burden and links it to sea-level /
  erosion. The contrast with high islands (PNG, Niue, Guam) is the visual hook.
- LECZ missing for **Tokelau, Pitcairn** (COAST covers all 22). Data is
  census-derived and ~constant across years (a static exposure profile).
- Optional tie-in to coastline data: erosion hotspots (PF, KI, VU) vs coastal
  population exposure.

### LEAD 2 — Disasters → food security

The one human correlation that survived fixed-effects:
`CROP_YIELD ~ disaster economic loss ≈ −0.39` (crop yields dip in
high-disaster-loss years). Tangible, intuitive. Small-n (~37) — treat as a
supporting panel / illustrative, not a hard statistical claim. Strengthen by
pairing per-country crop & livestock yield trajectories with disaster timelines.

### Secondary / caveated — emissions "paradox"

Palau ~82 t CO₂/capita (> Qatar), New Caledonia ~18, atolls <1. **Do not headline
as-is:** the Palau/Marshall figures are largely an **accounting artifact of open
ship registries (flags of convenience)** — territorial accounting dumps
international shipping/bunker fuel onto a tiny resident population. New
Caledonia's is real industry (nickel smelting). Keep only if framed with this
context; otherwise misleading.

## P0f findings — remaining SDG datasets (2026-06-16)

Explored the three datasets named in the data README but never opened:
`DF_SDG_03` (health, 18 indicators), `DF_SDG_06` (water/sanitation, 7),
`DF_SDG_15` (biodiversity, 12), plus the large `DF_NMDI_POP` (detailed
population) and `DF_METEO_MONITOR_NET`. Profiling +
extraction: `analysis/explore_sdg_bio_water.py`. New derived series in
`redlist_index_by_country.json`, `water_sanitation_by_country.json`.

**Red List Index — a universal, 30-yr biodiversity decline. (DEMOTED in P0g — see
correction below.)** `ER_RSK_LST` (SDG 15.5.1), all **22 PICTs, 1993–2024**,
continuous index (1 = no species threatened → 0 = all extinct). **Every single
country declines.** Originally floated as a candidate *second backbone* / "two
rising curves" companion to the flood spine ("seas rise on the people; extinction
risk rises on the species").

| Country | 1993 → 2024 | change | max elev | note |
|---|--:|--:|--:|---|
| Guam (GU) | 0.71 → **0.36** | **−49%** | 406 m | brown tree snake — near-total native bird collapse |
| Palau (PW) | 0.95 → 0.66 | −31% | 242 m | |
| N. Marianas (MP) | 0.69 → 0.58 | −16% | 965 m | also lost 16.5pp forest cover (only real forest decline) |
| FSM / Vanuatu / NC | ~−12 to −15% | | 791–1877 m | |
| (regional, incl. **atolls**) | most −4 to −11% | | (5–4509 m) | Tuvalu/Kiribati/Marshall all ≈−9 to −11%; only Niue/Am.Samoa flat |

**⚠ CORRECTION (P0g, 2026-06-20) — the "two geographies" divergence does NOT
hold.** Re-tested against the max-elevation data pulled in P0g:
- **No elevation gradient.** Pearson `r(max elevation, RLI %change) ≈ 0.11`;
  `r(%pop<10m, RLI %change) ≈ 0.17`. Biodiversity decline is **uncorrelated** with
  how high or how exposed a country is. The earlier "high islands → biodiversity,
  low atolls → flood" split was **not in the data**.
- **Not "larger/higher" islands.** The three big decliners (Guam 540 km², Palau
  459 km², N. Marianas 464 km²) are *small, mid-elevation* islands, not the big
  high ones; PNG/Solomon/Vanuatu (the genuinely high/large islands) sit mid-pack.
- **Atolls are NOT spared.** Tuvalu (−11%), Kiribati (−11%), Marshall (−9%),
  Nauru (−10%) decline at the *regional average* rate. So there is no clean
  "different countries" divergence — the real structure is **three invasive-
  species outliers (Guam above all) on top of a near-universal modest baseline.**
- **Driver mismatch with a *climate* spine.** RLI decline is driven mainly by
  invasive species + habitat loss; climate is a secondary, multi-driver factor.
  The dramatic signal (Guam's brown tree snake) is not a climate story at all.

**Revised role:** **not** a second backbone and **not** a climate companion to the
flood spine (geography doesn't line up, cause isn't climate, no gradient). Use at
most as a **single non-climate contrast coda** — e.g. Guam's native-bird collapse
as *"climate is not the only force erasing the Pacific"* — kept explicitly
*outside* the climate-justice argument and labelled invasive-species-driven. Or
cut it to keep the spine sharp. Forest cover (`AG_LND_FRST`) is mostly
FAO-interpolated/flat — not usable for fine viz except MP's −16.5pp.

**SDG_06 water/sanitation — supporting context, the "freshwater paradox."**
Mostly slow development *improvement* (resolution OK: `SH_H2O_SAFE` 622 distinct
vals, 19 countries, 2000–2022). Climate link is contextual (saltwater intrusion +
drought threaten atoll freshwater lenses) rather than measured. Useful angles:
- **Outliers bucking the upward trend:** Solomon Is. drinking-water access
  **falls 78.7 → 67.5%**, French Polynesia 92 → 81.8%, Marshall Is. 88.8 → 85.1%.
- **The paradox:** atolls report *high* drinking-water % (Tuvalu 99, Kiribati 76)
  yet are the most water-fragile (rainwater + thin lens) — a "% access hides the
  climate fragility" panel. Sanitation stays low (Kiribati safely-managed san.
  24.8%, open defecation 32.8%; Solomon Is. open defecation 44.5%).

**SDG_03 health — weak for a climate spine.** Mostly health-system development
indicators. The climate-sensitive disease (`SH_STA_MALR` malaria) is a Melanesia-
only **success story** (Solomon Is. 623→167, Vanuatu 215→3 per 1,000 via
elimination programs) — an interesting good-news counter-note, not a threat
backbone.

**DF_NMDI_POP — enrichment only.** Detailed population (age/sex/urban breakdowns,
1990–2025). Urbanization (`NMDI0004`) is held flat past census years in this pull
(no real projection). Best use: add age structure to the flood-exposure layer
(who is exposed), not a new backbone.

**P0f verdict:** flood-risk spine stands. ~~The one genuinely new addition worth
building is the **Red List Index decline**~~ — **superseded by the P0g
correction above:** the Red List Index is demoted (no elevation gradient, atolls
decline at the same rate, invasive-species- not climate-driven). At most a
non-climate contrast coda, not a companion backbone. Water/sanitation is a
supporting panel (freshwater paradox). Health adds little. *(The real P0g
additions worth building are GDP, max elevation, and quintile food burden — see
P0g findings.)*

## P0g findings — economic / vulnerability dimensions (2026-06-20)

Added **8 Pacific Data Hub datasets** that supply the **denominators and
economic axes** the project kept flagging as missing ("biggest gap: add
POPULATION and ideally **GDP**"). These don't replace the flood-risk spine —
they **complete it** by stacking physical + economic + household vulnerability
into one per-country profile. Extraction: `analysis/extract_economic.py` (stdlib,
reproducible); 5 new derived files. Datasets: `DF_NATIONAL_ACCOUNTS`,
`DF_KEYFACTS`, `DF_HHEXP`, `DF_NMDI`, `DF_CPI`, `DF_NEET`, `DF_POP_DENSITY`,
`DF_POP_LECZ` (dup).

**⭐ The unifying lead — "No high ground, no buffer."** The smallest, lowest,
poorest islands face the worst exposure with the least capacity to adapt. Three
new, validated layers make this quantitative instead of asserted:

**1. GDP — finally (`DF_NATIONAL_ACCOUNTS`, 22 PICTs, 2005–2024, USD + domestic).**
- **Disaster loss as % of GDP** (joined to the existing econ-loss file): a single
  storm consumes several % of a national economy. TC Winston = **Fiji 7.6% of GDP
  in one year (2016)**; Vanuatu 9.4% (2016); FSM 6.1%; Tonga 4.3% (2014). This is
  the economic twin of the "whole-nation events" affected-population headline.
- **The injustice axis, quantified.** The most flood-exposed atolls are the
  *poorest*: GDP/capita Solomon Is. **$2,005**, Kiribati $3,277, Vanuatu $3,304,
  FSM $3,919 — vs Guam $41,827. Lowest emitters, least wealth, highest exposure,
  in one scatter.

**2. Max elevation (`DF_KEYFACTS`) — the most evocative new number.** Highest
point on the *entire nation*: **Tokelau & Tuvalu 5 m, Marshall Is. 10 m**,
Kiribati 81 m (one raised-limestone island; rest ~3 m). A country whose whole
landmass tops out at 5 m has **nowhere to retreat to** — pairs devastatingly with
LECZ exposure and 2050 SLR.

**3. Household precarity (`DF_HHEXP`, 13 PICTs, by income quintile + urban/rural).**
- **Food burden (Engel's law × climate):** poorest quintile spends **62% on food
  in Solomon Is., 60% in Vanuatu, 48% in FSM** (vs richest ~30–40%). **Fish** — a
  warming-/reef-threatened protein — is a top line item (Kiribati 9.2%, FSM/Solomon
  7.5% of the *whole* budget). Climate shocks to local food hit the poorest hardest.
- Energy (electricity/imported fuels) share: Marshall 7%, Palau/Tuvalu 6.8%.

**Supporting threads (`DF_NMDI`, the richest single file — 40+ indicators):**
- **Remittances as % of GDP** (`BX_TRF_PWKR`) — *an adaptive-capacity / divergence
  thread, NOT a climate-migration signal.* Remittances (money the diaspora wires
  home) act as a private, countercyclical disaster buffer — they spike after
  cyclones, insuring islands too poor to self-insure. But the data does **not**
  support "flood risk drives migration economy": the leaders are **high islands
  with low exposure** (Tonga **42%** / max elev 1033 m / 27% pop <10 m; Samoa 28%
  / 1857 m / 13%), while the most flood-exposed atolls have the **thinnest**
  buffers (Tuvalu **3.2%** / 5 m / 91% pop <10 m; Kiribati 4.2% / 74%; Nauru
  0.6%). If anything the relationship is *inverse*. The honest finding is the
  **divergence** (cf. the Red List Index note): the islands facing the worst
  exposure have the least-developed migration buffer.
  - **⭐ The Marshall Islands exception proves the mechanism.** Marshall is the
    *only* atoll with a real buffer (13% of GDP) *and* the worst exposure (96% of
    pop <10 m, max elev 10 m) — because the **US Compact of Free Association
    (COFA)** grants Marshallese visa-free residence/work in the US. Tuvalu and
    Kiribati have no equivalent (only small quota schemes — NZ's Pacific Access
    Category, seasonal-worker programs). So **institutional access to migration**,
    not flood risk, determines who has this escape valve. The most-exposed atolls
    lack not just wealth and high ground but also the diaspora-insurance buffer
    their less-exposed neighbours built over generations.
  - **Do NOT claim** remittances measure climate-driven out-migration — most
    Pacific migration (Tonga/Samoa → NZ/AU/US) is decades-old, economic and
    family-driven. Use remittances only as an adaptive-capacity bar (alongside
    GDP/capita) and as the COFA-gated divergence note.
- **Renewable energy share** (`EG_FEC_RNEW`): PNG 51%, Solomon 50%, Kiribati 42%
  vs Tonga/Palau/Marshall ~2% — a mitigation counter-narrative, cleaner than the
  ship-registry-distorted per-capita emissions figures.
- Plus electricity access, internet, age-dependency, women in parliament =
  adaptive-capacity indicators.

**Secondary / caveated:**
- `DF_CPI` (inflation, 2016–2025, 20 PICTs) — can **deflate the nominal-USD
  disaster losses** (a logged caveat) + a food-price-shock angle.
- `DF_NEET` (youth not in employment/education, 13 PICTs) — youth-vulnerability
  angle but values look high/patchy (Vanuatu 87%) → caveat heavily.
- `DF_POP_DENSITY` — **parsing landmine: year is stored in the `INDICATOR`
  column** (same as KEYFACTS); raw values looked like population counts, not
  density. Needs careful re-extraction before use; deferred.
- `DF_POP_LECZ` (raw) — duplicate of existing `pop_lecz_by_country.json`. Skip.

**Data-quality landmines fixed:**
- **Corrupt GDP-USD rows** (off-by-10×): VU 2018 reads $95M between two $935M
  years; SB 2019–20 similar. `extract_economic.py` flags any year >3× from its
  series median and excludes it from the loss-%-GDP join (full series retained in
  `gdp_by_country.json`). Use the **domestic-currency** series where USD looks off.
- KEYFACTS `KM2` is the **maritime/EEZ footprint** (PG ~2.4M km²), *not* land
  area — do **not** use it for land-density. Stored as `area_km2_reported` w/ note.

**P0g verdict:** the flood-justice spine stands and is now **economically
grounded**. The headline reframe — *physical exposure × economic fragility ×
household precarity, all concentrated on the same small islands* — is the
strongest, most defensible synthesis the data supports. GDP, max elevation, and
quintile food burden are the three highest-value new series; build them into the
spine's vulnerability profile.

## Rough phases

- [x] **P0 — Explore (climate + coastline)**: `SEA_LVL` too coarse; coastline
  erosion extracted per country; cross-sectional climate↔coastline correlation
  weak → pivot to coastline-as-spine / human data.
- [x] **P0b — Explore (human / SDG)**: correlation-hunting confirmed a dead end
  (confounded); added SDG_11 disaster data + **population**; identified disaster
  burden (per capita) + food security as the leads. Data landmines logged.
- [x] **P0c (part)**: pulled `DF_POP_LECZ` + `DF_POP_COAST` coastal exposure
  (stark: Marshall Is. 96% / Tuvalu 91% of pop ≤10m elevation).
- [x] **P0c**: fixed `VC_DSR_AALT` USD/USD_MILLIONS unit bug → normalized USD.
- [x] **P0d**: chose forward-looking flood-risk spine; pulled AR6 RSL; computed
  `risk_trajectory_2050.json` (exposed pop × RSL × amplification factor).
- [x] **P0e**: refined 5 proxy SLR sites from gridded product (PNG 9→17 cm
  corrected); all sites now <60 km, no low-confidence flags.
- [x] **P0g**: added economic/vulnerability datasets (GDP, max elevation,
  household expenditure, remittances, renewables); built 5 derived files;
  flagged corrupt GDP-USD rows. Spine now economically grounded.
- [ ] **P1 entry** — build the spine views in d3 + Astro.
- [ ] **P1 — Quantitative spine**: tidy per-country panel (impacts + population
  + yields); build linked d3 views for the disaster-burden + food-security
  leads. *Viable entry without the map.*
- [ ] **P2 — Map layer (optional)**: MapLibre + PMTiles; coastline + coastal
  population exposure. Link map ↔ charts.
- [ ] **P3 — Polish**: narrative, annotations, responsive, perf.

## Data inventory (derived/)

- `coast_rate_by_country.json` — per-country coastline erosion stats (z11 EEZ join)
- `climate_trends_1999_2023.json` — SST/RAIN/SEA_LVL per-country slopes
- `population_by_country.json` — SPC `MIDYEARPOPEST`, 22 PICTs, 1950–2050
- `pop_lecz_by_country.json` — % + count of pop in 0–5/10/20m low-elevation
  coastal zones (20/22; no Tokelau, Pitcairn)
- `pop_coast_by_country.json` — % + count of pop within 1/5/10km of coast (22/22)
- `disaster_econ_loss_by_country.json` — `VC_DSR_AALT` normalized to USD (unit
  bug fixed); per-year + cumulative total
- `disaster_affected_by_country.json` — `VC_DSR_AFFCT` directly affected persons,
  21 PICTs 2005–2023; per-year series + cumulative + per-capita + biggest event +
  regional `by_year` (P0f deep dive)
- `slr_2050_by_country.json` — AR6 relative SLR at 2050 (cm), 3 SSPs, 17/50/83
  pct; per-country nearest tide gauge + match distance + low-confidence flag
- `risk_trajectory_2050.json` — ⭐ the spine: exposed pop (2020/2050) × RSL ×
  flood amplification factor
- `redlist_index_by_country.json` — Red List Index (extinction risk), 22 PICTs,
  1993–2024, per-year series + delta (P0f)
- `water_sanitation_by_country.json` — safely-managed drinking water / sanitation
  / open defecation %, per-year series + delta (P0f)
- `gdp_by_country.json` — GDP total / per-capita / growth, USD + domestic, 22
  PICTs 2005–2024; per-year series + latest (P0g; corrupt USD years retained but
  flagged by the extractor)
- `disaster_loss_pct_gdp.json` — econ loss joined to same-year USD GDP; per-year
  `pct_of_gdp` + worst single year (P0g; off-by-10× GDP rows excluded)
- `max_elevation_by_country.json` — highest point (m) + reported maritime/EEZ
  area (km², *not* land), 22 PICTs (P0g)
- `household_expenditure.json` — food / fish / energy budget shares + poorest-vs-
  richest-quintile food gap, 13 PICTs (P0g; survey snapshot, no year)
- `remittances_renewables.json` — remittances %GDP / renewable energy % /
  electricity access %, per-year series + latest, 20 PICTs (P0g)
- `disaster_emdat_by_type.json` — ⭐ EM-DAT events preserving disaster
  type/subtype (2000–2026, 20 PICTs, 177 rows). Per-country panels by type with
  affected/deaths/damage series; pre-aggregated `flood_relevant` (Storm+Flood+Mass
  movement wet = 54% of all affected) and strict `coastal_flood_only` (Coastal
  flood + Storm surge = 1%, ~96k). Flood-relevant damage joined to same-year USD
  GDP -> pct_of_gdp (worst: VU 2015 Pam = 59% of GDP, TO 2020 = 22.6%, WS 2012 =
  16.6%, FJ 2016 Winston = 12.2%). Per-event detail for annotation. (P0h)
- `disaster_affected_merged.json` — ⭐ `VC_DSR_AFFCT` merged with EM-DAT gap fills;
  UNDRR primary with EM-DAT-supplemented zeros and new years; every value tagged
  with source provenance (P0h)
- `raw/emdat-country-profiles.xlsx` — EM-DAT HDX Country Profiles (downloaded
  2026-06-23, 6,509 rows, all countries 2000–2026)
- `raw/DF_POP_LECZ_1.0.csv`, `raw/DF_POP_COAST_2.0.csv` — raw SDMX pulls
- Analysis scripts in `analysis/*.py` (all reproducible)

## Reference

- Coastline product: Digital Earth Pacific Coastlines (`dep_ls_coastlines`),
  DEA Coastlines methodology.
- Indicators: SPC Pacific Data Hub `DF_CLIMATE_CHANGE`, `DF_SDG_11`.
- Population: SPC `DF_POP_PROJ`; coastal exposure: `DF_POP_LECZ`, `DF_POP_COAST`.
- SPC SDMX API (not Cloudflare-walled): `https://stats-sdmx-disseminate.pacificdata.org/rest/`
  (e.g. `dataflow/SPC`, `data/SPC,DF_POP_PROJ,3.0/all` with
  `Accept: application/vnd.sdmx.data+csv`).
- PMTiles: https://docs.protomaps.com/pmtiles/ · MapLibre via `pmtiles` npm pkg.
- EM-DAT: CRED / UCLouvain, Brussels, Belgium — www.emdat.be (D. Guha-Sapir).
  Country Profiles via HDX: https://data.humdata.org/dataset/emdat-country-profiles
  (free, no registration; CC-BY-NC / non-commercial use).
