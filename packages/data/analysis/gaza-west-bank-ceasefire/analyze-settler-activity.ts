#!/usr/bin/env bun

/**
 * Focused analysis: the history of settler activity in the West Bank, from
 * `acled_weekly_agg` — how the current wave compares quantitatively to past
 * waves, and how settler activity relates to Gaza ceasefire boundaries,
 * Israeli elections/coalitions, and the seasonal calendar.
 *
 * Companion report: ./west-bank-settler-activity.md (findings, context, and
 * source citations). This script reproduces every number in the report.
 * Sibling analysis: ./analyze.ts + ./gaza-west-bank-ceasefire-patterns.md
 * (Gaza↔WB regime analysis whose regime windows are reused here).
 *
 * Method in one paragraph: the weekly aggregate has no actor fields, so
 * "settler activity" is proxied by sub-event composition. Three stream
 * definitions are used, in decreasing order of settler attribution:
 *   core proxy   = Looting/property destruction (SD) + 'Other' (SD — the
 *                  land-seizure proxy; matches ACLED's own land-seizure
 *                  counts for 2026 within ~5%)
 *   broad proxy  = core + Mob violence (Riots) + Attack (VAC) — the
 *                  civilian-facing violence complex; equals the prior
 *                  report's settler-violence proxy plus the SD streams
 *   confrontational = Armed clash + Violent demonstration + Excessive force
 *                  against protesters — streams that are predominantly
 *                  Palestinian-organized/confrontational (or state response
 *                  to them), used as an attribution diagnostic
 * A parallel IDF-activity pair of tiers is computed (see IDF_* constants):
 *   idf combat   = Armed clash + Air/drone strike + Shelling/artillery —
 *                  the campaign-intensity measure (interactional: operations
 *                  met by resistance)
 *   idf unilateral = Arrests + Disrupted weapons use — purely IDF-perpetrated
 *                  but a floor (only notable arrests are coded)
 * plus a resistance tier (Grenade + IED — predominantly militant-perpetrated).
 * The IDF tiers are read against the settler core as the "handoff": the dated
 * point from which the settler stream out-runs military operations.
 * Attribution is era-dependent and is checked against external anchors (OCHA
 * yearly settler-attack counts, OCHA by-perpetrator fatality attribution,
 * ACLED 2026 incident counts, and the mob-violence fatality signature) — see
 * report §2.3, §5 and §3.8.
 *
 * Read-only: never writes to the database.
 *
 * Usage (from repo root, so Bun loads the root .env):
 *   bun packages/data/analysis/gaza-west-bank-ceasefire/analyze-settler-activity.ts
 **/

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { sql } from '@pgtyped/runtime';
import { pool } from '../../db';

const WEST_BANK_ID = 11611;
const GAZA_STRIP_ID = 11610;

// ---------------------------------------------------------------------------
// Stream definitions (sub_event_type values present in the WB data)
// ---------------------------------------------------------------------------

const SUB_MOB = 'Mob violence';                          // Riots
const SUB_LOOT = 'Looting/property destruction';         // Strategic developments
const SUB_ATTACK = 'Attack';                             // Violence against civilians
const SUB_OTHER = 'Other';                               // Strategic developments (land-seizure proxy)
const SUB_CLASH = 'Armed clash';                         // Battles
const SUB_VIDEM = 'Violent demonstration';               // Riots
const SUB_EXCESS = 'Excessive force against protesters'; // Protests
const SUB_STRIKE = 'Air/drone strike';                   // Explosions/Remote violence
const SUB_SHELL = 'Shelling/artillery/missile attack';   // Explosions/Remote violence
const SUB_GRENADE = 'Grenade';                           // Explosions/Remote violence
const SUB_IED = 'Remote explosive/landmine/IED';         // Explosions/Remote violence
const SUB_ARRESTS = 'Arrests';                           // Strategic developments
const SUB_DWU = 'Disrupted weapons use';                 // Strategic developments

const CORE_STREAMS = [SUB_LOOT, SUB_OTHER] as const;
const BROAD_STREAMS = [SUB_MOB, SUB_LOOT, SUB_ATTACK, SUB_OTHER] as const;
const CONFRONT_STREAMS = [SUB_CLASH, SUB_VIDEM, SUB_EXCESS] as const;

// IDF-activity tiers (see report §2.2 and §3.8). Unlike the settler proxy —
// whose core streams are unilateral (settlers acting on land/property without
// an adversary) — the cleanest IDF-attributable streams are mostly
// INTERACTIONAL: an armed clash only exists if someone shoots back. So the
// tiers split along that line:
//   combat     — Armed clash + Air/drone strike + Shelling/artillery. Aircraft
//     and artillery are IDF-exclusive in the WB and nearly every WB battle has
//     the IDF as a party. This is the campaign-INTENSITY measure (contested
//     operations), not operational tempo.
//   unilateral — Arrests + Disrupted weapons use. Purely IDF-perpetrated, but
//     ACLED codes only *notable* arrests (~44-60/yr vs the 161-183
//     search-and-arrest operations per week OCHA recorded at the 2024 peak),
//     so this tier is a floor, never a tempo measure.
//   resistance — Grenade + Remote explosive/IED: predominantly
//     militant-perpetrated (the signature camp IED war of 2024-25); the mirror
//     of the IDF tiers and the quantitative trace of organized armed
//     resistance. Note the combat tier shares the clash stream with the
//     `confrontational` diagnostic above — two lenses on one stream.
const IDF_COMBAT_STREAMS = [SUB_CLASH, SUB_STRIKE, SUB_SHELL] as const;
const IDF_UNILATERAL_STREAMS = [SUB_ARRESTS, SUB_DWU] as const;
const RESISTANCE_STREAMS = [SUB_GRENADE, SUB_IED] as const;

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

interface Window {
  label: string;
  start: string; // inclusive week start (Saturday)
  end: string;   // exclusive
  anchor: string;
}

// West-Bank-native settler eras — segmentation of settler activity by its own
// structural breaks, NOT by Gaza regimes (those are kept separately below).
// Boundaries follow documented events (see report §2.2 for anchors and the
// caveat that the final 2026 split is a descriptive judgment call, supported
// by the change-point scan in results under `change_point_scan`).
const SETTLER_ERAS: Window[] = [
  { label: 'trough_2016_17', start: '2016-01-02', end: '2017-12-02', anchor: 'Post-knife-intifada trough; lowest OCHA settler-attack years on record (2016-17); UNSC 2334 Dec 2016' },
  { label: 'jerusalem_2018_19', start: '2017-12-02', end: '2020-01-04', anchor: 'US Jerusalem embassy recognition Dec 6 2017; "days of rage" + GMR-era co-mobilization; settler attacks double off the 2017 floor (OCHA)' },
  { label: 'covid_2020_21', start: '2020-01-04', end: '2021-05-08', anchor: 'COVID quiet-to-creep; Trump peace plan Jan 2020; Abraham Accords annexation freeze' },
  { label: 'may21_uprising', start: '2021-05-08', end: '2021-05-22', anchor: 'May 10-21 2021 war / joint uprising' },
  { label: 'escalation_2021_22', start: '2021-05-22', end: '2022-12-31', anchor: 'Post-war lull into 2022 escalation: Apr 2022 Temple Mount/Operation Wave Breaker, Oct 2022 spike (harvest + Nov 1 election), Nov 1 2022 election' },
  { label: 'coalition_2023', start: '2022-12-31', end: '2023-10-07', anchor: 'Far-right coalition sworn in Dec 29 2022 (Smotrich/Ben Gvir); Huwara rampage Feb 26 2023; record OCHA settler months Jun-Jul 2023' },
  { label: 'war_onset_oct23', start: '2023-10-07', end: '2023-11-25', anchor: 'Oct 7 attack -> war onset; settler violence hits its (then) record; US visa bans announced' },
  { label: 'war_era_nov23_jan25', start: '2023-11-25', end: '2025-01-18', anchor: 'Truce + long Gaza war; OCHA settler-attack records 2023 (1,291) and 2024 (1,449)' },
  { label: 'cf1_ironwall_jan25', start: '2025-01-18', end: '2025-03-15', anchor: 'Gaza ceasefire #1 Jan 19 2025; Operation Iron Wall (WB) from Jan 21' },
  { label: 'war_mar25_oct25', start: '2025-03-15', end: '2025-10-11', anchor: 'Gaza war resumes Mar 18 2025; WB armed activity suppressed (clashes collapse)' },
  { label: 'cf2_oct25_jun26', start: '2025-10-11', end: '2026-07-04', anchor: 'Gaza ceasefire #2 Oct 10 2025; settler wave builds through H1 2026 (June 2026 record per ACLED)' },
  { label: 'cf2_accel_jul26_oct26', start: '2026-07-04', end: '2026-11-01', anchor: 'The acceleration: farming-outpost wave, Qusra siege Aug 2026, Till killings Jul 24 2026, harvest + Oct 27 2026 election; change-point scan lands early Jul 2026' },
];

// Gaza regime windows from the sibling analysis (analyze.ts) — reused so the
// settler series can be read against war/ceasefire regimes. Labels identical.
const GAZA_WINDOWS: Window[] = [
  { label: 'quiet_2016_17', start: '2016-01-02', end: '2018-03-24', anchor: '' },
  { label: 'gmr_2018_19', start: '2018-03-24', end: '2020-01-04', anchor: '' },
  { label: 'quiet_2020_21', start: '2020-01-04', end: '2021-05-08', anchor: '' },
  { label: 'may2021_war', start: '2021-05-08', end: '2021-05-22', anchor: '' },
  { label: 'post_may21_lull', start: '2021-05-22', end: '2022-07-30', anchor: '' },
  { label: 'aug2022_war', start: '2022-07-30', end: '2022-08-13', anchor: '' },
  { label: 'prewar_2022_23', start: '2022-08-13', end: '2023-10-07', anchor: '' },
  { label: 'war_oct23', start: '2023-10-07', end: '2023-11-25', anchor: '' },
  { label: 'truce_nov23', start: '2023-11-25', end: '2023-12-02', anchor: '' },
  { label: 'war_dec23_jan25', start: '2023-12-02', end: '2025-01-18', anchor: '' },
  { label: 'cf_jan25_phase1', start: '2025-01-18', end: '2025-03-15', anchor: '' },
  { label: 'war_mar25_oct25', start: '2025-03-15', end: '2025-10-11', anchor: '' },
  { label: 'cf_oct25_now', start: '2025-10-11', end: '2026-11-01', anchor: '' },
];

// Dated markers for the event studies (±8 weeks). Week keys are resolved to
// the Saturday week bin containing the date.
interface Marker {
  label: string;
  date: string; // calendar date of the event
  kind: 'election' | 'coalition' | 'policy' | 'ceasefire' | 'violence';
  note: string;
}

const MARKERS: Marker[] = [
  { label: 'embassy_jerusalem', date: '2017-12-06', kind: 'policy', note: 'US recognizes Jerusalem as capital of Israel' },
  { label: 'election_apr2019', date: '2019-04-09', kind: 'election', note: 'Knesset election #1 of the 2019-21 cycle' },
  { label: 'election_sep2019', date: '2019-09-17', kind: 'election', note: 'Knesset election #2' },
  { label: 'peace_plan_jan2020', date: '2020-01-28', kind: 'policy', note: 'Trump peace plan unveiled (settlement annexation endorsed)' },
  { label: 'election_mar2020', date: '2020-03-02', kind: 'election', note: 'Knesset election #3' },
  { label: 'election_mar2021', date: '2021-03-23', kind: 'election', note: 'Knesset election #4 (pre-Ramadan lull; May 2021 war follows)' },
  { label: 'election_nov2022', date: '2022-11-01', kind: 'election', note: 'Knesset election (Netanyahu bloc wins; coincides with olive harvest)' },
  { label: 'coalition_dec2022', date: '2022-12-29', kind: 'coalition', note: 'Far-right coalition sworn in (Smotrich: settlement administration; Ben Gvir: police incl. Border Police)' },
  { label: 'huwara_feb2023', date: '2023-02-26', kind: 'violence', note: 'Huwara settler rampage' },
  { label: 'war_onset_oct2023', date: '2023-10-07', kind: 'violence', note: 'Oct 7 attack; war onset (incl. settler record wave)' },
  { label: 'truce_nov2023', date: '2023-11-24', kind: 'ceasefire', note: 'Gaza truce (hostage pause, 7 days)' },
  { label: 'cf1_jan2025', date: '2025-01-19', kind: 'ceasefire', note: 'Gaza ceasefire #1 effective (Iron Wall in WB from Jan 21)' },
  { label: 'cf1_collapse_mar2025', date: '2025-03-18', kind: 'ceasefire', note: 'Gaza ceasefire #1 collapses; strikes resume' },
  { label: 'cf2_oct2025', date: '2025-10-10', kind: 'ceasefire', note: 'Gaza ceasefire #2 effective 12:00 local' },
  { label: 'qusra_siege_aug2026', date: '2026-08-01', kind: 'violence', note: 'Qusra siege begins (ACLED-dated acceleration episode)' },
  { label: 'election_oct2026', date: '2026-10-27', kind: 'election', note: 'Knesset election (Netanyahu bloc 53, loses majority; coincides with olive harvest)' },
];

// OCHA count of "attacks by Israeli settlers against Palestinians that
// resulted in casualties and/or property damage", by year — the actor-verified
// external benchmark for the proxy (see report §5.2). Source: OCHA West Bank
// monthly snapshots (the yearly series printed in each snapshot's chart),
// e.g. https://www.ochaopt.org/sites/default/files/West%20Bank_info-graphic_22_Jan_2026.pdf
const OCHA_SETTLER_ATTACKS_BY_YEAR: Record<string, number> = {
  '2016': 95, '2017': 179, '2018': 330, '2019': 367, '2020': 379,
  '2021': 532, '2022': 852, '2023': 1291, '2024': 1449, '2025': 1828,
};

// ACLED's own actor-tagged 2026 counts, cited in the sibling report (§7),
// used to validate the proxy in the current wave.
const ACLED_2026_ANCHORS = {
  june_settler_incidents: { claimed: 460, claimed_note: 'record 460+ settler incidents in June 2026 (ACLED Jul 29 2026)' },
  sept_incidents_per_day: { claimed: 20, claimed_note: '~20 settler-violence incidents/day in Sept 2026 (ACLED Oct 14 2026)' },
  early_oct_incidents_per_day: { claimed: 39, claimed_note: '39 incidents/day in early Oct 2026 (ACLED Oct 14 2026)' },
  land_seizures_jan_aug_2026: { claimed: 300, claimed_note: '300 land-seizure incidents Jan-Aug 2026 vs 267 in all of 2025 (ACLED Aug 19 2026)' },
  settler_shootings_jan_sep_2026: { claimed: 203, claimed_note: '203 settler shooting incidents Jan-Sep 2026 vs 48 in all of 2022 (ACLED Sep 30 2026)' },
};

// OCHA's actor-verified fatality attribution for the West Bank (perpetrator of
// Palestinian fatalities) — the external anchor for the IDF tiers in fatality
// space. Sources: OCHA oPt West Bank monthly snapshots (Nov 2025 issue for the
// Jan 2024-Oct 2025 window; Jan 2026 issue for calendar 2025).
const OCHA_FATALITIES_BY_PERPETRATOR = {
  jan_2024_oct_2025: { total: 702, by_israeli_forces: 678, by_settlers: 12, by_forces_or_settlers: 12 },
  year_2025: { total: 240, by_israeli_forces: 225, by_settlers: 9, by_forces_or_settlers: 6 },
};

// Tempo anchor exposing the Arrests stream's selectivity: UNRWA recorded "at
// least 161" ISF search-and-arrest operations in the week of 3-9 Jun 2024
// (Situation Report #113) and the UN cited 183 for the week of late Aug 2024
// (via the Guardian, 28 Aug 2024) — two orders of magnitude above the
// 44-60 notable-arrest events ACLED codes per year.
const ARREST_OPERATIONS_TEMPO = {
  ocha_recorded_search_and_arrest_ops_per_week_2024_peak: [161, 183],
  acled_coded_arrest_events_per_year: { '2023': 44, '2024': 60, '2025': 33, '2026_jan_oct': 47 },
};

// UNRWA (10 Feb 2025): "at least 38 airstrikes in [2025] alone" — order-of-
// magnitude check on our strike + shelling streams.
const UNRWA_AIRSTRIKES_2025_CLAIMED = 38;

// ---------------------------------------------------------------------------
// Statistics helpers (same as the sibling analysis)
// ---------------------------------------------------------------------------

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return NaN;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

function ranks(a: number[]): number[] {
  const idx = a.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
  const r = new Array<number>(a.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

const spearman = (x: number[], y: number[]) => pearson(ranks(x), ranks(y));
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const inRange = (w: string, start: string, end: string) => w >= start && w < end;
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / (v.length || 1);
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const getWbDetail = sql`
  SELECT to_char(week, 'YYYY-MM-DD') AS week, event_type, sub_event_type,
    event_count, fatalities, population_exposure
  FROM acled_weekly_agg
  WHERE admin1_id = $westBankId
`;

const getWeeklyBoth = sql`
  SELECT to_char(week, 'YYYY-MM-DD') AS week,
    sum(event_count) FILTER (WHERE admin1_id = $gazaId)      AS gaza_events,
    sum(fatalities)   FILTER (WHERE admin1_id = $gazaId)     AS gaza_fatalities,
    sum(event_count)  FILTER (WHERE admin1_id = $westBankId) AS wb_events,
    sum(fatalities)   FILTER (WHERE admin1_id = $westBankId) AS wb_fatalities
  FROM acled_weekly_agg
  WHERE admin1_id IN ($gazaId, $westBankId)
  GROUP BY week
  ORDER BY week
`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const params = { westBankId: WEST_BANK_ID, gazaId: GAZA_STRIP_ID };
  const wbDetailRaw = await getWbDetail.run(params, pool);
  const weeklyRaw = await getWeeklyBoth.run(params, pool);

  interface WbRow {
    week: string; event_type: string; sub_event_type: string;
    event_count: number; fatalities: number; population_exposure: number;
  }
  const wbDetail: WbRow[] = wbDetailRaw.map((r: Record<string, unknown>) => ({
    week: String(r.week),
    event_type: String(r.event_type),
    sub_event_type: String(r.sub_event_type),
    event_count: Number(r.event_count),
    fatalities: Number(r.fatalities),
    population_exposure: Number(r.population_exposure),
  }));

  interface WeeklyRow {
    week: string; gaza_events: number; gaza_fatalities: number;
    wb_events: number; wb_fatalities: number;
  }
  const weekly: WeeklyRow[] = weeklyRaw.map((r: Record<string, unknown>) => ({
    week: String(r.week),
    gaza_events: Number(r.gaza_events ?? 0),
    gaza_fatalities: Number(r.gaza_fatalities ?? 0),
    wb_events: Number(r.wb_events ?? 0),
    wb_fatalities: Number(r.wb_fatalities ?? 0),
  }));

  const weekGrid = [...new Set(weekly.map((d) => d.week))].sort();
  const weekIdx = new Map(weekGrid.map((w, i) => [w, i]));

  // Weekly count series per sub-event, zero-filled across the grid.
  const subSeries = (sub: string) => {
    const s = new Array<number>(weekGrid.length).fill(0);
    for (const r of wbDetail) if (r.sub_event_type === sub) s[weekIdx.get(r.week)!] += r.event_count;
    return s;
  };
  const subFat = (sub: string) => {
    const s = new Array<number>(weekGrid.length).fill(0);
    for (const r of wbDetail) if (r.sub_event_type === sub) s[weekIdx.get(r.week)!] += r.fatalities;
    return s;
  };
  const addSeries = (...series: number[][]) =>
    series.reduce((acc, s) => acc.map((v, i) => v + s[i]), new Array<number>(weekGrid.length).fill(0));

  const sMob = subSeries(SUB_MOB);
  const sLoot = subSeries(SUB_LOOT);
  const sAttack = subSeries(SUB_ATTACK);
  const sOther = subSeries(SUB_OTHER);
  const sClash = subSeries(SUB_CLASH);
  const sVidem = subSeries(SUB_VIDEM);
  const sExcess = subSeries(SUB_EXCESS);
  const sStrike = subSeries(SUB_STRIKE);
  const sShell = subSeries(SUB_SHELL);

  const fMob = subFat(SUB_MOB);
  const fLoot = subFat(SUB_LOOT);
  const fAttack = subFat(SUB_ATTACK);
  const fOther = subFat(SUB_OTHER);
  // Combat-tier fatalities (clash + air/drone strike + shelling) — the
  // fatality-space counterpart validated against OCHA's by-perpetrator split.
  const fIdfCombat = addSeries(subFat(SUB_CLASH), subFat(SUB_STRIKE), subFat(SUB_SHELL));

  const sCore = addSeries(sLoot, sOther);
  const sBroad = addSeries(sMob, sLoot, sAttack, sOther);
  const sConf = addSeries(sClash, sVidem, sExcess);
  const sIdfCombat = addSeries(sClash, sStrike, sShell);
  const sIdfUnilateral = addSeries(subSeries(SUB_ARRESTS), subSeries(SUB_DWU));
  const sResistance = addSeries(subSeries(SUB_GRENADE), subSeries(SUB_IED));

  // Weekly exposure for the broad proxy (mostly riot-radius events; SD rows
  // carry none by ACLED design — see sibling report §3.9).
  const pxBroad = new Array<number>(weekGrid.length).fill(0);
  for (const r of wbDetail) {
    if ((BROAD_STREAMS as readonly string[]).includes(r.sub_event_type)) {
      pxBroad[weekIdx.get(r.week)!] += r.population_exposure;
    }
  }

  const weeksIn = (start: string, end: string) => weekGrid.filter((w) => inRange(w, start, end));
  const sliceBy = (s: number[], start: string, end: string) => {
    const idxs: number[] = [];
    for (const w of weeksIn(start, end)) idxs.push(weekIdx.get(w)!);
    return idxs.map((i) => s[i]);
  };

  // --- Era table -----------------------------------------------------------

  const eraSummary = SETTLER_ERAS.map(({ label, start, end, anchor }) => {
    const n = weeksIn(start, end).length;
    const mob = sliceBy(sMob, start, end);
    const loot = sliceBy(sLoot, start, end);
    const atk = sliceBy(sAttack, start, end);
    const oth = sliceBy(sOther, start, end);
    const core = sliceBy(sCore, start, end);
    const broad = sliceBy(sBroad, start, end);
    const conf = sliceBy(sConf, start, end);
    const idfC = sliceBy(sIdfCombat, start, end);
    const idfU = sliceBy(sIdfUnilateral, start, end);
    const res = sliceBy(sResistance, start, end);
    const wbev = weekly.filter((d) => inRange(d.week, start, end));
    const gazaFatWk = mean(wbev.map((d) => d.gaza_fatalities));
    const mobFatTotal = sum(sliceBy(fMob, start, end));
    const broadFatTotal = mobFatTotal + sum(sliceBy(fLoot, start, end))
      + sum(sliceBy(fAttack, start, end)) + sum(sliceBy(fOther, start, end));
    const pxTotal = sum(sliceBy(pxBroad, start, end));
    return {
      era: label, weeks: n, anchor,
      mob_per_wk: round(mean(mob), 1),
      looting_per_wk: round(mean(loot), 1),
      attack_per_wk: round(mean(atk), 1),
      sd_other_per_wk: round(mean(oth), 1),
      core_per_wk: round(mean(core), 1),
      broad_per_wk: round(mean(broad), 1),
      conf_per_wk: round(mean(conf), 1),
      mob_fat_per_event: round(mobFatTotal / (sum(mob) || 1), 4),
      broad_fat_per_event: round(broadFatTotal / (sum(broad) || 1), 4),
      broad_share_of_wb_events_pct: round((100 * sum(broad)) / (sum(wbev.map((d) => d.wb_events)) || 1), 1),
      conf_share_of_wb_events_pct: round((100 * sum(conf)) / (sum(wbev.map((d) => d.wb_events)) || 1), 1),
      idf_combat_per_wk: round(mean(idfC), 1),
      idf_unilateral_per_wk: round(mean(idfU), 1),
      resistance_per_wk: round(mean(res), 1),
      broad_px_per_event: Math.round(pxTotal / (sum(broad) || 1)),
      gaza_fat_per_wk: round(gazaFatWk, 1),
    };
  });

  // --- Monthly series ------------------------------------------------------

  const monthKeys = [...new Set(weekGrid.map((w) => w.slice(0, 7)))].sort();
  const monthly = monthKeys.map((m) => {
    const idxs = weekGrid.map((w, i) => (w.slice(0, 7) === m ? i : -1)).filter((i) => i >= 0);
    const pick = (s: number[]) => sum(idxs.map((i) => s[i]));
    return {
      month: m,
      mob: pick(sMob), looting: pick(sLoot), attack: pick(sAttack), sd_other: pick(sOther),
      core: pick(sCore), broad: pick(sBroad), confrontational: pick(sConf),
      idf_combat: pick(sIdfCombat), idf_unilateral: pick(sIdfUnilateral), resistance: pick(sResistance),
      mob_fatalities: pick(fMob), broad_fatalities: pick(fMob) + pick(fAttack) + pick(fLoot) + pick(fOther),
      idf_combat_fatalities: pick(fIdfCombat),
      wb_events: sum(weekly.filter((d) => d.week.slice(0, 7) === m).map((d) => d.wb_events)),
    };
  });

  // --- Records & rolling 52-week grounding ---------------------------------

  const monthsSorted = [...monthly].sort((a, b) => b.broad - a.broad);
  const topMonthsBroad = monthsSorted.slice(0, 12).map((m) => ({
    month: m.month, broad: m.broad, mob: m.mob, looting: m.looting, attack: m.attack, sd_other: m.sd_other,
  }));
  const topMonthsCore = [...monthly].sort((a, b) => b.core - a.core).slice(0, 12)
    .map((m) => ({ month: m.month, core: m.core, looting: m.looting, sd_other: m.sd_other }));
  const topMonthsMob = [...monthly].sort((a, b) => b.mob - a.mob).slice(0, 12)
    .map((m) => ({ month: m.month, mob: m.mob, mob_fatalities: m.mob_fatalities }));

  const rolling52 = (s: number[]) => {
    const out: { end_week: string; total: number }[] = [];
    for (let t = 51; t < s.length; t++) {
      out.push({ end_week: weekGrid[t], total: sum(s.slice(t - 51, t + 1)) });
    }
    return out;
  };
  const pctRank = (v: number, arr: number[]) =>
    round((100 * arr.filter((x) => x < v).length) / arr.length, 1);
  // Grounding baselines for the rolling comparison. A naive "prior max" over
  // all earlier windows is contaminated: windows ending in 2026 overlap the
  // current wave. Compare instead against the best 52-week stretches that
  // ended BEFORE key boundaries — pre-war (Oct 7 2023) and pre-ceasefire #2
  // (Oct 10 2025) — plus the all-time minimum (the 2016-17 trough).
  const rolling52Stats = (s: number[]) => {
    const r = rolling52(s);
    const current = r.at(-1)!;
    const maxEndingBefore = (limit: string) =>
      Math.max(...r.filter((w) => w.end_week < limit).map((w) => w.total));
    const minEver = Math.min(...r.map((w) => w.total));
    return {
      current: current,
      current_pct_rank: pctRank(current.total, r.map((w) => w.total)),
      max_prior_window_overall: Math.max(...r.slice(0, -1).map((w) => w.total)),
      max_prior_window_ending_pre_war: maxEndingBefore('2023-10-07'),
      max_prior_window_ending_pre_cf2: maxEndingBefore('2025-10-11'),
      min_window_ever: minEver,
      current_vs_pre_war_max: round(current.total / maxEndingBefore('2023-10-07'), 2),
      current_vs_pre_cf2_max: round(current.total / maxEndingBefore('2025-10-11'), 2),
      current_vs_min_ever: round(current.total / minEver, 2),
    };
  };
  const rolling52Broad = rolling52Stats(sBroad);
  const rolling52Core = rolling52Stats(sCore);

  // Yearly totals for every stream (for the OCHA/ACLED validation and the
  // "already exceeds any full prior year" claims). 2026 partial (10 months).
  const yearKeys = [...new Set(monthKeys.map((m) => m.slice(0, 4)))].sort();
  const yearly = yearKeys.map((y) => {
    const ms = monthly.filter((m) => m.month.startsWith(y));
    const months_counted = ms.length;
    const tot = (f: (m: (typeof ms)[number]) => number) => sum(ms.map(f));
    return {
      year: y, months: months_counted,
      mob: tot((m) => m.mob), looting: tot((m) => m.looting), attack: tot((m) => m.attack),
      sd_other: tot((m) => m.sd_other), core: tot((m) => m.core), broad: tot((m) => m.broad),
      confrontational: tot((m) => m.confrontational),
      idf_combat: tot((m) => m.idf_combat), idf_unilateral: tot((m) => m.idf_unilateral),
      resistance: tot((m) => m.resistance),
      wb_events: tot((m) => m.wb_events),
      idf_combat_share_of_wb_events_pct: round((100 * tot((m) => m.idf_combat)) / (tot((m) => m.wb_events) || 1), 1),
      ocha_settler_attacks: OCHA_SETTLER_ATTACKS_BY_YEAR[y] ?? null,
      core_per_ocha_ratio: OCHA_SETTLER_ATTACKS_BY_YEAR[y] != null
        ? round(tot((m) => m.core) / OCHA_SETTLER_ATTACKS_BY_YEAR[y], 2)
        : null,
    };
  });

  const ochaYears = yearly.filter((y) => y.ocha_settler_attacks != null);
  const ochaValidation = {
    pearson_looting_vs_ocha: round(pearson(
      ochaYears.map((y) => y.looting),
      ochaYears.map((y) => y.ocha_settler_attacks!),
    ), 3),
    pearson_core_vs_ocha: round(pearson(
      ochaYears.map((y) => y.core),
      ochaYears.map((y) => y.ocha_settler_attacks!),
    ), 3),
    spearman_core_vs_ocha: round(spearman(
      ochaYears.map((y) => y.core),
      ochaYears.map((y) => y.ocha_settler_attacks!),
    ), 3),
  };

  // ACLED 2026 anchor checks: our stream totals against ACLED's actor-tagged
  // counts for the same periods.
  const june26 = monthly.find((m) => m.month === '2026-06')!;
  const sept26 = monthly.find((m) => m.month === '2026-09')!;
  const oct26 = monthly.find((m) => m.month === '2026-10')!;
  const earlyOct26Weeks = ['2026-10-03', '2026-10-10'].map((w) => sBroad[weekIdx.get(w)!]);
  const sdOtherJanAug26 = sum(monthly.filter((m) => m.month >= '2026-01' && m.month <= '2026-08').map((m) => m.sd_other));
  const attackJanSep26 = sum(monthly.filter((m) => m.month >= '2026-01' && m.month <= '2026-09').map((m) => m.attack));
  const acled2026Checks = [
    { anchor: 'June 2026 settler incidents (claimed 460+)', claimed: ACLED_2026_ANCHORS.june_settler_incidents.claimed, proxy_mob: june26.mob, proxy_broad: june26.broad },
    { anchor: 'Sept 2026 incidents/day (claimed ~20)', claimed: ACLED_2026_ANCHORS.sept_incidents_per_day.claimed, proxy_mob_per_day: round(sept26.mob / 30, 1), proxy_broad_per_day: round(sept26.broad / 30, 1) },
    { anchor: 'Early Oct 2026 incidents/day (claimed 39)', claimed: ACLED_2026_ANCHORS.early_oct_incidents_per_day.claimed, proxy_broad_per_day_first2wks: round(sum(earlyOct26Weeks) / 14, 1) },
    { anchor: 'Land seizures Jan-Aug 2026 (claimed 300)', claimed: ACLED_2026_ANCHORS.land_seizures_jan_aug_2026.claimed, proxy_sd_other_jan_aug: sdOtherJanAug26 },
    { anchor: 'Settler shootings Jan-Sep 2026 (claimed 203; 48 in all of 2022)', claimed: ACLED_2026_ANCHORS.settler_shootings_jan_sep_2026.claimed, note: 'subset of the VAC Attack stream, which also contains IDF and Palestinian-perpetrated attacks', proxy_attack_jan_sep: attackJanSep26, proxy_attack_2022: yearly.find((y) => y.year === '2022')!.attack },
  ];

  // --- Gaza-window read of the settler series (ceasefire relationship) ------

  const gazaWindowProxy = GAZA_WINDOWS.map(({ label, start, end }) => {
    const n = weeksIn(start, end).length;
    const broad = sliceBy(sBroad, start, end);
    const core = sliceBy(sCore, start, end);
    const conf = sliceBy(sConf, start, end);
    const wz = weekly.filter((d) => inRange(d.week, start, end));
    const gz = wz.map((d) => d.gaza_fatalities);
    return {
      window: label, weeks: n,
      broad_per_wk: round(mean(broad), 1),
      core_per_wk: round(mean(core), 1),
      mob_per_wk: round(mean(sliceBy(sMob, start, end)), 1),
      looting_per_wk: round(mean(sliceBy(sLoot, start, end)), 1),
      conf_per_wk: round(mean(conf), 1),
      gaza_fat_per_wk: round(mean(gz), 1),
      r_broad_vs_gaza_fatalities: n >= 8 ? round(pearson(broad, gz), 2) : null,
    };
  });

  // --- Event studies (±8 weeks) --------------------------------------------

  const resolveWeek = (date: string) => {
    // Saturday-start week bin containing `date`: last grid week <= date.
    let lo = 0, hi = weekGrid.length - 1, res = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (weekGrid[mid] <= date) { res = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return res;
  };

  const eventStudies = MARKERS.map((m) => {
    const t0 = resolveWeek(m.date);
    const pre = (s: number[]) => mean(s.slice(Math.max(0, t0 - 8), t0));
    const post = (s: number[]) => mean(s.slice(t0, Math.min(s.length, t0 + 8)));
    const preCore = pre(sCore), postCore = post(sCore);
    const preBroad = pre(sBroad), postBroad = post(sBroad);
    const preConf = pre(sConf), postConf = post(sConf);
    return {
      marker: m.label, kind: m.kind, date: m.date, week_bin: weekGrid[t0], note: m.note,
      core_pre8: round(preCore, 1), core_post8: round(postCore, 1), core_ratio: round(postCore / (preCore || NaN), 2),
      broad_pre8: round(preBroad, 1), broad_post8: round(postBroad, 1), broad_ratio: round(postBroad / (preBroad || NaN), 2),
      conf_pre8: round(preConf, 1), conf_post8: round(postConf, 1),
    };
  });

  // --- Seasonality (month-of-year profile, complete years only) -------------

  const completeYears = yearKeys.filter((y) => {
    const ms = monthly.filter((m) => m.month.startsWith(y));
    return ms.length === 12;
  });
  // Flat 2016-2025 monthly series (complete years, excluding the 2026 wave),
  // ordered Jan 2016 -> Dec 2025 — the seasonal baseline.
  const baselineMonths = monthly.filter((m) =>
    completeYears.includes(m.month.slice(0, 4)) && !m.month.startsWith('2026'));
  const seasonCoreVals = () => baselineMonths.map((m) => m.core);
  const seasonMobVals = () => baselineMonths.map((m) => m.mob);
  const seasonality = {
    basis_years: completeYears.filter((y) => y !== '2026').join(','), // 2016-2025
    core_by_month: Array.from({ length: 12 }, (_, k) => {
      const mo = String(k + 1).padStart(2, '0');
      const vals = monthly.filter((m) => m.month.endsWith(`-${mo}`) && completeYears.includes(m.month.slice(0, 4)) && !m.month.startsWith('2026')).map((m) => m.core);
      return { month: mo, mean_core: round(mean(vals), 1) };
    }),
    mob_by_month: Array.from({ length: 12 }, (_, k) => {
      const mo = String(k + 1).padStart(2, '0');
      const vals = monthly.filter((m) => m.month.endsWith(`-${mo}`) && completeYears.includes(m.month.slice(0, 4)) && !m.month.startsWith('2026')).map((m) => m.mob);
      return { month: mo, mean_mob: round(mean(vals), 1) };
    }),
    // Harvest bump, single-number versions: mean Oct-Nov level vs the mean
    // month of the same 2016-2025 baseline.
    core_oct_nov_index_vs_avg_month: (() => {
      const coreMonths = seasonCoreVals();
      const avg = mean(coreMonths);
      const octNov = mean(coreMonths.filter((_, i) => [9, 10].includes(i % 12)));
      return round(octNov / avg, 2);
    })(),
    mob_oct_nov_index_vs_avg_month: (() => {
      const mobMonths = seasonMobVals();
      const avg = mean(mobMonths);
      const octNov = mean(mobMonths.filter((_, i) => [9, 10].includes(i % 12)));
      return round(octNov / avg, 2);
    })(),
    note: 'Oct-Nov = olive harvest; profile computed on 2016-2025 so the 2026 wave cannot dominate it',
  };

  // --- Change-point scan on the core stream, 2025-2026 ----------------------
  // Simple exhaustive scan: for each candidate week c (>= 8 weeks of context
  // on each side), compare the mean of the 8 weeks before c with the 8 weeks
  // after (inclusive). Score = difference; report the top candidates.

  const changePointScan = (() => {
    const out: { week: string; before8: number; after8: number; diff: number }[] = [];
    for (let i = weekIdx.get('2025-06-07')!; weekGrid[i] <= '2026-09-19' && i + 8 <= sCore.length; i++) {
      const before = mean(sCore.slice(i - 8, i));
      const after = mean(sCore.slice(i, i + 8));
      out.push({ week: weekGrid[i], before8: round(before, 1), after8: round(after, 1), diff: round(after - before, 1) });
    }
    return out.sort((a, b) => b.diff - a.diff).slice(0, 5);
  })();

  // --- Attribution diagnostics ----------------------------------------------

  // Mob-violence fatality signature: settler rampages rarely kill; crowd
  // confrontations that draw lethal state fire do. Report the share of mob
  // events falling in weeks with >=1 mob fatality, and the fatality rate.
  const mobFatalWeekShare = (start: string, end: string) => {
    const mob = sliceBy(sMob, start, end);
    const fat = sliceBy(fMob, start, end);
    const evInFatalWeeks = sum(mob.filter((_, i) => fat[i] > 0));
    return round((100 * evInFatalWeeks) / (sum(mob) || 1), 1);
  };
  const attribution = {
    mob_fatality_signature: SETTLER_ERAS.map(({ label, start, end }) => {
      const mob = sliceBy(sMob, start, end);
      const fat = sliceBy(fMob, start, end);
      return {
        era: label,
        mob_events: sum(mob),
        mob_fatalities: sum(fat),
        mob_fat_per_event: round(sum(fat) / (sum(mob) || 1), 4),
        pct_mob_events_in_fatal_weeks: mobFatalWeekShare(start, end),
      };
    }),
    looting_total_events_all_time: sum(sLoot),
    looting_total_fatalities_all_time: sum(fLoot),
    note: 'A near-zero mob fatality rate + near-zero confrontational streams (as in 2026) indicates the mob stream is dominated by settler rampages rather than crowd confrontations met with lethal force; a high rate (2016, May 2021, Oct 2023) indicates the converse. Cross-checked against OCHA yearly and ACLED 2026 counts.',
  };

  // --- See-saw diagnostics ---------------------------------------------------

  const cf2Idx = weekly.map((d, i) => (inRange(d.week, '2025-10-11', '2026-11-01') ? i : -1)).filter((i) => i >= 0);
  const warIdx = weekly.map((d, i) => (inRange(d.week, '2023-12-02', '2025-01-18') ? i : -1)).filter((i) => i >= 0);
  const preWarIdx = weekly.map((d, i) => (inRange(d.week, '2016-01-02', '2023-10-07') ? i : -1)).filter((i) => i >= 0);
  const seeSaw = {
    r_broad_vs_gaza_fatalities_pre_oct23: round(pearson(preWarIdx.map((i) => sBroad[i]), preWarIdx.map((i) => weekly[i].gaza_fatalities)), 2),
    r_broad_vs_gaza_fatalities_war_dec23_jan25: round(pearson(warIdx.map((i) => sBroad[i]), warIdx.map((i) => weekly[i].gaza_fatalities)), 2),
    r_broad_vs_gaza_fatalities_cf_oct25_now: round(pearson(cf2Idx.map((i) => sBroad[i]), cf2Idx.map((i) => weekly[i].gaza_fatalities)), 2),
    r_conf_vs_gaza_fatalities_cf_oct25_now: round(pearson(cf2Idx.map((i) => sConf[i]), cf2Idx.map((i) => weekly[i].gaza_fatalities)), 2),
    note: 'The settler complex is not synchronized with Gaza at the weekly level in any regime; its relationship to Gaza is regime-level (war onset spike; ceasefire-era compounding).',
  };

  // --- Monthly acceleration inside ceasefire #2 -------------------------------

  const cf2Monthly = monthly.filter((m) => m.month >= '2025-10' && m.month <= '2026-10')
    .map((m) => ({ month: m.month, core: m.core, broad: m.broad, mob: m.mob, looting: m.looting, confrontational: m.confrontational }));

  // --- IDF tiers: campaign arc, handoff, and validation ----------------------

  // The handoff: the rolling 52-week settler core vs the rolling 52-week IDF
  // combat tier. Through 2023-24 the military campaign out-runs the settler
  // stream in the event data; from some week in 2025 the settler core
  // permanently overtakes it. Date both the first crossing and any later
  // reversal.
  const idfStreams = (() => {
    const rollingCombat = rolling52(sIdfCombat);
    const rollingCore = rolling52(sCore);
    let firstCross: string | null = null;
    let lastReversal: string | null = null;
    for (let i = 0; i < rollingCore.length; i++) {
      if (rollingCore[i].total > rollingCombat[i].total) {
        if (!firstCross) firstCross = rollingCore[i].end_week;
      } else if (firstCross) {
        lastReversal = rollingCore[i].end_week;
      }
    }
    const combatFatByYear: Record<string, number> = {};
    for (let i = 0; i < weekGrid.length; i++) {
      const y = weekGrid[i].slice(0, 4);
      combatFatByYear[y] = (combatFatByYear[y] ?? 0) + fIdfCombat[i];
    }
    // Direct count of air/drone + shelling events in 2025 (the airstrike check
    // against UNRWA's claimed "at least 38 airstrikes in 2025").
    let strikeShellEvents2025 = 0;
    for (const r of wbDetail) {
      if ((r.sub_event_type === SUB_STRIKE || r.sub_event_type === SUB_SHELL) && r.week.startsWith('2025')) {
        strikeShellEvents2025 += r.event_count;
      }
    }
    return {
      tiers_note: 'Combat = clash + air/drone strike + shelling (interactional: measures contested operations, i.e. campaign intensity met by resistance, not operational tempo). Unilateral = arrests + disrupted weapons use (purely IDF-perpetrated but only notable arrests are coded — a floor, not a tempo). Resistance = grenade + IED (predominantly militant-perpetrated).',
      handoff: {
        first_window_settler_core_exceeds_idf_combat: firstCross,
        last_window_idf_combat_recovered_the_lead: lastReversal,
        current_52wk_settler_core: rollingCore.at(-1)!.total,
        current_52wk_idf_combat: rollingCombat.at(-1)!.total,
        note: 'Rolling 52-week comparison of the settler core proxy vs the IDF combat tier. The dated first crossing is the "handoff": the point from which the settler stream out-runs military operations in the event data.',
      },
      combat_tier_fatalities_by_year: combatFatByYear,
      validation: {
        ocha_fatalities_by_perpetrator: OCHA_FATALITIES_BY_PERPETRATOR,
        our_combat_tier_fatalities: { '2023': combatFatByYear['2023'], '2024': combatFatByYear['2024'], '2025': combatFatByYear['2025'], '2026_jan_oct': combatFatByYear['2026'] },
        fatalities_note: 'Combat-tier fatalities (clash + strike + shelling) track the shape of OCHA\'s actor-verified "by Israeli forces" attribution; the remainder of by-forces killings sits in the mixed VAC Attack stream, so the combat tier is a lower bound on by-forces fatalities.',
        arrests_tempo: ARREST_OPERATIONS_TEMPO,
        unrwA_airstrikes_2025_claimed: UNRWA_AIRSTRIKES_2025_CLAIMED,
        our_strike_plus_shelling_events_2025: strikeShellEvents2025,
      },
    };
  })();

  // --- Assemble + write ------------------------------------------------------

  const results = {
    generated_at: new Date().toISOString(),
    scope: {
      region: 'West Bank (admin1_id 11611)',
      weeks: weekGrid.length,
      first_week: weekGrid[0],
      last_week: weekGrid.at(-1),
      month_bins: monthKeys.length,
    },
    definitions: {
      core_proxy: `${CORE_STREAMS.join(' + ')} (property-destruction + land-seizure stream; highest settler attribution)`,
      broad_proxy: `${BROAD_STREAMS.join(' + ')} (civilian-facing violence complex; the sibling report's settler proxy plus SD streams)`,
      confrontational: `${CONFRONT_STREAMS.join(' + ')} (predominantly Palestinian-confrontational / anti-raid activity; attribution diagnostic)`,
      idf_combat: `${IDF_COMBAT_STREAMS.join(' + ')} (military-operations measure; interactional — counts operations met by resistance, not operational tempo)`,
      idf_unilateral: `${IDF_UNILATERAL_STREAMS.join(' + ')} (IDF-perpetrated policing/seizure activity; only notable arrests are coded, so this is a floor)`,
      resistance: `${RESISTANCE_STREAMS.join(' + ')} (predominantly militant-perpetrated; the mirror of the IDF tiers)`,
    },
    coverage: {
      wb_total_events: sum(weekly.map((d) => d.wb_events)),
      wb_total_fatalities: sum(weekly.map((d) => d.wb_fatalities)),
      mob_total_events: sum(sMob),
      looting_total_events: sum(sLoot),
      attack_total_events: sum(sAttack),
      sd_other_total_events: sum(sOther),
      core_total_events: sum(sCore),
      broad_total_events: sum(sBroad),
    },
    settler_eras: SETTLER_ERAS,
    era_summary: eraSummary,
    monthly_series: monthly,
    records: {
      top_months_broad: topMonthsBroad,
      top_months_core: topMonthsCore,
      top_months_mob: topMonthsMob,
      rolling_52wk_broad: {
        ...rolling52Broad,
        current_vs_era_mean_x: Object.fromEntries(eraSummary.map((e) => [e.era, round(rolling52Broad.current.total / (52 * e.broad_per_wk || NaN), 1)])),
      },
      rolling_52wk_core: rolling52Core,
      // The ratchet: each era's mean weekly rate vs the era before it.
      era_steps: eraSummary.map((e, i) => i === 0 ? { era: e.era, broad_vs_prev: null, core_vs_prev: null } : ({
        era: e.era,
        broad_vs_prev: round(e.broad_per_wk / (eraSummary[i - 1].broad_per_wk || NaN), 2),
        core_vs_prev: round(e.core_per_wk / (eraSummary[i - 1].core_per_wk || NaN), 2),
      })),
      // Every October (olive harvest month) in the series — the harvest season
      // the two late-October elections coincide with.
      october_by_year: yearKeys.filter((y) => y !== '2015').map((y) => {
        const m = monthly.find((r) => r.month === `${y}-10`)!;
        return { year: y, oct_broad: m.broad, oct_core: m.core, oct_mob: m.mob, oct_looting: m.looting };
      }),
      note: 'rolling 52-week totals are computed on consecutive week bins; the window ending at the last data week (2026-10-24) covers Nov 2025-Oct 2026; "pre-war"/"pre-cf2" maxima only consider windows ending before those boundaries, so they exclude any overlap with the current wave',
    },
    yearly,
    validation: {
      ocha_settler_attacks_by_year: OCHA_SETTLER_ATTACKS_BY_YEAR,
      ocha_source: 'OCHA oPt West Bank monthly snapshots — "attacks by Israeli settlers against Palestinians that resulted in casualties and/or property damage"',
      ocha_correlations: ochaValidation,
      acled_2026_checks: acled2026Checks,
    },
    gaza_window_proxy: gazaWindowProxy,
    event_studies: eventStudies,
    seasonality,
    change_point_scan: changePointScan,
    attribution,
    see_saw: seeSaw,
    cf2_monthly: cf2Monthly,
    idf_streams: idfStreams,
  };

  const outPath = join(dirname(fileURLToPath(import.meta.url)), 'settler-results.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));

  // --- Console summary --------------------------------------------------------

  console.log(`\nWest Bank settler-activity analysis — ${weekGrid.length} weeks (${weekGrid[0]} → ${weekGrid.at(-1)})`);
  console.log(`Broad proxy total: ${results.coverage.broad_total_events} events; core: ${results.coverage.core_total_events}; mob: ${results.coverage.mob_total_events}\n`);
  console.table(eraSummary.map((e) => ({
    era: e.era, wks: e.weeks, mob: e.mob_per_wk, loot: e.looting_per_wk, atk: e.attack_per_wk,
    other: e.sd_other_per_wk, core: e.core_per_wk, broad: e.broad_per_wk, conf: e.conf_per_wk,
    mob_fat_ev: e.mob_fat_per_event, broad_pct_wb: e.broad_share_of_wb_events_pct,
  })));
  console.log('\nRolling 52-week grounding (broad | core):');
  console.table({
    broad: rolling52Broad,
    core: rolling52Core,
  });
  console.log('\nGaza windows (ceasefire relationship):');
  console.table(gazaWindowProxy.map((g) => ({
    window: g.window, wks: g.weeks, broad_wk: g.broad_per_wk, core_wk: g.core_per_wk,
    conf_wk: g.conf_per_wk, gaza_fat_wk: g.gaza_fat_per_wk, r_vs_gaza: g.r_broad_vs_gaza_fatalities,
  })));
  console.log('\nEvent studies (±8wk, core/broad/confrontational per week):');
  console.table(eventStudies.map((e) => ({
    marker: e.marker, core_pre: e.core_pre8, core_post: e.core_post8,
    broad_pre: e.broad_pre8, broad_post: e.broad_post8, conf_pre: e.conf_pre8, conf_post: e.conf_post8,
  })));
  console.log('\nOCHA validation (yearly core proxy vs OCHA settler attacks):');
  console.table(yearly.map((y) => ({ year: y.year, core: y.core, looting: y.looting, ocha: y.ocha_settler_attacks, ratio: y.core_per_ocha_ratio })));
  console.log('\nIDF tiers + resistance by year (combat | unilateral | resistance | combat % of WB events | settler core):');
  console.table(yearly.filter((y) => y.year !== '2015').map((y) => ({
    year: y.year, months: y.months, combat: y.idf_combat, unilateral: y.idf_unilateral,
    resistance: y.resistance, combat_pct_wb: y.idf_combat_share_of_wb_events_pct, settler_core: y.core,
  })));
  const h = idfStreams.handoff;
  console.log(`Handoff: rolling 52-wk settler core first exceeds IDF combat at the window ending ${h.first_window_settler_core_exceeds_idf_combat}` +
    (h.last_window_idf_combat_recovered_the_lead ? ` (last reversal: ${h.last_window_idf_combat_recovered_the_lead})` : ' (never reversed since)'));
  console.log(`IDF combat-tier fatalities: 2023 ${idfStreams.combat_tier_fatalities_by_year['2023']} | 2024 ${idfStreams.combat_tier_fatalities_by_year['2024']} | 2025 ${idfStreams.combat_tier_fatalities_by_year['2025']} | 2026* ${idfStreams.combat_tier_fatalities_by_year['2026']}`);
  console.log(`\nFull output written to ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
