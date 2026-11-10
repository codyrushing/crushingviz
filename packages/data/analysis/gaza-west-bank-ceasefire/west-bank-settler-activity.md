# Settler Activity in the West Bank: A Decade Ratchet, and the Record Ceasefire-Era Wave

**Exploratory analysis of `acled_weekly_agg` for visualization development — companion to `gaza-west-bank-ceasefire-patterns.md`**

- **Date:** November 17, 2026
- **Data:** ACLED weekly aggregates, 566 continuous weeks (week of 2015-12-26 → week of 2026-10-24), no gaps; weeks bin Saturday–Friday
- **Region:** West Bank (`admin1_id = 11611`) — 63,558 events / 2,282 fatalities all-time. Gaza appears only as the war/ceasefire regime axis (windows reused from the sibling analysis)
- **Headline objects:** a *settler-activity proxy* built from sub-event composition (no actor fields exist in this table — see §2), read against Gaza ceasefire boundaries, Israeli elections and coalition politics, the agricultural calendar, and — via a parallel pair of IDF-activity tiers — the military campaign itself (§3.8)

---

## 1. Executive summary

1. **Settler activity is a ratchet, not a cycle.** Every escalation era raises the level and none of the de-escalations gives the ground back. The most settler-attributable stream (property destruction + land seizure, the "core proxy," §2.2) runs at these era means per week: 2.0 (2016–17 trough) → 7.5 (post-Jerusalem 2018–19) → 14 (2020–22 plateau) → 23–37 (2023–25, war era) → **89 (Jul–Oct 2026)**. The 2016–17 floor is 45× below the current rate, and on the core stream no era after 2018 ever falls to even half the level of the era before it (§3.1).
2. **The current wave is the record on every measure, by wide margins.** October 2026 is the largest month in the dataset for the broad complex (1,560 events; 1.45× the previous record, October 2023), for the core stream (497; **2.56×** the previous record), and for mob violence (918; 1.41×). Eight of the ten biggest broad-complex months ever fall inside the current ceasefire (Nov 2025 →); the top six core months ever are all 2026 (§3.2).
3. **Quantitative grounding: the rolling 52-week core total (Nov 2025–Oct 2026: 2,892 events) is 3.5× the best 52-week stretch before the Gaza war, 1.7× the best stretch of the entire Oct-2023–Oct-2025 war era, and 43× the 2016–17 trough.** The broad complex's 52-week total (10,741) sits at the 99.8th percentile of all 515 windows. With two months still to run, 2026 core events (2,574 through October) already exceed any full calendar year (2025: 1,815) (§3.2).
4. **The wave is a ceasefire-era phenomenon — but not a simple ceasefire-response.** The settler stream spiked at *war onset* (Oct 2023: core ×3.2 across the boundary; October 2023 then stood as the record month for nearly three years, until August 2026), plateaued at roughly twice the pre-war rate through the long war, then accelerated at *each* ceasefire: +66% at ceasefire #1 (Jan 2025, against the surrounding war window), +16% at ceasefire #2 (Oct 2025) and then ×2.28 from July 2026 (change-point scan: breaks at the weeks of Jun 20 and Sep 5 2026). Weekly-level correlation with Gaza fatalities is ≈0 in every regime — the relationship is regime-level, not weekly (§3.4).
5. **The same sub-event code flipped perpetrators over the decade.** In 2018, the mob-violence stream (224 events/mo) ran ~8× OCHA's actor-verified settler-attack count (27/mo): it was then mostly Palestinian crowd confrontation. In Sept 2026 the same stream (19.1 events/day) matches ACLED's own actor-tagged settler rate (~20/day). The fatality signature confirms the flip: May 2021 and Oct 2023 mob events fell 100% in weeks with fatalities (0.03–0.07 fatalities/event); the 2026 record weeks are nearly bloodless (Oct 2026: 918 events, 1 fatality) (§3.3).
6. **The wave is happening in an emptied field.** Confrontational streams (armed clashes, violent demonstrations, excessive force — the anti-raid/organized-protest complex) collapsed from 2,124 events in 2023 to 58 in the first ten months of 2026. The settler complex now supplies **96.8% of all West Bank events** (vs 60.7% in 2016–17). It is also low-lethality (0.0087 fatalities/event in the acceleration era vs 0.069 at Oct 2023 onset) and carries little exposure by construction — a wave only the event axis can see, exactly as the sibling analysis found for the strategic-development stream (§3.7; the IDF-side quantification is §3.8).
7. **Israeli elections show no consistent signal; the governing coalition does.** Across the six Knesset elections in the data window, the broad complex moves −26%, +24%, +8%, +9%, −11%, +12% across the ±8-week boundary — noise, and the two elevated Octobers (2022, 2026) coincide with olive-harvest season, the calendar's reliable peak (October core index 1.28 vs the average month). The structural marker is the **Dec 29 2022 far-right coalition** (settlement administration to Smotrich; police incl. Border Police to Ben Gvir): not an immediate step, but the start of the unbroken 2023–2026 climb — core yearly totals 762 (2022) → 979 → 1,147 → 1,815 → 2,574* — coinciding with the enforcement collapse ACLED documents (94% of settler investigation files closed without indictment). The Oct 27 2026 election happened *inside* the record month, and the far-right bloc lost its majority; the wave peaked under a caretaker government (§3.5).
8. **The proxy validates against actor-verified counts.** Yearly core totals track OCHA's settler-attack series (2016–2025) at Pearson r = 0.94 / Spearman 0.98, and in 2025 the two are nearly identical (1,815 vs 1,828). ACLED's own 2026 figures land within ~5% of the matching streams (land seizures Jan–Aug: 314 vs claimed 300; June settler incidents: mob 482 vs claimed 460+) (§2.3).
9. **The IDF stream confirms the handoff from the other side.** A parallel IDF tier pair (§2.2) shows the military campaign peaking in 2023–24 at ~30 contested operations per week — 16–18% of all WB events — then collapsing to 1.5/wk (0.7%) in 2026, while the unilateral tier (arrests + seizures, a floor on policing activity) keeps running at ~140/yr annualized against its 2024 peak of 171: the IDF didn't leave, the fighting ended. The resistance tier (grenade + IED) holds at ~190/yr through 2025 as the method shifts to explosives, then collapses −91% in 2026 — gunfights died in 2025, bombs died in 2026. On a rolling 52-week basis, the settler core permanently overtakes IDF combat at the window ending **Mar 15 2025** — during Iron Wall and the drawdown, *before* the October 2025 ceasefire — and now out-runs it 31:1 (§3.8).

---

## 2. Data & method

### 2.1 Scope and structure

`acled_weekly_agg` is pre-aggregated to (week × admin1 × sub_event_type) with `event_count`, `fatalities`, `population_exposure`, and one centroid per cell (the centroid is the admin1 stub in this ingest — confirmed identical across all cells — so no geography is available; see caveat 2). All analysis is from the West Bank rows plus a Gaza weekly total for the regime axis. Weeks with zero events produce no rows, so series are zero-filled across the 566-week grid. Monthly bins take the week-start's month; a Saturday-start week straddles month boundaries by up to six days.

### 2.2 Defining "settler activity" — and its military context — without actor fields

The table has no actor fields, so activity is proxied at the sub-event level. The settler and confrontation lenses use three nested definitions; a parallel pair of IDF-activity tiers plus a resistance tier (read in §3.8) is defined in the same table:

| Definition | Streams | Rationale |
|---|---|---|
| **Core proxy** | Looting/property destruction (SD) + "Other" (SD) | The property-destruction and land-seizure stream. In the West Bank this is predominantly settler- or state-perpetrated against Palestinian land and property; ACLED's own land-seizure counts for 2026 match the "Other" stream within ~5% (§2.3). Almost no fatalities, no exposure by design. |
| **Broad proxy** | Core + Mob violence (Riots) + Attack (VAC) | The civilian-facing violence complex — the sibling report's settler-violence proxy plus the SD streams. Includes streams of *mixed* attribution (see §3.3). |
| **Confrontational** | Armed clash + Violent demonstration + Excessive force against protesters | Streams that are predominantly organized Palestinian confrontation (or the state's lethal response to it): raids, funerals, demonstrations. Used as the attribution *diagnostic*, not as settler activity. |
| **IDF combat** | Armed clash + Air/drone strike + Shelling/artillery | The military-operations measure. Aircraft and artillery are IDF-exclusive in the West Bank, and nearly every WB battle has the IDF as a party. *Interactional* — it counts operations *met by resistance*, i.e. campaign intensity, not operational tempo (§3.8, caveat 10). |
| **IDF unilateral** | Arrests + Disrupted weapons use (SD) | Purely IDF-perpetrated policing/seizure activity, but ACLED codes only *notable* arrests (~44–60/yr against the 161–183 search-and-arrest operations *per week* OCHA recorded at the 2024 peak) — a floor, never a tempo measure. |
| **Resistance** | Grenade + Remote explosive/IED | Predominantly militant-perpetrated (the camp IED war of 2024–25) — the mirror of the IDF tiers and the quantitative trace of organized armed resistance. |

Attribution is **era-dependent** and is treated as a measurement problem rather than assumed: §3.3 shows how the mob-violence stream changes dominant perpetrator across the decade, and §2.3 validates the proxy against two actor-verified external counts. VAC "Attack" is the most contaminated broad stream (it also contains IDF violence and Palestinian attacks on settlers/IDF), which is why the core proxy excludes it and attribution claims lean on core + mob diagnostics. The IDF combat tier deliberately shares the clash stream with the confrontational diagnostic — the same events read once as organized Palestinian confrontation and once as the military campaign that meets it — two lenses on one stream, not independent measures; the IDF tiers' own validation anchors (OCHA's by-perpetrator fatality split, UNRWA's airstrike count, and the search-and-arrest tempo) are given in §3.8.

### 2.3 Validation against actor-verified counts

**OCHA yearly** ("attacks by Israeli settlers against Palestinians that resulted in casualties and/or property damage," 2016–2025):

| Year | ACLED core | ACLED looting | OCHA | core/OCHA |
|---|---|---|---|---|
| 2016 | 135 | 122 | 95 | 1.42 |
| 2017 | 67 | 50 | 179 | 0.37 |
| 2018 | 336 | 298 | 330 | 1.02 |
| 2019 | 480 | 426 | 367 | 1.31 |
| 2020 | 747 | 640 | 379 | 1.97 |
| 2021 | 697 | 582 | 532 | 1.31 |
| 2022 | 762 | 656 | 852 | 0.89 |
| 2023 | 979 | 790 | 1,291 | 0.76 |
| 2024 | 1,147 | 911 | 1,449 | 0.79 |
| 2025 | 1,815 | 1,419 | 1,828 | **0.99** |
| 2026* | 2,574 | 2,154 | — | — |

Correlations 2016–2025: Pearson 0.941 (core) / 0.931 (looting); Spearman 0.976. The *level* ratio swings (definitional: OCHA counts only incidents with casualties/damage; ACLED's looting stream also absorbs some state-led demolitions — 2020, the record-demolition COVID year, is the outlier at 1.97), but the *trend* is the same series — including the 2016–17 floor, the 2018 doubling, and the 2023–2026 explosion. OCHA's Dec 2025 update: >1,770 settler attacks in 2025, "an average of five incidents per day," 65% in Ramallah, Nablus and Hebron governorates.

**ACLED's own 2026 actor-tagged counts** (cited in the sibling report §7) vs the matching streams:

| ACLED claim | Matching stream | Value |
|---|---|---|
| Record 460+ settler incidents, June 2026 | Mob violence, June 2026 | 482 |
| ~20 settler incidents/day, Sept 2026 | Mob violence/day, Sept 2026 | 19.1 |
| 39 incidents/day, early Oct 2026 | Broad/day, weeks of Oct 3+10 | 59.4 (mob-only: 32.9) |
| 300 land-seizure incidents, Jan–Aug 2026 | SD "Other", Jan–Aug 2026 | 314 |
| 203 settler shootings, Jan–Sep 2026 (48 in all of 2022) | VAC Attack, Jan–Sep 2026 | 913 (2022: 398) — shootings are a subset of this mixed stream |

The mob stream ≈ ACLED's actor-tagged settler counts in 2026 (ratio ~0.95–1.05); the same stream ran ~8× OCHA's settler count in 2018 — the compositional flip quantified in §3.3.

### 2.4 Eras and markers

The settler-activity segmentation (**12 eras**) is West-Bank-native, anchored to documented events, and deliberately *not* a copy of the Gaza regime windows (those are used separately in §3.4):

| # | Era | Weeks | Anchor |
|---|---|---|---|
| 1 | `trough_2016_17` | 100 | Post-knife-intifada trough; OCHA's lowest settler-attack years (2016: 95, lowest since monitoring began); UNSC Res 2334 (Dec 2016) |
| 2 | `jerusalem_2018_19` | 109 | US Jerusalem recognition (Dec 6 2017); "days of rage" + GMR-era co-mobilization; OCHA settler attacks double off the 2017 floor |
| 3 | `covid_2020_21` | 70 | COVID quiet-to-creep; Trump peace plan (Jan 2020) endorses annexation; record IDF demolition year 2020 |
| 4 | `may21_uprising` | 2 | May 10–21 2021 war / joint uprising |
| 5 | `escalation_2021_22` | 84 | Post-war lull into 2022 escalation: Apr 2022 (Temple Mount / Operation Wave Breaker), Oct 2022 spike; Nov 1 2022 election |
| 6 | `coalition_2023` | 40 | Far-right coalition sworn in Dec 29 2022; Huwara rampage Feb 26 2023; record OCHA settler months mid-2023 |
| 7 | `war_onset_oct23` | 7 | Oct 7 attack; settler wave hits its (then) record |
| 8 | `war_era_nov23_jan25` | 60 | Truce + long Gaza war; OCHA settler records 2023 (1,291), 2024 (1,449) |
| 9 | `cf1_ironwall_jan25` | 8 | Gaza ceasefire #1 (Jan 19 2025); Operation Iron Wall in the WB from Jan 21 |
| 10 | `war_mar25_oct25` | 30 | Gaza war resumes (Mar 18 2025); WB armed activity suppressed |
| 11 | `cf2_oct25_jun26` | 38 | Gaza ceasefire #2 (Oct 10 2025); wave builds through H1 2026 |
| 12 | `cf2_accel_jul26_oct26` | 17 | The acceleration: farming-outpost wave, Qusra siege (Aug 2026), Till killings (Jul 24 2026), harvest + Oct 27 2026 election |

The Jul 4 2026 split inside ceasefire #2 is a descriptive judgment call, supported by the change-point scan (§3.4): the top two 8-week breaks on the core stream land at the weeks of **Jun 20 2026** (46.3 → 73.9/wk) and **Jul 4 2026** (48.6 → 76.0/wk), with a second step at **Sep 5 2026** (77.3 → 103.9/wk). Event studies (±8 weeks, pre vs post means) are computed for 16 dated markers: six Knesset elections, the coalition formation, the embassy recognition, the peace plan, Huwara, the Oct 7 onset, the three Gaza ceasefire boundaries plus the Nov 2023 truce, the Qusra siege, and the 2026 election.

---

## 3. Findings

### 3.1 The long history: a ratchet, not a cycle

**Era means per week:**

| Era | Mob | Looting | Attack | SD-Other | **Core** | **Broad** | Confr. | Mob fat/event | Broad % of WB events |
|---|---|---|---|---|---|---|---|---|---|
| trough_2016_17 | 7.4 | 1.7 | 2.1 | 0.3 | **2.0** | 11.5 | 4.0 | 0.0488 | 60.7% |
| jerusalem_2018_19 | 44.6 | 6.7 | 4.3 | 0.9 | **7.5** | 56.4 | 6.8 | 0.0060 | 83.4% |
| covid_2020_21 | 42.3 | 11.9 | 6.4 | 2.1 | **14.1** | 62.8 | 7.4 | 0.0047 | 77.3% |
| may21_uprising (2wk) | 199 | 2.5 | 32.5 | 3.5 | **6.0** | 237.5 | 131 | 0.0302 | 56.1% |
| escalation_2021_22 | 71.4 | 12.1 | 7.3 | 2.0 | **14.2** | 92.9 | 18.2 | 0.0077 | 71.3% |
| coalition_2023 | 78.3 | 11.9 | 10.2 | 2.4 | **14.2** | 102.7 | 31.5 | 0.0077 | 67.1% |
| war_onset_oct23 (7wk) | 138.3 | 29.6 | 46.4 | 10.3 | **39.9** | 224.6 | 89.6 | 0.0692 | 61.3% |
| war_era_nov23_jan25 | 76.7 | 18.3 | 18.2 | 4.5 | **22.8** | 117.6 | 30.2 | 0.0165 | 71.7% |
| cf1_ironwall_jan25 | 87.1 | 27.0 | 28.9 | 9.9 | **36.9** | 152.9 | 15.9 | 0.0086 | 84.2% |
| war_mar25_oct25 | 79.8 | 27.6 | 33.9 | 6.3 | **33.9** | 147.6 | 3.3 | 0.0117 | 90.2% |
| cf2_oct25_jun26 | 110.8 | 30.1 | 27.3 | 9.1 | **39.2** | 177.3 | 2.1 | 0.0107 | 94.1% |
| **cf2_accel_jul26_oct26** | **155.1** | **78.2** | 26.6 | 11.2 | **89.4** | **271.1** | **1.1** | 0.0087 | **96.8%** |

Read the **core** column left to right — the property/territorial stream, the one with the cleanest settler attribution: 2.0 → 7.5 → 14 → [6.0, the 2-week May 2021 fortnight] → 14 → 14 → 40 (onset spike) → 23 → 37 → 34 → 39 → **89**. Three properties of that path matter:

1. **The floor never comes back.** After the Dec 2017 step (×3.75), no sustained era ever falls below 14/wk — not the post-war lull (14.2), not the long Gaza war's wind-down (22.8), not the March 2025 ceasefire collapse (33.9); the only dip is the 2-week May 2021 uprising itself (6.0), a confrontation fortnight during which the property stream paused (see point 2). Every "de-escalation" (war_era 22.8, war_resume 33.9) settles far above the *previous* plateau, not below it.
2. **The confrontation waves don't move it.** May 2021 — the biggest confrontational explosion in the dataset (131 events/wk) — leaves the core stream untouched (6.0/wk that fortnight; 14.2/wk in the escalation era that follows, i.e. the same plateau as before the uprising). The core stream is decoupled from the battle rhythm; it tracks land, not clashes.
3. **The two big steps are Oct 2023 (war onset) and Jul 2026 (ceasefire acceleration).** War onset: ×2.8 in eight weeks (12.9 → 41.3/wk core). The acceleration era: ×2.28 over the ceasefire's own first nine months (39.2 → 89.4/wk).

The broad complex tells the same story with crowd-noise overlaid — its 2018 step (11.5 → 56.4, ×4.9) is mostly *not* settler activity (§3.3) — while the **yearly totals** make the ratchet unambiguous:

| Year | Broad | **Core** | Mob | Looting | Attack | SD-Other | Confrontational | OCHA |
|---|---|---|---|---|---|---|---|---|
| 2016 | 598 | **135** | 338 | 122 | 125 | 13 | 166 | 95 |
| 2017 | 730 | **67** | 567 | 50 | 96 | 17 | 318 | 179 |
| 2018 | 3,210 | **336** | 2,687 | 298 | 187 | 38 | 396 | 330 |
| 2019 | 2,760 | **480** | 2,010 | 426 | 270 | 54 | 257 | 367 |
| 2020 | 3,155 | **747** | 2,098 | 640 | 310 | 107 | 415 | 379 |
| 2021 | 4,122 | **697** | 2,997 | 582 | 428 | 115 | 754 | 532 |
| 2022 | 5,489 | **762** | 4,329 | 656 | 398 | 106 | 1,182 | 852 |
| 2023 | 6,344 | **979** | 4,529 | 790 | 836 | 189 | 2,124 | 1,291 |
| 2024 | 6,005 | **1,147** | 3,914 | 911 | 944 | 236 | 1,487 | 1,449 |
| 2025 | 8,109 | **1,815** | 4,581 | 1,419 | 1,713 | 396 | 317 | 1,828 |
| 2026* | **9,184** | **2,574** | 5,552 | 2,154 | 1,058 | 420 | **58** | — |

\* through October. The core column jumps 5× from the 2017 floor to 2018, then rises in near-monotone steps (×1.6 in 2020, ×1.6 in 2025) with only one small dip (2020→2021, −7%). Note 2017 — the dataset's settler floor (core 67) — and note what the 2026 row does *not* contain: with confrontational activity at 58 events in ten months (vs 2,124 in 2023, a 36-fold collapse), the broad complex in 2026 is, for the first time in the decade, essentially *only* the settler streams.

### 3.2 The current wave in quantitative context

**Records (monthly):**

- **Top broad months ever:** Oct 2026 (1,560) · Aug 2026 (1,120) · Oct 2023 (1,079) · Sep 2026 (1,012) · May 2026 (956) · Nov 2025 (926) · Jul 2026 (916) · Jan 2026 (866) · Oct 2025 (809) · May 2025 (775). Eight of ten inside the ceasefire; Oct 2026 = 1.45× the prior all-time record (Oct 2023) and 2.2× the best pre-war month (Oct 2022: 708).
- **Top core months ever:** Oct 2026 (497) · Aug (386) · Sep (334) · Jul (303) · May (230) · Jun (215) — **all six are 2026**; the best pre-2026 month is Oct 2023 (194), so the current record is 2.56× it. Looting alone in Oct 2026 (431) is 2.9× the best month of any year before 2026 (147).
- **Top mob months ever:** Oct 2026 (918, **1 fatality**) · Oct 2023 (653, **46 fatalities**) · May 2026 (637) · Aug 2026 (631) · Oct 2022 (582) — see §3.3 for the fatality contrast.

**Rolling 52-week windows (515 windows; current = Nov 2025–Oct 2026):**

| Measure | Current | Best pre-ceasefire stretch | Best pre-war stretch | Worst ever (trough) |
|---|---|---|---|---|
| Broad | 10,741 (99.8th pct) | 7,371 → **1.46×** | 5,723 → **1.88×** | 502 → **21.4×** |
| Core | 2,892 (99.8th pct) | 1,692 → **1.71×** | 817 → **3.54×** | 67 → **43.2×** |

(The few windows at or above the current one are overlapping slices of the same wave. "Pre-ceasefire" = windows ending before Oct 10 2025; "pre-war" = before Oct 7 2023.)

**Era-multiple view:** the acceleration era's 271 broad/wk is 23.6× the 2016–17 trough (11.5), 2.6× the coalition era (102.7), and 2.3× the long-war era (117.6); its 89 core/wk is 45× the trough, 6.3× the coalition era, and 3.9× the long-war era.

**Simplest statement of all:** 2026's first ten months — core 2,574 — already exceed every full calendar year in the dataset, including 2025's record 1,815 (+42% with two months uncounted). The same is true for mob (5,552 vs 2023's 4,529) and the broad complex (9,184 vs 2025's 8,109).

### 3.3 Reading the mix: the mob-violence stream flipped perpetrators

The decade's biggest-volume proxy stream, Mob violence, is *not* one phenomenon. Three independent anchors pin down its changing composition:

**1. External counts.** In 2018 the stream averages 224 events/mo while OCHA's actor-verified settler attacks average 27/mo — the stream was then at most ~12% settler; it was mostly the post-Jerusalem crowd-confrontation wave (days of rage, funeral clashes, the GMR-era West Bank co-mobilization the sibling analysis documents). In Sept 2026 the stream averages 19.1 events/day against ACLED's actor-tagged ~20 settler incidents/day — a ~1:1 match. June 2026: 482 vs "460+."

**2. The fatality signature.** Settler rampages against villages and property rarely kill; crowd confrontations met with lethal force do:

| Era | Mob events | Mob fatalities | fat/event | % of mob events in weeks with ≥1 mob fatality |
|---|---|---|---|---|
| trough_2016_17 | 737 | 36 | 0.0488 | 33.9% |
| jerusalem_2018_19 | 4,865 | 29 | 0.0060 | 22.0% |
| covid_2020_21 | 2,962 | 14 | 0.0047 | 17.0% |
| may21_uprising | 398 | 12 | 0.0302 | **100%** |
| escalation_2021_22 | 6,001 | 46 | 0.0077 | 40.7% |
| coalition_2023 | 3,133 | 24 | 0.0077 | 50.2% |
| war_onset_oct23 | 968 | 67 | **0.0692** | **100%** |
| war_era_nov23_jan25 | 4,600 | 76 | 0.0165 | 62.9% |
| war_mar25_oct25 | 2,395 | 28 | 0.0117 | 56.1% |
| cf2_oct25_jun26 | 4,210 | 45 | 0.0107 | 66.2% |
| cf2_accel_jul26_oct26 | 2,636 | 23 | 0.0087 | 53.3% |

The record *weeks* sharpen it further: the four biggest mob weeks in the dataset are all October 2026 (261, 234, 226, 197 events) with **zero or one fatality each**; the previous record weeks — May 2021 (200, 198 events; 7 and 5 dead) and the Oct 2023 onset weeks (193 events, 16 dead; 155, 10; 153, 11) — were lethal-force events. October 2026 as a whole: **918 events, 1 fatality** (0.001/event) vs October 2023: 653 events, 46 fatalities (0.070/event) — a ~65-fold difference in lethality for the same sub-event code at similar volume.

**3. The confrontational collapse.** The diagnostic streams tell the same story from the other side: armed clashes + violent demonstrations + excessive force ran 30–90/wk through 2021–2025; in 2026 they total **58 events in ten months** (2023: 2,124). The Palestinian organized-confrontation field that filled the mob stream in 2018 has been suppressed to statistical zero — Iron Wall and two years of raids did that — so the 2026 mob surge can only be the settler wave, which is exactly what ACLED's actor tags and OCHA's counts independently say.

Interpretive consequence for the whole series: **the 2018 broad-complex step (×4.9) is mostly a Palestinian crowd wave; the 2026 step (×1.53 over the ceasefire's first nine months, on top of an already-record base) is mostly settler rampages.** Any visualization that plots "mob violence" as one line across the decade will silently join two different phenomena — the fatal-week shading in §5 (item 3) exists to prevent that.

### 3.4 The ceasefire relationship: onset spike → war plateau → ceasefire acceleration

**Proxy means inside the Gaza regime windows** (from the sibling analysis):

| Gaza window | Weeks | Broad/wk | Core/wk | Confr/wk | Gaza fat/wk |
|---|---|---|---|---|---|
| quiet_2016_17 | 116 | 18.7 | 2.3 | 4.8 | 0.8 |
| gmr_2018_19 | 93 | 55.2 | 8.0 | 6.2 | 5.0 |
| quiet_2020_21 | 70 | 62.8 | 14.1 | 7.4 | 0.2 |
| may2021_war | 2 | 237.5 | 6.0 | 131 | 133 |
| post_may21_lull | 62 | 88.0 | 13.9 | 12.9 | 0.2 |
| prewar_2022_23 | 60 | 105.0 | 14.4 | 31.9 | 0.8 |
| **war_oct23** | 7 | **224.6** | **39.9** | 89.6 | 2,189 |
| truce_nov23 | 1 | 181.0 | 51.0 | 34 | 188 |
| war_dec23_jan25 | 59 | 116.5 | 22.3 | 30.1 | 638 |
| **cf_jan25_phase1** | 8 | **152.9** | **36.9** | 15.9 | 43 |
| war_mar25_oct25 | 30 | 147.6 | 33.9 | 3.3 | 494 |
| **cf_oct25_now** | 55 | **206.3** | **54.7** | **1.8** | 37 |

The pattern is not "ceasefires transfer violence" (the sibling report's framing for the WB *aggregate*, which holds) — for the settler stream it is three-phase:

1. **War onset: the settler stream spikes with the war.** Across Oct 7 2023, core jumps ×3.2 in eight weeks (12.9 → 41.3/wk) and broad ×2.3 (94 → 219); October 2023 is then the all-time record month, and it is not close (broad 1,079 vs the previous record 708). Looting doubles, land-seizure events quadruple — the ACLED-documented settler wave of Oct–Nov 2023.
2. **Long war: plateau at ~2× pre-war.** The core stream settles at 22–34/wk (vs 14 pre-war) through Dec 2023–Oct 2025. Gaza's intensity does nothing to it: within-window weekly correlation of the broad proxy with Gaza fatalities is **−0.23 to +0.16 in every window** (full-period pre-Oct-2023 r = 0.24 — shared drift, not synchronization; war era −0.06; ceasefire era +0.05). The settler stream runs on its own clock.
3. **Ceasefires: acceleration, twice.** Ceasefire #1 (Jan 19 2025): core +66% vs the surrounding war window (22.3 → 36.9/wk; looting 18.3 → 27.0; event-study ratio across the boundary 1.37) — even as Iron Wall filled the battles stream. When that ceasefire collapsed (Mar 18 2025), the core stream *trimmed* (33.9/wk; event-study ratio 0.87) — the see-saw in miniature. Ceasefire #2 (Oct 10 2025): broad +30% across the boundary (147.5 → 191.9/wk), then compounding month after month — core 142 (Oct 2025) → ~150 (Nov 2025–Apr 2026) → 215–230 (May–Jun) → 300–390 (Jul–Sep) → **497 (Oct 2026)**, with the change-point scan dating the steps to the weeks of **Jun 20 2026** (46.3 → 73.9/wk) and **Sep 5 2026** (77.3 → 103.9/wk).

So the current record wave is *not* a war wave — it is what the settler stream does through 13 consecutive months of Gaza ceasefire, in a West Bank whose armed confrontation has been emptied out (confrontational streams ≤3/wk throughout cf2; 96.8% of all WB events are now the settler complex). The acceleration's content is territorial: the looting stream steps from ~105/mo (early 2026) to 266–431/mo (Jul–Oct 2026), tracking ACLED's farming-outpost wave, the Qusra siege, and the harvest. The military side of this substitution — dated on a rolling basis — is quantified in §3.8.

One boundary caveat: the Nov 2023 truce's ±8-week event study shows a *drop* (broad 202.8 → 124.9) — an artifact of its pre-window containing the Oct 2023 onset record; the window means above (truce week core 51/wk, the highest of any single window to that point) are the unbiased read.

### 3.5 Elections, coalitions, and the politics that does track

**±8-week event studies around the six Knesset elections and the coalition formation:**

| Marker | Broad pre→post (ratio) | Core pre→post (ratio) | Confr pre→post |
|---|---|---|---|
| Apr 9 2019 election | 64.6 → 47.5 (0.74) | 10.9 → 7.6 (0.70) | 7.3 → 4.4 |
| Sep 17 2019 election | 43.8 → 54.4 (1.24) | 7.0 → 10.1 (1.44) | 2.6 → 3.1 |
| Mar 2 2020 election | 58.4 → 62.9 (1.08) | 9.3 → 13.4 (1.44) | 29.6 → 4.6 |
| Mar 23 2021 election | 74.0 → 80.3 (1.09) | 17.9 → 8.1 (0.45) | 3.6 → 25.8 |
| Nov 1 2022 election | 124.5 → 110.8 (0.89) | 12.5 → 16.8 (1.34) | 42.1 → 29.9 |
| **Dec 29 2022 coalition** | 110.8 → 104.5 (0.94) | 16.8 → 15.3 (0.91) | 29.9 → 40.8 |
| Oct 27 2026 election | 303.5 → 341.0 (1.12) | 100.9 → 105.0 (1.04) | 1.4 → 0.0 |

Three readings:

1. **No election cycle.** The broad-complex ratios swing −26%…+24% with no sign pattern; the core's moves around individual elections (−55%…+44%) are within the stream's ordinary monthly noise, and the two big Mar–Apr swings are contaminated by adjacent shocks (the Mar 2020 pre-window contains the Trump-peace-plan protest wave — confrontational 29.6/wk, mostly February's demonstrations; the Mar 2021 pre-window sits 8 weeks before the May war, and its high core baseline reflects the Jan–Feb 2021 settlement-approval surge).
2. **October confound.** The only elections that coincide with visibly elevated settler activity are the two late-October ones (2022, 2026) — and October is reliably the calendar's peak month independent of politics (§3.6). October 2022's 582 mob events (then a record) are harvest + the raid escalation + a pre-election settler surge reported at the time; October 2026's 918 are the ceasefire wave's own trajectory arriving at the harvest. The election adds nothing identifiable on top: the record month contains it, but the record was set before it (Sept 2026 core was already 4.4× a typical October).
3. **What tracks is the coalition, structurally rather than as a step.** The ±8-week window across the Dec 29 2022 swearing-in is flat (core 0.91). What changes is the *trend regime*: from that winter the core stream never has a down year again (762 → 979 → 1,147 → 1,815 → 2,574*) and enforcement disappears — ACLED reports 94% of settler investigation files closed without indictment in this period, 259 new outposts since 2023, and armed-settler shooting incidents (203 Jan–Sep 2026) at four times the 2022 rate. The Biden-era sanctions (EO 14115, Feb 2024) and their lifting (Jan–Feb 2025) leave no visible mark on the event counts — 2024 core (1,147) and 2025 core (1,815) rise straight through both. The Oct 27 2026 election's outcome (Netanyahu bloc 53 seats, far-right coalition loses its majority; Eisenkot given the mandate Nov 8) post-dates the data cut — the wave's relationship to the next government is an open question the data cannot yet answer.

For contrast, the two *policy* shocks that do register as steps: the Jerusalem recognition (Dec 6 2017) — broad ×6.4 across the boundary (8.6 → 55/wk) but core only ×1.7 (1.5 → 2.6): a crowd wave with a settler echo, per §3.3 — and the war onset (core ×3.2, §3.4). The biggest step of all belongs to no marker: the Jun–Sep 2026 change-points sit in the middle of a ceasefire, between the Qusra siege and the harvest, with no dated trigger in the political calendar — the wave's own compounding.

### 3.6 Seasonality: the harvest clock

Month-of-year means, 2016–2025 (computed excluding 2026 so the wave cannot define its own baseline):

| | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Core/mo | 53.4 | 56.5 | 48.1 | 44.7 | 59.4 | 58.8 | 66.4 | 64.0 | 52.2 | **75.6** | **77.3** | 60.1 |
| Mob/mo | 233 | 234 | 223 | 218 | 254 | 200 | 200 | 194 | 222 | **302** | 261 | 264 |

October–November run at index 1.28 (core) and 1.20 (mob) versus the average month — the olive-harvest signature (OCHA: >50,000 trees damaged by settler attacks Jan 2023–Jun 2025 alone). Every October in the series:

| | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | **2026** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Oct core | 14 | 4 | 35 | 38 | 75 | 79 | 72 | 194 | 103 | 142 | **497** |
| Oct broad | 75 | 37 | 261 | 215 | 352 | 356 | 708 | 1,079 | 584 | 809 | **1,560** |

Two uses of this clock. First, the election confound (§3.5): October is *always* elevated. Second, the size of the 2026 wave against the seasonal expectation: **July, August and September 2026 core (303, 386, 334) each exceed the 2016–2025 *October* mean (75.6) by 4–5×** — the wave's off-season months now run several times the historical harvest peak, and then the actual harvest delivered 497 (6.6× the historical October). The June 2026 record ACLED flagged (460+ incidents) is likewise an off-peak month: core 215 against a June mean of 58.8 (3.7×). The 2026 wave is not a big harvest; it is a new level that the harvest then amplified.

### 3.7 The form of the wave: event-dense, low-lethality, exposure-invisible

- **Lethality:** broad-proxy fatalities per event fall from 0.069 (Oct 2023 onset — the stream mixed with lethal confrontation) to 0.0087 (Jul–Oct 2026); mob fatality rate 0.001/event in Oct 2026. The looting/property-destruction stream has recorded **8,048 events and zero fatalities across the entire dataset** — an entire decade of violence-without-killing. The wave's harm is displacement, land loss, property destruction and injury, which fatalities cannot measure — and which the sibling analysis showed exposure under-weights by construction (strategic developments carry no exposure radius; riots only 2 km against rural, low-density locations).
- **Saturation:** the settler complex is 96.8% of all West Bank events in the acceleration era (94.1% across the ceasefire's first nine months) vs 60.7% in 2016–17 — the WB's event mass has effectively *become* the settler complex, which is why the sibling report's 2026 finding (record events at record-low lethality) resolves into this wave.
- **Exposure per broad-proxy event** falls across the decade (12.1k → 4.2k people/event between the 2016–17 quiet and the current ceasefire era, per the sibling window table) — the violence moved onto sparsely populated land. A fatality- or exposure-led visualization of 2026 shows near-peace; only the event axis shows the wave.

### 3.8 The IDF stream: the campaign arc, and the handoff seen from the other side

To read the settler wave against its military context, a parallel pair of IDF-activity tiers is computed (§2.2): **combat** (Armed clash + Air/drone strike + Shelling/artillery — campaign intensity *as met by resistance*) and **unilateral** (Arrests + Disrupted weapons use — a floor on policing activity), plus a **resistance** tier (Grenade + IED — predominantly militant-perpetrated). One structural asymmetry matters up front: the settler core streams are *unilateral* (settlers act on land and property without an adversary), while the IDF's cleanest streams are *interactional* — a clash exists only when someone shoots back — so the combat tier measures contested operations, not operational tempo (caveat 10).

**Yearly:**

| Year | Combat | /wk | Unilateral | Resistance | Combat % of WB events | Settler core |
|---|---|---|---|---|---|---|
| 2016 | 125 | 2.4 | 11 | 3 | 14.0% | 135 |
| 2017 | 60 | 1.2 | 8 | 8 | 4.6% | 67 |
| 2018 | 49 | 0.9 | 20 | 8 | 1.3% | 336 |
| 2019 | 42 | 0.8 | 31 | 6 | 1.3% | 480 |
| 2020 | 61 | 1.2 | 22 | 11 | 1.5% | 747 |
| 2021 | 172 | 3.3 | 9 | 18 | 2.9% | 697 |
| 2022 | 665 | 12.8 | 6 | 70 | 8.6% | 762 |
| 2023 | **1,548** | **29.8** | 59 | 192 | 16.0% | 979 |
| 2024 | **1,495** | **28.8** | **171** | 180 | **18.0%** | 1,147 |
| 2025 | 324 | 6.2 | 132 | **188** | 3.6% | 1,815 |
| 2026* | **63** | **1.5** | 117 | 17 | **0.7%** | **2,574** |

\* through October.

- **The arc.** Contested operations run at ~1–3/wk through 2016–21, lift to 12.8/wk with the `Break the Wave` raids era (2022), peak at ~29–30/wk across 2023–24 — when the combat tier is 16–18% of *all* West Bank events — then collapse (6.2/wk in 2025; 1.5/wk in 2026, 0.7% of events). Era means resolve 2025 further: 17.3/wk through the Iron Wall window (Jan–Mar 2025), 3.2 through the resumed war (Mar–Oct), 2.2 and 0.9 through the ceasefire eras. Monthly, the combat tier runs 100 events in Jan 2025 (Iron Wall's launch month) → 28 (Mar) → 11 (Jun) → single digits through 2026, bottoming at **1 event in Oct 2026**.
- **The IDF didn't leave; the fighting ended.** The unilateral tier runs 117 events in ten months of 2026 — 47 notable arrests (rising to 8–12/mo by late 2026), 70 weapon/explosive seizures, plus 30 shelling-coded demolition events concentrated in Feb–Mar 2026 — annualizing to ~140 against the 2024 peak of 171 and a 2016–21 average of ~17. In the acceleration era the unilateral tier out-runs combat for the first time since the quiet 2018–20 years (3.1 vs 0.9/wk; through 2021–25 combat dominated or matched every era): the signature of a garrison-and-engineering phase rather than a fighting one, consistent with the documented permanent posts inside the emptied camps — three `Headquarters or base established` events appear in 2026, the only cluster since 2020.
- **The resistance arc: a form shift, then a two-step death.** The resistance tier climbs 3 (2016) → 70 (2022) → 192 (2023) — the raids era growing the networks — then holds at 180–190/yr through 2024–25 *even as clashes collapse*, because the method shifted to buried explosives: 150 IED events in 2025, the record year (UNRWA, Feb 2025: armed groups "deploying improvised explosive devices inside refugee camps"). Then it dies — 17 events in ten months of 2026 (−91%). In one line: **gunfights died in 2025, bombs died in 2026.**
- **The handoff, dated.** On a rolling 52-week basis, IDF combat out-runs the settler core from 2018 through 2024 (both rising through the joint 2023–24 escalation); the settler core permanently overtakes it at the window ending **Mar 15 2025** — the rolling year that caps the campaign's last full-activity phase, during Iron Wall and the drawdown, *before* the Oct 10 2025 ceasefire — and never gives the lead back. The current rolling year: settler core 2,892 vs IDF combat 94, a **31:1** ratio. What §3.3–3.4 read as the settler wave compounding in an emptied field is, from the military side, an event-mass substitution: the West Bank's violence moved from the IDF-vs-militant cycle to the settler complex — a handoff that completes in spring 2025, straddling the ceasefire boundary just as the change-point analysis of the settler streams does.
- **Validation and anchors.** Combat-tier fatalities (367 / 480 / 160 / 29 across 2023–26*) track OCHA's actor-verified attribution of Palestinian deaths *by Israeli forces* (678 of 702 in Jan 2024–Oct 2025; 225 of 240 in 2025) — a lower bound, since the remainder of by-forces killings sits in the mixed VAC Attack stream. UNRWA counted "at least 38 airstrikes in 2025 alone" against 32 air/drone + shelling events in our 2025 streams. And the tempo caveat, quantified: OCHA/UNRWA recorded **161–183 search-and-arrest operations per week** at the 2024 peak (weeks of Jun 3–9 and late Aug 2024) — two orders of magnitude above the 44–60 notable-arrest events ACLED codes per year, which is why the unilateral tier is a floor and the combat tier the honest intensity measure.

---

## 4. Caveats & limitations

1. **No actor fields** — the central limitation. Every settler-attribution claim here is compositional inference from sub-events, validated externally (§2.3) but not equivalent to actor-tagged data. Event-level ACLED data with actors would resolve attribution exactly; the mob-stream flip (§3.3) shows how much composition can change *inside* one sub-event code over a decade.
2. **No geography.** The aggregate's centroid column is a stub (identical in every cell — the admin1 center), so "where" questions (governorate distribution, the Ramallah–Nablus–Hebron concentration OCHA reports) are unanswerable in this table.
3. **Definitional mismatch with external counts.** OCHA counts incidents with casualties/property damage; ACLED counts events, and its looting stream absorbs some state-led demolition activity (2020 is the outlier year: core/OCHA ratio 1.97). Ratios by year swing 0.37–1.97 even while the trend correlation is 0.94. The 2026 ACLED anchors are incident counts, not events; one incident can produce several events.
4. **VAC Attack is contaminated** (IDF raid violence + Palestinian attacks on settlers/IDF + settler shootings all share the code). It is included in the broad complex for continuity with the sibling report but excluded from the core; no per-era attribution of it is attempted beyond noting ACLED's 203 shootings as a subset.
5. **Short-era means** (May 2021: 2 weeks; war onset: 7; ceasefire #1: 8) are illustrative; the load-bearing numbers are the long eras (100, 109, 70, 84, 40, 60, 30, 38, 17 weeks) and the monthly/rolling series.
6. **Election event studies are n=6 with hard confounds** — harvest season for the two October elections, Ramadan and raid cycles elsewhere, ±8-week windows that overlap adjacent shocks. The null result (no consistent election bump) should be read as "no detectable signal at weekly resolution," not "politics doesn't matter" — the coalition-era trend is the political signal that does show.
7. **The Jul 2026 era split is judgment + scan.** The change-point scan supports breaks at Jun 20 / Jul 4 and Sep 5 2026, but era boundaries mix days at the edges like all weekly bins; the split exists to name the acceleration phase, not to claim a dated trigger.
8. **2026 figures are partial** (10 months). Yearly comparisons are labeled; rolling 52-week windows are complete.
9. **"Ceasefire" is a Gaza-side instrument** (sibling caveat): no formal ceasefire exists for the West Bank, and the WB "quiet" of 2016–17 was itself a violent decade-low. All regime language here is Gaza-relative.
10. **The IDF tiers measure contested operations, not operational tempo.** The combat tier (clash + airstrikes + shelling) counts operations *met by resistance*, so its 2026 floor partly reflects the militants' collapse as much as any IDF drawdown; the unilateral tier is a floor for the opposite reason — only ~44–60 notable arrests are coded per year against the 161–183 search-and-arrest operations per week OCHA recorded at the 2024 peak. The combat tier also shares the clash stream with the confrontational diagnostic (§2.2): two lenses on one stream, not independent measures.

---

## 5. Visualization design implications

1. **The ratchet staircase** — era-mean core (and broad) as steps with era bands and never-returns annotations; the single image that carries finding 1.
2. **Month × year carpet plot** — monthly core/broad as a heatmap with the harvest band (Oct–Nov) outlined: the 2026 row visibly detaches from the pattern, and the reader sees seasonality and trend in one glance.
3. **Mob violence with a fatal-week layer** — one line for volume, shading (or a rug) for weeks with ≥1 mob fatality, plus the confrontational stream underneath. This is the honest way to plot §3.3: the 2018 wave and the 2026 wave read differently in the same frame, and the fatality shading is what distinguishes them.
4. **Boundary small-multiples** — core/broad ±8 weeks around the four Gaza boundaries (Nov 24 2023, Jan 19 2025, Mar 18 2025, Oct 10 2025) plus the two 2026 change-points (Jun 20, Sep 5). The onset-spike/ceasefire-acceleration asymmetry (§3.4) reads instantly.
5. **Election ticks on the master timeline** — six election marks + the Dec 2022 coalition mark + harvest shading, making the §3.5 confound visible rather than asserted.
6. **Records panel** — top-10 months bar chart colored by regime; 8 of 10 ceasefire-era is the visual headline of §3.2.
7. **Proxy-validation ribbon** — our yearly core vs OCHA's yearly settler attacks, two lines, r = 0.94 labeled: buys credibility for the whole proxy before the reader sees anything else built on it.
8. **Lethality index** — mob fat/event per era (0.049 → 0.006 → 0.030 → 0.069 → 0.0087) or the Oct 2023-vs-Oct 2026 paired stat (653/46 vs 918/1): "the biggest wave is the least deadly" as a single paired bar.
9. **Dual-axis grounding strip** — rolling 52-week core with three reference lines (trough, pre-war max, war-era max): the 3.5× / 43× multiples of §3.2 as chart geometry.
10. **The three-stream handoff chart** — IDF combat, resistance (grenade + IED), and settler core on one timeline (weekly, or rolling 52-week), with the Mar 15 2025 handoff marked: the event-mass substitution of §3.8 reads instantly, and the 2026 record-setter/collapse divergence is the punchline.

---

## 6. Reproducibility

Every number above is computed by `analyze-settler-activity.ts` (same directory) and written to `settler-results.json`; run from the repo root so Bun loads the root `.env`:

```
bun packages/data/analysis/gaza-west-bank-ceasefire/analyze-settler-activity.ts
```

Core pulls (read-only; parameters `$westBankId` = 11611, `$gazaId` = 11610):

```sql
-- West Bank detail (all streams, weekly)
SELECT to_char(week, 'YYYY-MM-DD') AS week, event_type, sub_event_type,
  event_count, fatalities, population_exposure
FROM acled_weekly_agg WHERE admin1_id = $westBankId;

-- Aligned weekly totals (Gaza axis for the regime read)
SELECT to_char(week, 'YYYY-MM-DD') AS week,
  sum(event_count)  FILTER (WHERE admin1_id = $gazaId)      AS gaza_events,
  sum(fatalities)   FILTER (WHERE admin1_id = $gazaId)      AS gaza_fatalities,
  sum(event_count)  FILTER (WHERE admin1_id = $westBankId)  AS wb_events,
  sum(fatalities)   FILTER (WHERE admin1_id = $westBankId)  AS wb_fatalities
FROM acled_weekly_agg WHERE admin1_id IN ($gazaId, $westBankId)
GROUP BY week ORDER BY week;
```

Stream definitions, the 12 settler eras, the 16 event-study markers, the OCHA yearly series (hardcoded with source), and the ACLED 2026 anchors are constants at the top of the script. Derived blocks in `settler-results.json`: `era_summary`, `monthly_series`, `records` (top months, rolling 52-week, era steps, Octobers), `yearly` (with OCHA ratios), `validation` (OCHA correlations + ACLED 2026 checks), `gaza_window_proxy`, `event_studies`, `seasonality`, `change_point_scan`, `attribution` (mob fatality signature), `see_saw`, `cf2_monthly`, and `idf_streams` (tier definitions, the dated rolling handoff, combat-tier fatalities by year, and the OCHA by-perpetrator / UNRWA airstrike / arrest-tempo anchors); the `monthly_series`, `yearly`, and `era_summary` blocks carry `idf_combat` / `idf_unilateral` / `resistance` columns. The Gaza regime windows are the sibling analysis's `WINDOWS` (see `analyze.ts`); a natural follow-up remains persisting both window systems as tables (`ceasefire_period`, `settler_era`) for the web app to join.

## 7. Sources for external anchors & context

- **OCHA oPt West Bank monthly snapshots** (settler-attack yearly series 2006–2025; Oct 2025 = 269, then a record; >1,770 attacks in 2025, five per day, 65% in Ramallah/Nablus/Hebron) — e.g. `ochaopt.org/sites/default/files/West Bank_info-graphic_22_Jan_2026.pdf` and Humanitarian Situation Update #350 (Dec 23 2025)
- **OCHA, "West Bank — The Impact of Settler Attacks"** (Jun 2025): 3,500+ attacks Jan 2023–Jun 2025; 38 Palestinians killed by settlers/forces-in-settler-incidents; >50,000 trees and 1,700 vehicles damaged; harvest-season escalation Sept–Nov
- **Al Jazeera** (Oct 14 2025): settler attacks by year — 852 (2022), 1,291 (2023), 1,449 (2024), >1,000 in first eight months of 2025; olive-harvest seasonality
- **ACLED** (Sep 30 2026): settler violence at record levels; 259 new outposts since 2023 (186 farming); 203 settler shooting incidents Jan–Sep 2026 vs 48 in 2022; ~94% of settler investigation files closed without indictment
- **ACLED** (Oct 14 2026): 39 settler-violence incidents/day in early Oct 2026 vs ~20/day in Sept; Oct 27 2026 Israeli elections — both reused from the sibling report §7
- **ACLED** (Jul 29 2026): record 460+ settler incidents in June 2026; Till village killings Jul 24 2026 · **ACLED** (Aug 19 2026): Qusra siege; 300 land-seizure incidents Jan–Aug 2026 vs 267 in all of 2025 · **ACLED** (Mar 27 2026): March 2026 settler rampages across ≥29 locations
- **ACLED, "Iron Wall or iron fist? Palestinian militancy and Israel's campaign to reshape the northern West Bank"** (May 2 2025, updated Nov 4 2026): campaign arc — Break the Wave raids from Mar 2022; first WB airstrike since the Second Intifada ("Home and Garden," Jenin, Jul 3 2023); Iron Wall Jan 21 2025 as "the latest and most extensive phase"; "war-like violence by security forces degrades militant groups and reshapes refugee camps"
- **OCHA oPt West Bank monthly snapshots** (Nov 2025; Jan 2026) — actor-verified fatality attribution for the IDF tiers: 678 of 702 Palestinians killed *by Israeli forces* (Jan 2024–Oct 2025; 12 by settlers), 225 of 240 in 2025 (9 by settlers)
- **UNRWA** (Feb 10 2025): 40,000 displaced by Iron Wall; "at least 38 airstrikes in [2025] alone"; armed groups "deploying improvised explosive devices inside refugee camps" · **UNRWA Situation Report #113** (Jun 2024): ≥161 ISF search-and-arrest operations in one week · **UN/OHCHR via the Guardian** (Aug 28 2024): 183 search-and-arrest operations in a week; 128 killed by airstrikes in the WB since Oct 2023
- **Israeli election Oct 27 2026:** Reuters / AP / BBC / CRS IN12751 (Oct 30 2026) — Netanyahu bloc 53 seats, opposition (Yashar/Eisenkot) 48, Arab-led parties a record 19; no majority; Herzog gave Eisenkot the mandate Nov 8 2026; turnout 77.9%. Coalition of Dec 29 2022 (Smotrich: finance + settlement administration; Ben Gvir: national security incl. Border Police) as documented at formation
- **US Jerusalem recognition** Dec 6 2017; **Trump peace plan** Jan 28 2020; **Biden EO 14115** (settler sanctions) Feb 1 2024, lifted early 2025; **UNSC Resolution 2334** Dec 23 2016 — dated markers used in §2.4/§3.5
- **Sibling analysis** (`gaza-west-bank-ceasefire-patterns.md` + `results.json`): Gaza regime windows, boundary verification, exposure methodology, and the WB-aggregate ceasefire findings this report narrows to the settler stream
