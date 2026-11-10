# Gaza ↔ West Bank: Conflict Regimes, Ceasefires, and the Migration of Violence

**Exploratory analysis of `acled_weekly_agg` for visualization development**

- **Date:** November 8, 2026
- **Data:** ACLED weekly aggregates, 566 continuous weeks (week of 2015-12-26 → week of 2026-10-24), no gaps (all week steps = 7 days; weeks bin Saturday–Friday)
- **Regions:** Gaza Strip (`admin1_id = 11610`), West Bank (`admin1_id = 11611`), both children of Palestine (`geographic_area.id = 11609`)
- **Totals in scope:** Gaza — 39,956 events / 71,273 fatalities. West Bank — 63,558 events / 2,282 fatalities

---

## 1. Executive summary

1. **The two theatres are coupled only at the *regime* level, not week-to-week.** Overall weekly-fatality correlation is r = 0.63, but this is a shared-epoch artifact: week-over-week *changes* in fatalities correlate at r ≈ 0.04 (nothing). The relationship is real but operates through war/ceasefire regime switches, not synchronized weekly fluctuations.
2. **A see-saw dominates during wars.** When Gaza war intensity is high, West Bank fatalities collapse to a rounding error (0.8–1.9% of combined fatalities) — except at war *onset*, when the WB spikes (Oct 2023: 35 fat/wk, and its highest multi-week lethality in the dataset at 0.096 fat/event).
3. **Gaza ceasefires transfer violence to the West Bank — all three pauses show a WB counter-wave.** During the Nov 2023 truce week, WB fatalities jumped to 31 (vs 12/wk in the surrounding war). During the Jan–Mar 2025 ceasefire, Israel launched Operation Iron Wall in the WB two days in; WB fatalities stayed at war level (11.8/wk). During the current ceasefire (Oct 10 2025 →), WB events hit their all-time sustained high (217/wk; Oct 2026 = 1,593 events, the record month) driven by settler mob violence, looting/property destruction, and land seizures — while WB lethality fell to its all-time low (0.015 fat/event).
4. **Each regime has a distinct "form fingerprint"** in event-type composition, and the fingerprint switches sharply at ceasefire boundaries. Events alone are a misleading intensity proxy during ceasefires; **lethality per event is the single cleanest discriminator** (Gaza: 2.0–7.2 fat/event in war vs 0.38 in ceasefire).
5. **A ceasefire in the data is a ~92–95% fatality reduction, not an absence.** Gaza still averages ~37 fat/wk under the current ceasefire, concentrated in intermittent deadly drone strikes (72% of ceasefire-period fatalities) and spike weeks (up to 129).
6. **Population exposure (ACLED's scale-of-impact metric) is an independent dimension — and it shows ceasefires stop the deaths, not the exposure.** Under the current ceasefire, Gaza's fatalities run at 8% of the prior war rate but its exposure at **61%** (exposure-per-fatality ×8), and within the ceasefire the two metrics are statistically decoupled (r = 0.13). Meanwhile the WB's record 2026 event wave shows *falling* exposure (4.2k px/event, down from 12.1k in 2016–17) — settler violence is rural and low-density, and the land-seizure/property-destruction stream (27% of its events) carries no exposure value at all: it is visible only on the event axis (§3.9). The metric is also violence-weighted by construction: violent events supply 79–100% of exposure in every window — including the GMR protest era (96% in Gaza) — because ACLED's radii scale with violence potential.
7. **The 2016–2021 stretch is three regimes, not one "baseline."** Quiet 2016–17 (Gaza 0.8 fat/wk), the Great March of Return 2018–19 (5.0 fat/wk at **5× the event volume but unchanged lethality** — a mass-confrontation regime *inside* the intact post-2014 ceasefire, not a war), and quiet 2020–21 (0.2 fat/wk). The blended 2.1 fat/wk baseline understated true quiet and hid a third low-intensity co-mobilization episode: the Dec 2017–Mar 2018 "days of rage," during which both territories' event volume rose ~4× simultaneously (within-window event r = 0.80, falling to 0.27 without it).

---

## 2. Data & method

### 2.1 Structure

`acled_weekly_agg` is pre-aggregated to (week × admin1 × event_type × sub_event_type) with `event_count`, `fatalities`, `population_exposure` (ACLED's conflict-exposure "best" estimate — provenance and limits in §3.9), and centroid coordinates. Dimensions are Postgres enums (`disorder_type`, `event_type`, `sub_event_type`). Weeks with zero events for a region produce no rows, so weekly series must be built from the union of week keys (treated as 0 where absent).

> Note: the table has no actor fields. "Settler violence" below is inferred from sub-event composition (mob violence, looting/property destruction, violence-against-civilians attacks), which matches ACLED's own published framing of the 2026 WB surge. Event-level data with actors would confirm attribution.

### 2.2 Regime windows

Weeks are Saturday-start bins. Boundaries follow real-world events and were verified against the data (see §2.3). Transition weeks are inherently mixed (±1 day of the adjacent regime at each boundary) — unavoidable at weekly granularity. The three 2016–2021 sub-regime splits are qualitative decompositions rather than data step-changes — the GMR ramps in and tapers out rather than switching modes (see caveat 7).

| # | Window | Start (week of) | End (excl.) | Weeks | Anchor event |
|---|--------|-----------------|-------------|-------|--------------|
| 1 | `quiet_2016_17` | 2016-01-02 | 2018-03-24 | 116 | True quiet: post-2014 ceasefire status quo |
| 2 | `gmr_2018_19` | 2018-03-24 | 2020-01-04 | 93 | Great March of Return fence protests (began Fri Mar 30 2018 — the first week bin contains 1 GMR day); ceasefire framework held throughout; embedded micro-escalations (Nov 2018 raid, May 2019 round, Nov 2019 Abu al-Ata killing) contained within days |
| 3 | `quiet_2020_21` | 2020-01-04 | 2021-05-08 | 70 | Post-GMR quiet (protests tapered through 2019; COVID ended mass gatherings) |
| 4 | `may2021_war` | 2021-05-08 | 2021-05-22 | 2 | May 10–21 2021 war (Guardian of the Walls); ceasefire May 21 |
| 5 | `post_may21_lull` | 2021-05-22 | 2022-07-30 | 62 | Post-war lull |
| 6 | `aug2022_war` | 2022-07-30 | 2022-08-13 | 2 | Aug 5–7 2022 (Breaking Dawn); ceasefire Aug 7 |
| 7 | `prewar_2022_23` | 2022-08-13 | 2023-10-07 | 60 | Settler-violence escalation era begins (gov't change Dec 2022) |
| 8 | `war_oct23` | 2023-10-07 | 2023-11-25 | 7 | Oct 7 attack → war onset |
| 9 | `truce_nov23` | 2023-11-25 | 2023-12-02 | 1 | Nov 24–Dec 1 2023 truce (hostage pause) |
| 10 | `war_dec23_jan25` | 2023-12-02 | 2025-01-18 | 59 | War resumes Dec 1 2023 |
| 11 | `cf_jan25_phase1` | 2025-01-18 | 2025-03-15 | 8 | Ceasefire #1 effective Jan 19 2025; Operation Iron Wall (WB) from Jan 21 |
| 12 | `war_mar25_oct25` | 2025-03-15 | 2025-10-11 | 30 | Israel resumes strikes Mar 18 2025; intensified ops through summer |
| 13 | `cf_oct25_now` | 2025-10-11 | 2026-11-01 | 55 | Ceasefire #2 effective Oct 10 2025 12:00 local — still holding as of data end |

### 2.3 Boundary verification (Gaza weekly fatalities around each transition)

| Week of | Fatalities | | Week of | Fatalities | | Week of | Fatalities |
|---|---|---|---|---|---|---|---|
| 2025-01-04 | 331 | | 2025-09-20 | 409 | | 2025-12-20 | 14 |
| 2025-01-11 | 396 | | 2025-09-27 | 482 | | 2025-12-27 | 7 |
| **2025-01-18** | **105** ← cf#1 starts | | 2025-10-04 | 124 | | 2026-01-03 | 34 |
| 2025-01-25 | 26 | | **2025-10-11** | **84** ← cf#2 starts | | 2026-01-10 | 47 |
| 2025-02-01 | 23 | | 2025-10-18 | 70 | | 2026-01-17 | 22 |
| 2025-02-08 | 41 | | 2025-10-25 | 129 | | 2026-01-24 | 34 |
| 2025-02-15 | 16 | | **2025-11-01** | **12** | | 2026-01-31 | 98 |
| 2025-03-01 | 25 | | 2025-11-08 | 28 | | | |
| 2025-03-08 | 59 | | 2025-11-15 | 50 | | | |
| **2025-03-15** | **676** ← war resumes | | 2025-11-22 | 76 | | | |

The data reproduces every documented boundary: war → ceasefire #1 (Jan 19 2025) shows 396 → 105 → 26 fat/wk; ceasefire collapse (Mar 18 2025) shows 59 → 676; the final pre-deal ultimatum escalation and ceasefire #2 (Oct 10 2025) show 482 → 124 → 84 → 70, settling to ~12–50/wk from November 2025 onward.

### 2.4 Statistics used

Pearson and Spearman correlation on weekly levels; lagged cross-correlation on levels and on week-over-week first differences (−8…+8 weeks); 26-week rolling Pearson as a "coupling meter"; per-window means, composition shares, and lethality (fatalities per event). All computed in-memory from SQL aggregates; no external statistical packages.

---

## 3. Findings

### 3.1 Regime table (means per week)

| Window | Gaza fat/wk | Gaza ev/wk | WB fat/wk | WB ev/wk | WB % of combined events | WB % of combined fatalities |
|---|---|---|---|---|---|---|
| quiet_2016_17 | 0.8 | 8.5 | 2.2 | 27.3 | 76% | 74% |
| **gmr_2018_19** | **5.0** | **40.1** | 1.0 | 65.6 | 62% | **16%** |
| quiet_2020_21 | 0.2 | 27.8 | 0.9 | 81.3 | 75% | 80% |
| may2021_war | 133 | 182 | 20 | 424 | 70% | 13% |
| post_may21_lull | 0.2 | 21.9 | 2.2 | 119 | 85% | 91% |
| aug2022_war | 24 | 46 | 3 | 138 | 75% | 11% |
| prewar_2022_23 | 0.8 | 22.3 | 5.4 | 157 | 88% | 88% |
| **war_oct23** | **2,189** | 303 | **35** | 366 | 55% | **1.6%** |
| **truce_nov23** | 188 | 94 | **31** | 239 | 72% | 14% |
| war_dec23_jan25 | 638 | 250 | 12.1 | 163 | 39% | 1.9% |
| **cf_jan25_phase1** | 43 | 50 | **11.8** | **182** | 78% | 22% |
| war_mar25_oct25 | 494 | 246 | 3.9 | 164 | 40% | 0.8% |
| **cf_oct25_now** | 37 | 98 | 3.2 | **217** | 69% | 7.8% |

**Why the 2016–2021 stretch is decomposed.** A single blended "baseline" averaged Gaza at 2.1 fat/wk — understating true quiet (0.2–0.8) and compressing the GMR. As its own sub-regime, the Great March of Return is a **ceasefire-form confrontation, not a war**: no step-change boundaries (it ramps in over weeks and tapers out), sustained intensity 5× below the smallest war window (24 fat/wk), only 5 of its 93 weeks even reaching that level — all one-week micro-escalations contained within days (the Nov 2018 Khan Younis raid, the May 2019 round, the Nov 2019 Abu al-Ata killing) — and the post-2014 ceasefire framework never broke. Its signature is **5× event volume at unchanged lethality** (40.1 events/wk at 0.13 fat/event, vs 0.09 in the quiet before it and 2.0+ in wars) — "many events, few deaths," the same fingerprint that later identifies ceasefire periods. Gaza's GMR deaths came from the protests and the response to them (Violent demonstration: 229; Excessive force against protesters: 27) plus the embedded flare-ups (Air/drone strike: 130). Meanwhile the West Bank was **busier but less deadly** (events 27.3 → 65.6/wk, mob violence 14 → 42.7/wk, but fatalities 2.2 → 1.0/wk — its lowest pre-war lethality at 0.015 fat/event), and its share of combined fatalities fell from 74% to 16% — a low-intensity preview of the war-time see-saw (0.8–1.9%).

### 3.2 Correlation structure: coupling is regime-level, not weekly

| Measure | Value | Reading |
|---|---|---|
| Pearson, weekly fatalities (all 566 wks) | **0.63** | Shared-epoch artifact — both series step up together at Oct 2023 |
| Spearman, weekly fatalities | 0.40 | Weaker once rank-dominant war weeks dominate |
| Pearson, week-over-week *changes* in fatalities | **0.04** | No week-to-week coupling at all |
| Lagged fatality levels (−8…+8 wks) | Peak 0.64 at lag −1 vs 0.63 at lag 0 | Symmetric, trend-driven; **no real lead/lag** |
| Within-regime Pearson, weekly *events* | 0.42 pre-Oct-2023 era (405 wks) — 0.80 quiet 2016–17 (0.27 excl. days of rage) · 0.11 GMR · 0.41 quiet 2020–21 · 0.12 war Dec 23–Jan 25 · **0.03** war Mar–Oct 25 · **0.63** ceasefire Oct 25–now | Wars decouple the theatres; the current ceasefire re-couples their event activity |

**26-week rolling correlation of fatality levels ("coupling meter"):**

- Quiet and GMR sub-regimes (2016 – early 2021): ≈ 0 (−0.2…+0.2) on fatalities — two statistically independent theatres at the weekly level (the GMR era's coupling, such as it is, lives in event volume, not deaths — see the days-of-rage bullet below)
- May 2021 war window: **+0.95** (holds ~0.92–0.95 through Oct 2021) — the only *war-time* synchronization: a joint war/uprising in which both territories' fatalities peaked together (WB: 20 fat/wk, its pre-Oct-2023 record)
- Oct 2023: **+0.84** at onset, then monotonic decay — +0.65 (Feb 2024) → +0.21 (Jun 2024) → **−0.27** (Nov 2024) → **−0.47** (Jul 2025)
- 2026: ≈ 0…+0.2, with event activity re-coupled (+0.63 within the ceasefire regime)
- **Dec 2017 – Mar 2018 "days of rage"** (US Jerusalem embassy recognition, Dec 6 2017): the one pre-war *event-volume* co-mobilization — over 16 weeks, Gaza events 6.3 → 22.8/wk (3.6×) and WB 18.9 → 79.8/wk (4.2×) simultaneously. It drives the `quiet_2016_17` within-window event correlation to r = 0.80, which collapses to 0.27 with that stretch excluded — a third low-intensity synchronization episode alongside May 2021 and the 2026 ceasefire re-coupling, reinforcing that the theatres co-mobilize when no war is on

Interpretation: the sign flip in 2024–2025 is the see-saw becoming the dominant mode — Gaza surging while the WB winds down. The coupling meter is itself a strong visualization channel (§5).

### 3.3 The see-saw: wars hollow out the West Bank — except at onset

- At **war onset** (Oct 2023), the WB spikes: 35 fat/wk, lethality 0.096 fat/event (its all-time high), events 366/wk. Fatalities that window: battles 119, riots 91, VAC 21, explosions 12 — simultaneous military operations and settler/mob violence.
- As the **war continues**, WB fatalities decay: 12.1 fat/wk (Dec 23–Jan 25) → 3.9 fat/wk (Mar–Oct 25) → 0.8% of combined fatalities. IDF attention/manpower concentrates in Gaza; armed clashes in the WB fall from 28.9/wk (Dec 23–Jan 25) to 2.8/wk (Mar–Oct 25).
- The same decay did **not** happen in May 2021, the one war that synchronized both theatres instead of emptying the WB (WB fat 20/wk; rolling r +0.95).

### 3.4 Ceasefires transfer violence to the West Bank — 3 for 3

**Episode 1 — Nov 2023 truce (1 week).** Gaza fatalities drop ~91% (2,189/wk → 188), yet WB fatalities *jump* to 31 (vs 12.1/wk in the surrounding 59-week war window), battles-driven (15 of 31) — military raids continued through the pause.

**Episode 2 — Ceasefire #1 (Jan 19 – Mar 17 2025).** Gaza: 43 fat/wk (−93% vs prior war window). WB: fatalities **stay at war level** (11.8/wk; 66% from battles) because Israel launched **Operation Iron Wall** in Jenin on Jan 21 — two days after the Gaza ceasefire began. WB events rose to 182/wk; attacks (VAC) jumped 18.1 → 28.9/wk and looting 17.9 → 27/wk vs the prior war window. Islamic Relief noted at the time that Israel escalated WB attacks during this ceasefire; the data confirms it. When the Gaza ceasefire collapsed (Mar 18), the WB *de-escalated* (3.9 fat/wk, clashes 2.8/wk) — the see-saw again, in both directions.

**Episode 3 — Ceasefire #2 (Oct 10 2025 → present, 55 weeks).** Gaza: 37 fat/wk (−92%). WB: events at their **all-time sustained high** (216.7/wk; Oct 2026 = 1,593 events, the record month in the dataset) but lethality at its **all-time low** (0.015 fat/event, 3.2 fat/wk). WB share of combined events rebounds 40% → 69%. This is the settler-violence wave — see §3.6.

**Settler-violence proxy events (per week), war window vs current ceasefire:**

| Sub-event | War (Mar–Oct 25) | Ceasefire (Oct 25–now) | Change |
|---|---|---|---|
| Mob violence | 79.8 | **124.5** | +56% |
| Looting/property destruction | 27.6 | **45.0** | +63% |
| Attack (violence against civilians) | 33.9 | 27.1 | −20% |
| Armed clash | 2.8 | 1.2 | −57% |

Violence doesn't stop during the ceasefire — it **migrates and changes form**: from military combat to settler-driven mob/property violence.

### 3.5 Form fingerprints: composition switches at regime boundaries

**Gaza event-type shares (events):**

| Window | Explosions/Remote | Battles | Strategic dev. | VAC | Protests | Riots |
|---|---|---|---|---|---|---|
| quiet_2016_17 | 15% | 2% | 42% | 5% | 19% | 17% |
| gmr_2018_19 | 21% | 3% | 41% | 4% | 16% | 15% |
| quiet_2020_21 | 12% | 3% | **68%** | 2% | 15% | 1% |
| may2021_war | **90%** | — | 6% | 1% | 2% | 1% |
| war_oct23 | **89%** | 9% | 1% | 1% | 0% | 0% |
| war_dec23_jan25 | 84% | 8% | 7% | 2% | 0% | 0% |
| cf_jan25_phase1 | 70% | 2% | 10% | **19%** | 0% | 0% |
| war_mar25_oct25 | 77% | 3% | 14% | 7% | 0% | 0% |
| cf_oct25_now | 70% | 2% | **16%** | **11%** | 2% | 0% |

**West Bank event-type shares (events):**

| Window | Riots | Battles | Strategic dev. | VAC | Protests | Explosions |
|---|---|---|---|---|---|---|
| quiet_2016_17 | 62% | 6% | 12% | 9% | 11% | 1% |
| gmr_2018_19 | **73%** | 1% | 14% | 7% | 5% | 0% |
| quiet_2020_21 | 60% | 2% | 18% | 8% | 12% | 0% |
| war_oct23 | 48% | **14%** | 15% | 13% | 9% | 2% |
| war_dec23_jan25 | 47% | **18%** | 16% | 11% | 5% | 3% |
| cf_jan25_phase1 | 48% | 9% | 23% | **16%** | 1% | 4% |
| war_mar25_oct25 | 50% | 2% | 22% | **21%** | 4% | 2% |
| cf_oct25_now | **58%** | **0.5%** | **27%** | 12% | 2% | 1% |

The WB "ceasefire fingerprint": battles collapse to near zero while riots (mob violence) and strategic developments (land seizures, outpost establishment) take over. Note the steady rise of WB strategic developments from 12–18% (quiet sub-windows) → 27% (current ceasefire) — ACLED codes land-seizure activity there, and 2026 H2 is dominated by it (513 events in Oct 2026 alone). The GMR-era WB riots share (73%) is the highest of any window — but a different phenomenon from the 2026 settler wave: roughly a third of the mob-violence volume (42.7 vs 124.5 events/wk) and far less deadly (19 riot deaths across 93 weeks vs 68 across 55).

### 3.6 The 2026 West Bank settler wave (the ceasefire counter-wave in detail)

Half-year WB event counts for the three settler-violence proxy sub-events:

| Half | Mob violence | Looting/prop. destr. | VAC attacks |
|---|---|---|---|
| 2016 H1–H2 | 186 / 152 | 61 / 61 | 66 / 59 |
| 2017 H1–H2 | 195 / 372 | 14 / 36 | 47 / 49 |
| 2018 H1–H2 | 1,335 / 1,352 | 116 / 182 | 103 / 84 |
| 2019 H1–H2 | 1,044 / 966 | 204 / 222 | 144 / 126 |
| 2020 H1–H2 | 1,043 / 1,055 | 285 / 355 | 157 / 153 |
| 2021 H1–H2 | 1,555 / 1,442 | 286 / 296 | 268 / 160 |
| 2022 H1–H2 | 2,202 / 2,127 | 308 / 348 | 194 / 204 |
| 2023 H1–H2 | 2,050 / 2,479 | 290 / 500 | 257 / 579 |
| 2024 H1–H2 | 1,868 / 2,046 | 355 / 556 | 445 / 499 |
| 2025 H1–H2 | 2,142 / 2,439 | 718 / 701 | 787 / 926 |
| **2026 H1** | **2,916** | **824** | 606 |
| **2026 H2 (Jul–Oct)** | **2,636** | **1,330** | 452 |

2026 H2 looting/property destruction (1,330 events in 4 months) runs at ~2.8× the 2025 H2 monthly rate; October 2026 alone (olive harvest + Oct 27 Israeli elections) recorded 919 riots + 513 strategic developments + 150 VAC — the most violent WB month for this event mix in the dataset. ACLED's own 2026 reporting attributes this to farming-outpost expansion (259 new outposts since 2023), armed settlers (203 settler shooting incidents Jan–Sep 2026 vs 48 in all of 2022), the Qusra siege (Aug 2026), the Till village killings (Jul 24 2026), and harvest-season attacks. **Crucially for the pattern: the wave accelerated *during* the Gaza ceasefire, not during the war.** The strategic-development stream shows the same acceleration on its own axis — 166 events in 2016, 773 in 2022, 1,963 in 2025, and 2,714 in 2026 through October — with at most six fatalities in any single year and zero exposure by design (§3.9): a wave only the event axis can see.

WB fatalities by type confirm the form shift — during `cf_oct25_now` only 36 of 173 WB fatalities come from battles (21%), vs 451 of 714 (63%) during `war_dec23_jan25`; riots (68) and VAC (61) now lead.

### 3.7 Lethality per event — the cleanest regime discriminator

| Window | Gaza fat/event | WB fat/event |
|---|---|---|
| quiet_2016_17 | 0.09 | **0.079** |
| gmr_2018_19 | 0.13 | **0.015** |
| quiet_2020_21 | 0.01 | 0.011 |
| may2021_war | 0.73 | 0.047 |
| post_may21_lull | 0.01 | 0.018 |
| aug2022_war | 0.52 | 0.022 |
| prewar_2022_23 | 0.03 | 0.035 |
| war_oct23 | **7.23** | **0.096** |
| truce_nov23 | 2.00 | 0.130 |
| war_dec23_jan25 | 2.55 | 0.074 |
| cf_jan25_phase1 | 0.86 | 0.065 |
| war_mar25_oct25 | 2.01 | 0.024 |
| cf_oct25_now | **0.38** | **0.015** |

Gaza war weeks are 5–19× more lethal per event than Gaza ceasefire weeks; the WB's lethality peaks with Gaza war *onsets* and bottoms during ceasefires even as its event counts peak. Events and lethality tell opposite stories in 2026 — a single-axis chart would mislead. The decomposition adds two nuances: quiet 2016–17 WB lethality (0.079) was *as high as the Dec 2023–Jan 2025 war window* (0.074) — the tail of the 2015–17 stabbing/vehicle-attack period was, death-per-event, war-grade — while the GMR-era WB matches the 2026 ceasefire low (0.015) and GMR-era Gaza barely moves from quiet baseline (0.13 vs 0.09), confirming its ceasefire-form character.

### 3.8 Gaza under ceasefire is not zero

During `cf_oct25_now` (55 weeks), Gaza still records ~98 events and ~37 fatalities per week:

| Sub-event (ceasefire) | Events/wk | Share | Fatalities (total, 55 wks) |
|---|---|---|---|
| Shelling/artillery/missile | 37.2 | 38% | 141 |
| Air/drone strike | 30.2 | 31% | **1,451** |
| Looting/property destruction | 11.0 | 11% | 0 |
| Attack (VAC) | 10.3 | 10% | 235 |
| Armed clash | 2.3 | 2% | 219 |

Structure: high-volume, near-zero-lethality shelling events (demolitions/controlled detonations, 0.08 fat/event) alongside low-volume, high-lethality drone strikes (0.87 fat/event) that supply ~72% of ceasefire-period fatalities. Spike weeks punctuate the pause: 2025-10-25 (129), 2026-01-31 (98), 2025-10-11 (84), 2025-11-22 (76), 2025-10-18 (70), 2026-05-23 (55). The VAC share of events also rises from 1.5% (mid-war) to 11–19% (ceasefires).

### 3.9 Population exposure: the "scale of human impact" dimension

Fatality counts in this conflict are contested, revised, and difficult to measure — which is precisely why ACLED built **conflict exposure** with WorldPop: the estimated number of residents within a type-dependent radius of each event (battles and explosions/remote violence: 5 km; riots: 2 km; violence against civilians: 2 km, or 5 km when fatal; protests: 1 km; strategic developments: none), Voronoi-deduplicated so repeated events in one neighborhood do not multiply the exposed count. The `population_exposure` column is this "best" estimate summed over the week. It measures proximity to violence — the scale of human impact — not casualties, and its limits matter here: the population baseline is static (WorldPop 2020–22) and not displacement-adjusted, so in Gaza it captures *residential* exposure (caveat 8).

**Per-window exposure statistics:**

| Window | Gaza px/wk | WB px/wk | WB % of combined px | Gaza px/event | WB px/event | Gaza px/fatality | WB px/fatality |
|---|---|---|---|---|---|---|---|
| quiet_2016_17 | 267k | 329k | 55% | 31.3k | 12.1k | 344.6k | 152.8k |
| gmr_2018_19 | 720k | 519k | 42% | 18.0k | 7.9k | 143.6k | 530.2k |
| quiet_2020_21 | 372k | 588k | 61% | 13.4k | 7.2k | 1.63M | 653.8k |
| may2021_war | 2.39M | 2.93M | 55% | 13.1k | 6.9k | 18.0k | 146.6k |
| post_may21_lull | 142k | 893k | 86% | 6.5k | 7.5k | 678.2k | 413.2k |
| aug2022_war | 1.05M | 1.20M | 53% | 22.7k | 8.7k | 43.6k | 399.9k |
| prewar_2022_23 | 270k | 1.20M | 82% | 12.1k | 7.6k | 360.1k | 220.7k |
| war_oct23 | 2.93M | 2.39M | 45% | 9.7k | 6.5k | **1.3k** | 68.3k |
| truce_nov23 | 2.41M | 1.64M | 40% | 25.6k | 6.9k | **12.8k** | 52.9k |
| war_dec23_jan25 | 2.79M | 1.24M | 31% | 11.2k | 7.6k | 4.4k | 102.9k |
| cf_jan25_phase1 | 742k | 1.09M | 60% | 14.8k | 6.0k | 17.3k | 93.0k |
| war_mar25_oct25 | 2.45M | 1.01M | 29% | 10.0k | 6.2k | 5.0k | 259.3k |
| **cf_oct25_now** | **1.49M** | 911k | 38% | 15.1k | 4.2k | **39.8k** | 287.9k |

Five findings:

**1. The ceasefire "scissors": deaths collapse, exposure persists.** Under the current ceasefire, Gaza's fatalities run at 7.6% of the prior war window's rate (37 vs 494/wk) but its exposure runs at **61%** (1.49M vs 2.45M/wk) — exposure-per-fatality rises **8×** (5.0k → 39.8k people-exposed per death). The same scissors appear at ceasefire #1 (fatalities to 6.7% of the prior war rate, exposure to 27%; px/fatality ×4) and in the Nov 2023 truce week (12.8k vs 1.3k px/fatality in the onset window). At the boundaries themselves: ceasefire #1's first full week shows fatalities −93% (396 → 26) but exposure −80% (2.64M → 530k), and ceasefire #2 shows fatalities −97% (482 → 12 by the week of Nov 1) but exposure only −55% (2.19M → 988k) — re-inflating to ~1.5M/wk through December 2025, with Aug–Sep 2026 weeks reaching 2.0–2.3M (94% of the prior war mean) *without* war-level fatalities. A fatality-only view says the war is over; exposure says most of its human footprint is still there.

**2. Under the current ceasefire, exposure and fatalities are statistically independent.** Within-window weekly correlation r(exposure, fatalities): 0.71 in `war_dec23_jan25`, **0.95** in `cf_jan25_phase1` (strikes dominated both metrics), but **0.13** (Gaza) and 0.15 (WB) in `cf_oct25_now`. When the metrics decouple, exposure stops being a fatality proxy and becomes its own dimension — the strongest statistical argument for giving it a separate axis in any visualization.

**3. What carries ceasefire exposure — and what it cannot see.** In `cf_oct25_now` Gaza, Explosions/Remote violence carries **75.9%** of all exposure (1.13M people/wk) on ~70% of events — and its lethality is near zero (141 deaths across ~2,050 shelling-coded events in the ceasefire), a signature consistent with demolition/engineering activity near populated areas rather than combat. Violence against civilians carries 17.1%. In the WB, riots carry 60.8% of exposure (554k/wk) and VAC 27.7% (252k/wk) — while strategic developments (26.6% of WB events) carry **zero exposure by design**: ACLED assigns them no radius, and the rule holds empirically (6 of 140,948 SD rows database-wide carry any exposure; none of the 2,522 in these two territories).

**Where the SD stream is captured: the event axis, only.** The WB's 3,173 ceasefire-window SD events carry 1 fatality and 0 exposure; they are 78% Looting/property destruction (2,474 events), 17% "Other" (535 — the closest aggregate-table proxy for ACLED's actor-tagged "land seizure" incidents), plus arrests, disrupted weapons use, and outpost establishment. The stream grows every year — 166 events (2016) → 773 (2022) → 1,963 (2025) → **2,714 (2026 through Oct)** — with at most 6 fatalities in any single year. It is fully present in every event-based view of this analysis (window means, composition shares, sub-event tables, monthly series, the event-space see-saw, within-regime event correlations) and structurally absent from every fatality- and exposure-based view. That asymmetry is not a gap — it is the mechanism of the central WB finding: the 2026 wave is visible only because event counts are kept as a first-class axis rather than folded into an intensity score. A fatality-only or exposure-only visualization would render the 2026 West Bank as near-peace while it undergoes its most intense territorial-control shift since ACLED monitoring began.

**4. The WB's three-way divergence: events ↑, fatalities ↓, exposure ↓.** During `cf_oct25_now` the WB sets its all-time event record (217/wk) while fatalities (3.2/wk) and exposure (911k/wk — down from 1.01M in the prior war window and a 1.20M peak in `prewar_2022_23`) both decline. Settler violence is rural, sparsely populated, and riot-coded (2 km radius): WB exposure per event has fallen steadily — 12.1k (quiet 2016–17) → 7.6k (pre-war) → **4.2k** (current). The record-event period is not a record-impact period by either deaths or exposure.

**5. The see-saw in exposure space is muted — but the coupling meter repeats.** The WB's share of combined exposure falls from 55–86% (quiet/lull windows) to **29–31%** in the long wars: a see-saw, but far gentler than the fatality share's collapse to 0.8–1.9%. The 26-week rolling correlation of weekly exposure (range −0.49…+0.92) mirrors the fatality coupling meter's shape: **+0.92** at May 2021, **+0.77** at Oct 2023, decaying through **−0.36** (Jan 2025) as the see-saw dominates, then re-coupling to **+0.43** by mid-2026. The regime-level coupling story is robust across both metrics.

**6. Violent vs non-violent origin: exposure is violence-carried by construction.** Each sub-event is classified as violent (all Battles, Explosions, VAC, both Riot forms — Mob violence and Violent demonstration — and Excessive force against protesters) or non-violent (Peaceful protest, Protest with intervention; Strategic developments carry zero exposure anyway). The result is unambiguous:

| Window | Gaza: violent % of events → % of px | WB: violent % of events → % of px |
|---|---|---|
| quiet_2016_17 | 44% → 89% | 78% → 93% |
| gmr_2018_19 | 56% → **96%** | 82% → 94% |
| quiet_2020_21 | 18% → 79% | 70% → 85% |
| may2021_war | 92% → 97% | 86% → 86% |
| post_may21_lull | 11% → 61% | 73% → 81% |
| aug2022_war | 74% → 98% | 75% → 82% |
| prewar_2022_23 | 26% → 71% | 80% → 86% |
| war_oct23 | 99% → 100% | 77% → 91% |
| truce_nov23 | 94% → 100% | 72% → 91% |
| war_dec23_jan25 | 93% → 100% | 79% → 91% |
| cf_jan25_phase1 | 90% → 100% | 76% → 96% |
| war_mar25_oct25 | 86% → 99% | 74% → 91% |
| cf_oct25_now | 83% → **98%** | 72% → **93%** |

**Violent events supply 79–100% of Gaza's and 81–96% of the WB's exposure in every single window** — including the GMR, the prototypical protest era, where peaceful marches carried just **4.1%** of Gaza's exposure (2.7M of 66.9M person-weeks) while the embedded flare-ups (46.8%), the violent fence confrontations themselves (~27%), and the live-fire response (~9%) carried the rest. In the current ceasefire, exposure is 97.9% violent-origin in Gaza and 93.0% in the WB (peaceful protests: 2.1% / 7.0%). Note the systematic gap between event shares and exposure shares — in `quiet_2020_21` Gaza, only 17.8% of *events* are violent yet they carry 78.7% of *exposure* (`post_may21_lull`: 11% → 61%; `prewar_2022_23`: 26% → 71%). This is partly by design: ACLED's radii scale with violence potential — a peaceful protest counts residents within 1 km, an explosion within 5 km, and VAC is upgraded to 5 km when fatal — so `population_exposure` is inherently a *violence-weighted* metric. It should be read as "residents near violence," never as "residents near unrest in general"; peaceful assembly is a thin sliver in every regime.

(The split is defined at the sub-event level because ACLED's own `disorder_type` doesn't provide it directly: "Demonstrations" bundles peaceful protests with violent demonstrations (311 fatalities all-time), Mob violence is coded as Political violence, and Excessive force against protesters — despite sitting under the Protests event type — carries the combined disorder "Political violence; Demonstrations." The per-window disorder breakdown is in `results.json` under `exposure_analysis.violent_vs_nonviolent_origin`.)

Data-quality notes: yearly totals confirm the exposure metric was backfilled across the full 2016+ series (nonzero in every year); 26–39% of aggregate rows carry zero exposure (partly the strategic-developments rule, partly genuinely remote events — highest share in 2026, consistent with the rural land-seizure wave); Gaza's yearly exposure peaks in 2024 (142.6M) and the WB's in 2023 (72.9M). The GMR's exposure (720k/wk) nearly equals ceasefire #1's (742k/wk) — a mass-protest era and a pause in a total war leaving almost identical residential footprints.

---

## 4. Caveats & limitations

1. **Weekly binning** blurs sub-week dynamics: the 7-day Nov 2023 truce is exactly one bin; every boundary week mixes ~1 day of the adjacent regime.
2. **Fatality counts during pauses** include recovered bodies and revised tallies; the 188 fatalities in the Nov 2023 truce week should be read as "a ~91% drop," not a precise truce body count.
3. **No actor fields** in this aggregate: settler attribution is compositional inference, corroborated by ACLED's published 2026 analysis, but event-level actor data would nail it.
4. **No ceasefire exists for the West Bank** as a formal instrument; its "quiet" is only relative. The analysis treats ceasefire as a Gaza-side regime and asks what the WB does.
5. **Window means on short windows** (may2021_war, aug2022_war, truce_nov23: 1–2 weeks) are illustrative, not statistically robust; the long windows (116, 93, 70, 59, 30, 55 weeks) are the load-bearing ones.
6. Correlations over the full period are dominated by the Oct 2023 step change; all "relationship" claims here are within-regime or rolling-window based.
7. **GMR sub-window boundaries are judgment calls, not step changes.** The GMR began Friday Mar 30 2018 (the first week bin contains one GMR day) and tapered rather than ended — the Jan 2020 cut reflects the taper plus COVID's end to mass gatherings. Its embedded micro-escalations (Nov 2018, May 2019, Nov 2019) are single-week spikes inside the window, not separate regimes.
8. **Exposure measurement limits.** `population_exposure` is a proximity estimate on a static WorldPop 2020–22 baseline: it is *not* displacement-adjusted — a major caveat for Gaza, where most of the population was displaced during the war, so wartime exposure reflects residential locations rather than the people actually present. Type-dependent radii (5 km for explosions vs 2 km for riots vs 1 km for protests, with fatal VAC upgraded to 5 km) mean composition shifts mechanically change exposure even at constant intensity — violent events are systematically amplified, so the metric is violence-weighted by construction (§3.9, finding 6); weekly sums across different locations can exceed a region's population (Gaza war exposure ≈ 2.9M/wk against ≈ 2.1–2.3M residents); and strategic developments — including the land-seizure/property-destruction wave — are assigned no exposure value by design (26–39% of aggregate rows carry zero exposure), leaving that stream visible only on the event axis (§3.9). Treat exposure as a scale-of-impact complement to fatalities, never as a casualty estimate.

---

## 5. Visualization design implications

The patterns above suggest these concrete encodings:

1. **Regime-banded dual timeline** — Gaza and WB weekly fatalities (log scale) over war/ceasefire shading, with labeled boundary events. The core narrative frame. The GMR sub-band gets its own shade — an elevated-ceasefire form, visually distinct from both quiet and war.
2. **Coupling ribbon** — the 26-week rolling correlation as a second channel under the main timeline. Its sign marks the system's relationship mode, and its flips track regime changes: −0.47 on the fatality meter at the Jul 2025 see-saw trough, crossing zero as the ceasefire fills the window, re-coupling to +0.43 on the exposure meter (Jun 2026) and +0.63 within-regime events — a trailing indicator, so flips *record* regime changes (up to ~a quarter-year lag) rather than pinpointing their dates.
3. **See-saw stacked area** — each territory's share of *combined events* vs *combined fatalities* per week/regime. The crossing lines at each ceasefire boundary ("WB is 69% of events but 8% of fatalities") are the story in one image.
4. **Lethality index line** — fatalities/event per region; the single best ceasefire/war discriminator (Gaza 2.0 → 0.4; WB 0.096 → 0.015).
5. **Composition streams** — stacked event-type shares per region with regime boundary markers; the "fingerprint switch" (battles → mob violence + land seizure) reads instantly.
6. **Boundary zoom panels** — ±8 weeks around each of the four transitions (Nov 24 2023, Jan 19 2025, Mar 18 2025, Oct 10 2025), dual region, events + fatalities + lethality.
7. **Settler counter-wave layer** — a dedicated stream of mob violence + looting + VAC attacks that visibly accelerates through the ceasefire period, annotated with ACLED's reported drivers (outposts, olive harvest, elections).
8. **Ceasefire "not zero" inset** — Gaza ceasefire fatalities decomposed into low-lethality shelling vs high-lethality strikes, with spike weeks flagged.
9. **The exposure "scissors" chart** — fatalities and exposure, each indexed to its pre-ceasefire war level, overlaid around every ceasefire boundary: deaths collapse while exposure persists (61% vs 8% under the current ceasefire). Exposure also serves as a third axis for the WB divergence (events ↑, fatalities ↓, exposure ↓) — and note the land-seizure wave is structurally invisible to it (§3.9).

---

## 6. Reproducibility

Aligned weekly series (zero-fill both regions across the week grid):

```sql
-- One row per week with both regions' totals side by side
SELECT week,
  sum(event_count) FILTER (WHERE admin1_id = 11610) AS gaza_events,
  sum(fatalities)   FILTER (WHERE admin1_id = 11610) AS gaza_fatalities,
  sum(event_count)  FILTER (WHERE admin1_id = 11611) AS wb_events,
  sum(fatalities)   FILTER (WHERE admin1_id = 11611) AS wb_fatalities
FROM acled_weekly_agg
WHERE admin1_id IN (11610, 11611)
GROUP BY week
ORDER BY week;
```

Detail pull used for composition/sub-event analysis:

```sql
-- All aggregate rows for the two territories
SELECT admin1_id, week, event_type, sub_event_type, event_count, fatalities, population_exposure
FROM acled_weekly_agg
WHERE admin1_id IN (11610, 11611);
```

Window classification (see §2.2) is applied in the analysis layer as `[start_week, end_week)` ranges on the Saturday week-start dates. The exposure dimension lives under the `exposure_analysis` key of `results.json` (rolling exposure coupling, exposure-vs-fatality correlations, exposure by event type, violent vs non-violent origin, boundary transitions, monthly series), with per-window exposure statistics in `window_summary`; the strategic-development stream and its event-axis-only capture are quantified under `strategic_developments`. A natural follow-up is persisting these as a `ceasefire_period` table (migration + `crushingviz.dbml` update) so the web app can join any series against labeled regimes.

## 7. Sources for regime boundaries & 2026 context

- Reuters / AP / Anadolu (Oct 10 2025): ceasefire effective 12:00 local; OCHA humanitarian reports covering "the October 2025 ceasefire" months 1–2
- Islamic Relief (Oct 15 2025): Jan 2025 ceasefire "broke down within weeks"; notes Israel "escalated its attacks on Palestinians in the West Bank, including East Jerusalem, during the ceasefire period"
- ACLED (Sep 30 2026) *"Settler violence in the West Bank hits record levels as farming outposts expand"*: 2026 most violent year since 2016 monitoring began; 259 new outposts since 2023 (186 farming); 203 settler shooting incidents Jan–Sep 2026 vs 48 in 2022; ~94% of settler investigation files closed without indictment
- ACLED (Oct 14 2026): 39 settler-violence incidents/day in early Oct 2026 (olive harvest) vs ~20/day in Sept; Oct 27 2026 Israeli elections
- ACLED (Jul 29 2026): record 460+ settler incidents in June 2026; Till village killings Jul 24 2026
- ACLED (Aug 19 2026): Qusra siege; 300 land-seizure incidents Jan–Aug 2026 (vs 267 in all of 2025)
- ACLED (Mar 27 2026): March 2026 settler rampages across ≥29 locations
- Operation Iron Wall (Jan 21 2025, Jenin) — launched two days after Gaza ceasefire #1 took effect
