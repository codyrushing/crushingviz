#!/usr/bin/env bun

/**
 * Exploratory analysis: the relationship between violence in the Gaza Strip
 * and the West Bank across war/ceasefire regimes, from `acled_weekly_agg`.
 *
 * Companion report: ./gaza-west-bank-ceasefire-patterns.md (findings, context,
 * and source citations). This script reproduces every number in the report.
 *
 * What it does:
 * - pulls an aligned weekly series and all aggregate detail rows for the two
 *   territories (Gaza Strip = geographic_area id 11610, West Bank = 11611)
 * - classifies weeks into verified war/ceasefire regime windows (see WINDOWS
 *   below; boundaries anchored to real events — truce Nov 24 2023, ceasefire
 *   #1 Jan 19 2025, collapse Mar 18 2025, ceasefire #2 Oct 10 2025; the
 *   2016-2021 baseline is split into quiet / Great March of Return / quiet
 *   sub-regimes, since the GMR was an elevated protest era inside the
 *   ceasefire framework, not a war)
 * - computes regime-level statistics: per-window means/composition/lethality,
 *   Gaza↔West Bank correlations (levels, week-over-week changes, lags,
 *   rolling 26-week), monthly series, and ceasefire-transition week detail
 * - writes everything to ./results.json and prints a summary
 *
 * Read-only: never writes to the database.
 *
 * Usage (from repo root, so Bun loads the root .env):
 *   bun packages/data/analysis/gaza-west-bank-ceasefire/analyze.ts
 **/

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { sql } from '@pgtyped/runtime';
import { pool } from '../../db';

// Stable geographic_area ids for the two admin_1 territories under Palestine
// (geographic_area id 11609). Created by the ACLED ingest; documented in the
// companion report.
const GAZA_STRIP_ID = 11610;
const WEST_BANK_ID = 11611;

interface WeeklyRow {
  week: string;
  gaza_events: number;
  gaza_fatalities: number;
  wb_events: number;
  wb_fatalities: number;
}

interface DetailRow {
  region: 'gaza' | 'wb';
  week: string;
  disorder: string;
  event_type: string;
  sub_event_type: string;
  event_count: number;
  fatalities: number;
  population_exposure: number;
}

// to_char() keeps week as an unambiguous 'YYYY-MM-DD' string; pg would
// otherwise parse the naive timestamp into a timezone-dependent Date.
// NOTE: the pgtyped `sql` tag only reads the first template segment — JS
// interpolations (${...}) are ignored, so parameters must use $name tokens
// with values passed to .run().
const getAlignedWeekly = sql`
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

// Database-wide check of ACLED's design rule that strategic developments
// carry no exposure value ("Strategic developments: N/A" in the best
// estimate table).
const getStrategicDevPxCheck = sql`
  SELECT count(*) FILTER (WHERE population_exposure > 0) AS rows_with_px, count(*) AS rows_total
  FROM acled_weekly_agg
  WHERE event_type = 'Strategic developments'
`;

const getDetailRows = sql`
  SELECT admin1_id, to_char(week, 'YYYY-MM-DD') AS week, disorder_type, event_type, sub_event_type,
    event_count, fatalities, population_exposure
  FROM acled_weekly_agg
  WHERE admin1_id IN ($gazaId, $westBankId)
`;

interface RegimeWindow {
  label: string;
  start: string; // inclusive week start (Saturday)
  end: string; // exclusive
  anchor: string;
}

// Regime windows used throughout the report. [start, end) on week-start
// dates. Transition weeks mix ~1 day of the adjacent regime — unavoidable
// at weekly granularity. Boundaries verified against the data (see
// `transitions` in results.json) and cited news sources (see report §7).
const WINDOWS: RegimeWindow[] = [
  // The 2016-2021 stretch is split into three sub-regimes rather than one
  // "baseline": the Great March of Return (GMR) was an elevated-volume,
  // baseline-lethality protest confrontation INSIDE the post-2014 ceasefire
  // framework — never a war — and blending it with true quiet (0.2-0.8 Gaza
  // fat/wk vs the GMR's ~5) understates the reference category the see-saw
  // analysis is measured against.
  { label: 'quiet_2016_17', start: '2016-01-02', end: '2018-03-24', anchor: 'True quiet: post-2014 ceasefire status quo' },
  { label: 'gmr_2018_19', start: '2018-03-24', end: '2020-01-04', anchor: 'Great March of Return fence protests (began Fri Mar 30 2018, so the week of Mar 24 contains 1 GMR day); ceasefire framework held; embedded micro-escalations (Nov 2018 raid, May 2019 round, Nov 2019 Abu al-Ata killing) contained within days' },
  { label: 'quiet_2020_21', start: '2020-01-04', end: '2021-05-08', anchor: 'Post-GMR quiet (protests tapered through 2019; COVID ended mass gatherings Mar 2020)' },
  { label: 'may2021_war', start: '2021-05-08', end: '2021-05-22', anchor: 'May 10-21 2021 war (Guardian of the Walls); ceasefire May 21' },
  { label: 'post_may21_lull', start: '2021-05-22', end: '2022-07-30', anchor: 'Post-war lull' },
  { label: 'aug2022_war', start: '2022-07-30', end: '2022-08-13', anchor: 'Aug 5-7 2022 (Breaking Dawn); ceasefire Aug 7' },
  { label: 'prewar_2022_23', start: '2022-08-13', end: '2023-10-07', anchor: 'Settler-violence escalation era (govt change Dec 2022)' },
  { label: 'war_oct23', start: '2023-10-07', end: '2023-11-25', anchor: 'Oct 7 attack -> war onset' },
  { label: 'truce_nov23', start: '2023-11-25', end: '2023-12-02', anchor: 'Nov 24 - Dec 1 2023 truce (hostage pause)' },
  { label: 'war_dec23_jan25', start: '2023-12-02', end: '2025-01-18', anchor: 'War resumes Dec 1 2023' },
  { label: 'cf_jan25_phase1', start: '2025-01-18', end: '2025-03-15', anchor: 'Ceasefire #1 effective Jan 19 2025; Operation Iron Wall (WB) from Jan 21' },
  { label: 'war_mar25_oct25', start: '2025-03-15', end: '2025-10-11', anchor: 'Israel resumes strikes Mar 18 2025; intensified ops through summer' },
  { label: 'cf_oct25_now', start: '2025-10-11', end: '2026-11-01', anchor: 'Ceasefire #2 effective Oct 10 2025 12:00 local' },
];

// Week ranges around each ceasefire boundary, for verifying the windows
// against the actual fatality steps (report §2.3).
const TRANSITIONS: { label: string; start: string; end: string }[] = [
  { label: 'cf1_start_jan2025', start: '2025-01-04', end: '2025-04-05' },
  { label: 'cf1_collapse_mar2025', start: '2025-03-01', end: '2025-04-12' },
  { label: 'cf2_start_oct2025', start: '2025-09-20', end: '2025-12-20' },
  { label: 'early2026', start: '2025-12-20', end: '2026-02-07' },
];

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

// Average ranks (ties share the mean of their positions), for Spearman.
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const regionParams = { gazaId: GAZA_STRIP_ID, westBankId: WEST_BANK_ID };
  const weeklyRaw = await getAlignedWeekly.run(regionParams, pool);
  const detailRaw = await getDetailRows.run(regionParams, pool);

  const weekly: WeeklyRow[] = weeklyRaw.map((r: Record<string, unknown>) => ({
    week: String(r.week),
    gaza_events: Number(r.gaza_events ?? 0),
    gaza_fatalities: Number(r.gaza_fatalities ?? 0),
    wb_events: Number(r.wb_events ?? 0),
    wb_fatalities: Number(r.wb_fatalities ?? 0),
  }));

  const detail: DetailRow[] = detailRaw.map((r: Record<string, unknown>) => ({
    region: r.admin1_id === GAZA_STRIP_ID ? 'gaza' : 'wb',
    week: String(r.week),
    disorder: String(r.disorder_type),
    event_type: String(r.event_type),
    sub_event_type: String(r.sub_event_type),
    event_count: Number(r.event_count),
    fatalities: Number(r.fatalities),
    population_exposure: Number(r.population_exposure),
  }));

  // Full Saturday-start week grid — weeks with zero events in a region have
  // no rows, so the grid (union of both regions' weeks) is the time axis.
  const weekGrid = [...new Set(detail.map((r) => r.week))].sort();
  const weeksIn = (start: string, end: string) => weekGrid.filter((w) => inRange(w, start, end));

  const gaps: { after: string; days: number }[] = [];
  for (let i = 1; i < weekly.length; i++) {
    const days = (new Date(weekly[i].week).getTime() - new Date(weekly[i - 1].week).getTime()) / 86400000;
    if (days !== 7) gaps.push({ after: weekly[i - 1].week, days });
  }

  // --- Gaza ↔ WB correlation structure ---

  const gazaFat = weekly.map((d) => d.gaza_fatalities);
  const wbFat = weekly.map((d) => d.wb_fatalities);
  const gazaEv = weekly.map((d) => d.gaza_events);
  const wbEv = weekly.map((d) => d.wb_events);
  const dGazaFat = gazaFat.slice(1).map((v, i) => v - gazaFat[i]);
  const dWbFat = wbFat.slice(1).map((v, i) => v - wbFat[i]);

  // Lag k = Gaza at week t vs WB at week t+k.
  const lagged = (gx: number[], wy: number[], k: number) => {
    const x: number[] = [], y: number[] = [];
    for (let t = Math.max(0, -k); t < gx.length - Math.max(0, k); t++) {
      x.push(gx[t]); y.push(wy[t + k]);
    }
    return pearson(x, y);
  };

  const lagTable = (from: number, to: number, useEvents: boolean, useChanges = false) => {
    const out: { lag: number; r: number }[] = [];
    for (let k = from; k <= to; k++) {
      if (useChanges) {
        const x: number[] = [], y: number[] = [];
        for (let t = Math.max(0, -k); t < dGazaFat.length - Math.max(0, k); t++) {
          x.push(dGazaFat[t]); y.push(dWbFat[t + k]);
        }
        out.push({ lag: k, r: round(pearson(x, y), 3) });
      } else {
        out.push({
          lag: k,
          r: round(lagged(useEvents ? gazaEv : gazaFat, useEvents ? wbEv : wbFat, k), 3),
        });
      }
    }
    return out;
  };

  const rolling26: { week: string; r: number }[] = [];
  for (let t = 25; t < weekly.length; t++) {
    rolling26.push({
      week: weekly[t].week,
      r: round(pearson(gazaFat.slice(t - 25, t + 1), wbFat.slice(t - 25, t + 1)), 3),
    });
  }

  // --- Per-window aggregates ---

  const windowSummary = WINDOWS.map(({ label, start, end }) => {
    const n = weeksIn(start, end).length;
    const tot = { gaza: { e: 0, f: 0, px: 0 }, wb: { e: 0, f: 0, px: 0 } };
    const wbFatByType: Record<string, number> = {};
    for (const r of detail) {
      if (!inRange(r.week, start, end)) continue;
      const o = tot[r.region];
      o.e += r.event_count; o.f += r.fatalities; o.px += r.population_exposure;
      if (r.region === 'wb') wbFatByType[r.event_type] = (wbFatByType[r.event_type] ?? 0) + r.fatalities;
    }
    return {
      window: label, weeks: n,
      gaza_fat_per_wk: round(tot.gaza.f / n, 1), gaza_ev_per_wk: round(tot.gaza.e / n, 1),
      wb_fat_per_wk: round(tot.wb.f / n, 1), wb_ev_per_wk: round(tot.wb.e / n, 1),
      wb_share_of_combined_events_pct: round((100 * tot.wb.e) / (tot.wb.e + tot.gaza.e), 1),
      wb_share_of_combined_fatalities_pct: round((100 * tot.wb.f) / (tot.wb.f + tot.gaza.f), 1),
      gaza_px_per_wk: Math.round(tot.gaza.px / n),
      wb_px_per_wk: Math.round(tot.wb.px / n),
      wb_share_of_combined_px_pct: round((100 * tot.wb.px) / (tot.wb.px + tot.gaza.px), 1),
      gaza_px_per_event: Math.round(tot.gaza.px / (tot.gaza.e || 1)),
      wb_px_per_event: Math.round(tot.wb.px / (tot.wb.e || 1)),
      gaza_px_per_fatality: Math.round(tot.gaza.px / (tot.gaza.f || 1)),
      wb_px_per_fatality: Math.round(tot.wb.px / (tot.wb.f || 1)),
      wb_fatalities_by_event_type: wbFatByType,
      gaza_fat_per_event: round(tot.gaza.f / (tot.gaza.e || 1), 2),
      wb_fat_per_event: round(tot.wb.f / (tot.wb.e || 1), 4),
    };
  });

  // Event-type composition (share of events) per window per region.
  const composition: Record<string, Record<string, { event_type: string; share_pct: number; fat_total: number }[]>> = {};
  for (const { label, start, end } of WINDOWS) {
    composition[label] = { gaza: [], wb: [] };
    for (const region of ['gaza', 'wb'] as const) {
      const m = new Map<string, { e: number; f: number }>();
      let tot = 0;
      for (const r of detail) {
        if (r.region !== region || !inRange(r.week, start, end)) continue;
        if (!m.has(r.event_type)) m.set(r.event_type, { e: 0, f: 0 });
        const o = m.get(r.event_type)!; o.e += r.event_count; o.f += r.fatalities;
        tot += r.event_count;
      }
      composition[label][region] = [...m.entries()]
        .map(([et, v]) => ({ event_type: et, share_pct: round((100 * v.e) / (tot || 1), 1), fat_total: v.f }))
        .sort((a, b) => b.share_pct - a.share_pct);
    }
  }

  // Sub-event detail per window per region (per-week means, top 8 by volume).
  const subEvents: Record<string, Record<string, { sub_event_type: string; ev_per_wk: number; share_pct: number; fat_total: number }[]>> = {};
  for (const { label, start, end } of WINDOWS) {
    subEvents[label] = { gaza: [], wb: [] };
    const n = weeksIn(start, end).length;
    for (const region of ['gaza', 'wb'] as const) {
      const m = new Map<string, { e: number; f: number }>();
      let tot = 0;
      for (const r of detail) {
        if (r.region !== region || !inRange(r.week, start, end)) continue;
        if (!m.has(r.sub_event_type)) m.set(r.sub_event_type, { e: 0, f: 0 });
        const o = m.get(r.sub_event_type)!; o.e += r.event_count; o.f += r.fatalities;
        tot += r.event_count;
      }
      subEvents[label][region] = [...m.entries()]
        .map(([st, v]) => ({
          sub_event_type: st,
          ev_per_wk: round(v.e / n, 1),
          share_pct: round((100 * v.e) / (tot || 1), 1),
          fat_total: v.f,
        }))
        .sort((a, b) => b.ev_per_wk - a.ev_per_wk)
        .slice(0, 8);
    }
  }

  // Within-regime Pearson correlation of weekly event counts (Gaza vs WB).
  // Windows with fewer than 3 weeks yield degenerate correlations — null them.
  const withinRegimeEventCorrelation = WINDOWS.map(({ label, start, end }) => {
    const g: number[] = [], w: number[] = [];
    for (const t of weeksIn(start, end)) {
      const row = weekly.find((d) => d.week === t);
      g.push(row?.gaza_events ?? 0);
      w.push(row?.wb_events ?? 0);
    }
    return {
      window: label,
      weeks: g.length,
      r_events: g.length >= 3 ? round(pearson(g, w), 3) : null,
    };
  });

  // Combined pre-war era (2016 → Oct 6 2023): the report's headline
  // "pre-Oct-2023 event correlation" spanning all pre-war windows.
  {
    const g: number[] = [], w: number[] = [];
    for (const t of weeksIn('2016-01-02', '2023-10-07')) {
      const row = weekly.find((d) => d.week === t);
      g.push(row?.gaza_events ?? 0);
      w.push(row?.wb_events ?? 0);
    }
    withinRegimeEventCorrelation.unshift({
      window: 'pre_oct23_era (combined)',
      weeks: g.length,
      r_events: round(pearson(g, w), 3),
    });
  }

  // The Dec 2017 - Mar 2018 "days of rage" stretch (after the US Jerusalem
  // embassy recognition, Dec 6 2017) co-mobilized both theatres' event volume
  // and drives most of the quiet_2016_17 event correlation; excluded, it
  // drops from ~0.8 to ~0.27. Reported alongside the window stats so the
  // numbers stay reproducible from this script.
  const notableCorrelations = (() => {
    const sliceMean = (a: string, b: string) => {
      const g: number[] = [], w: number[] = [];
      for (const t of weeksIn(a, b)) {
        const row = weekly.find((d) => d.week === t);
        g.push(row?.gaza_events ?? 0);
        w.push(row?.wb_events ?? 0);
      }
      const mean = (v: number[]) => v.reduce((x, y) => x + y, 0) / (v.length || 1);
      return { weeks: g.length, gaza_ev_wk: mean(g), wb_ev_wk: mean(w), g, w };
    };
    const before = sliceMean('2016-01-02', '2017-12-02');
    const during = sliceMean('2017-12-02', '2018-03-24');
    return [
      {
        label: 'quiet_2016_17_event_r_excluding_days_of_rage',
        description: 'Pearson r of weekly Gaza vs WB events, quiet_2016_17 window excluding the Dec 2017 - Mar 2018 "days of rage" surge',
        r: round(pearson(before.g, before.w), 3),
      },
      {
        label: 'days_of_rage_surge_means',
        description: 'Mean weekly events before (quiet_2016_17 minus surge) vs during the 16-week days-of-rage surge (weeks of 2017-12-02 .. 2018-03-17)',
        weeks_before: before.weeks,
        weeks_during: during.weeks,
        gaza_ev_wk_before: round(before.gaza_ev_wk, 1),
        gaza_ev_wk_during: round(during.gaza_ev_wk, 1),
        wb_ev_wk_before: round(before.wb_ev_wk, 1),
        wb_ev_wk_during: round(during.wb_ev_wk, 1),
      },
    ];
  })();

  // Settler-violence proxy sub-events, per week, per window (WB only).
  const settlerProxy = WINDOWS.map(({ label, start, end }) => {
    const n = weeksIn(start, end).length;
    const m = { 'Mob violence': 0, 'Looting/property destruction': 0, 'Attack': 0, 'Armed clash': 0 } as Record<string, number>;
    for (const r of detail) {
      if (r.region !== 'wb' || !inRange(r.week, start, end)) continue;
      if (r.sub_event_type in m) m[r.sub_event_type] += r.event_count;
    }
    return {
      window: label,
      mob_violence_per_wk: round(m['Mob violence'] / n, 1),
      looting_property_destruction_per_wk: round(m['Looting/property destruction'] / n, 1),
      attack_per_wk: round(m['Attack'] / n, 1),
      armed_clash_per_wk: round(m['Armed clash'] / n, 1),
    };
  });

  // --- Time series views ---

  const monthlySinceOct2023: Record<string, { month: string; gaza_events: number; gaza_fatalities: number; wb_events: number; wb_fatalities: number }> = {};
  for (const d of weekly) {
    if (d.week < '2023-10-01') continue;
    const month = d.week.slice(0, 7);
    if (!monthlySinceOct2023[month]) {
      monthlySinceOct2023[month] = { month, gaza_events: 0, gaza_fatalities: 0, wb_events: 0, wb_fatalities: 0 };
    }
    const o = monthlySinceOct2023[month];
    o.gaza_events += d.gaza_events; o.gaza_fatalities += d.gaza_fatalities;
    o.wb_events += d.wb_events; o.wb_fatalities += d.wb_fatalities;
  }

  const wbMonthlyByTypeSinceOct2025: Record<string, Record<string, number>> = {};
  for (const r of detail) {
    if (r.region !== 'wb' || r.week < '2025-10-01') continue;
    const month = r.week.slice(0, 7);
    if (!wbMonthlyByTypeSinceOct2025[month]) wbMonthlyByTypeSinceOct2025[month] = {};
    wbMonthlyByTypeSinceOct2025[month][r.event_type] =
      (wbMonthlyByTypeSinceOct2025[month][r.event_type] ?? 0) + r.event_count;
  }

  const transitions: Record<string, { week: string; gaza_fatalities: number }[]> = {};
  for (const { label, start, end } of TRANSITIONS) {
    transitions[label] = weeksIn(start, end).map((w) => ({
      week: w,
      gaza_fatalities: weekly.find((d) => d.week === w)?.gaza_fatalities ?? 0,
    }));
  }

  // Highest-fatality Gaza weeks inside the current ceasefire — the
  // "ceasefire is not zero" spike weeks (report §3.8).
  const cfNow = WINDOWS.find((w) => w.label === 'cf_oct25_now')!;
  const topGazaCeasefireWeeks = weekly
    .filter((d) => inRange(d.week, cfNow.start, cfNow.end))
    .map((d) => ({ week: d.week, gaza_fatalities: d.gaza_fatalities }))
    .sort((a, b) => b.gaza_fatalities - a.gaza_fatalities)
    .slice(0, 8);

  // --- Population exposure dimension -----------------------------------
  // ACLED's conflict-exposure metric (`population_best` in the source
  // export): WorldPop-estimated residents within a type-dependent radius of
  // each event (battles/explosions 5 km, riots 2 km, VAC 2 km (5 km when
  // fatal), protests 1 km, strategic developments none), Voronoi-deduped so
  // repeated events in one neighborhood do not multiply the exposed count.
  // Built as a scale-of-human-impact complement to hard-to-measure fatality
  // counts. Caveats: static 2020-22 population baseline (not
  // displacement-adjusted), and weekly sums across different locations can
  // exceed a region's population — see report §3.9 and caveat 8.

  // Weekly exposure series per region, aligned to the weekly grid.
  const weeklyPx = new Map<string, { gaza: number; wb: number }>();
  for (const w of weekGrid) weeklyPx.set(w, { gaza: 0, wb: 0 });
  for (const r of detail) {
    weeklyPx.get(r.week)![r.region] += r.population_exposure;
  }
  const gazaPx = weekly.map((d) => weeklyPx.get(d.week)?.gaza ?? 0);
  const wbPx = weekly.map((d) => weeklyPx.get(d.week)?.wb ?? 0);

  // Coupling meter on exposure (parallel to the fatalities one).
  const rolling26px: { week: string; r: number }[] = [];
  for (let t = 25; t < weekly.length; t++) {
    rolling26px.push({
      week: weekly[t].week,
      r: round(pearson(gazaPx.slice(t - 25, t + 1), wbPx.slice(t - 25, t + 1)), 3),
    });
  }

  // How tightly does exposure track fatalities within each regime? Loose
  // coupling (especially under ceasefires) is evidence that exposure is an
  // independent dimension, not a fatality proxy.
  const exposureFatalityCorr = WINDOWS.map(({ label, start, end }) => {
    const idx = weekly.map((d, i) => (inRange(d.week, start, end) ? i : -1)).filter((i) => i >= 0);
    const pick = (arr: number[]) => idx.map((i) => arr[i]);
    return {
      window: label,
      gaza_r_px_fat: idx.length >= 3 ? round(pearson(pick(gazaPx), pick(gazaFat)), 2) : null,
      wb_r_px_fat: idx.length >= 3 ? round(pearson(pick(wbPx), pick(wbFat)), 2) : null,
    };
  });

  // Which event types carry the exposure, per window per region. Note the
  // radii are type-dependent, so a 20%-of-events explosions share can carry
  // far more than 20% of exposure.
  const exposureByEventType: Record<string, Record<string, { event_type: string; px_share_pct: number; px_per_wk: number }[]>> = {};
  for (const { label, start, end } of WINDOWS) {
    exposureByEventType[label] = { gaza: [], wb: [] };
    const n = weeksIn(start, end).length;
    for (const region of ['gaza', 'wb'] as const) {
      const m = new Map<string, number>();
      let tot = 0;
      for (const r of detail) {
        if (r.region !== region || !inRange(r.week, start, end)) continue;
        m.set(r.event_type, (m.get(r.event_type) ?? 0) + r.population_exposure);
        tot += r.population_exposure;
      }
      exposureByEventType[label][region] = [...m.entries()]
        .map(([et, px]) => ({
          event_type: et,
          px_share_pct: round((100 * px) / (tot || 1), 1),
          px_per_wk: Math.round(px / n),
        }))
        .sort((a, b) => b.px_share_pct - a.px_share_pct);
    }
  }

  // Violent vs non-violent ORIGIN of exposure. ACLED's disorder_type is the
  // authoritative class, but it bundles peaceful protests together with
  // violent demonstrations under "Demonstrations" (and codes Mob violence as
  // Political violence), so the binary is defined at the sub-event level:
  //   violent — all Battles / Explosions / VAC, all Riots (Mob violence and
  //     Violent demonstration are violent confrontations), and Excessive
  //     force against protesters (state force used, disorder
  //     'Political violence; Demonstrations')
  //   non-violent — Peaceful protest, Protest with intervention, and
  //     Strategic developments (which carry zero exposure by design anyway)
  const classifyOrigin = (et: string, st: string): 'violent' | 'nonviolent' => {
    if (et === 'Protests') return st === 'Excessive force against protesters' ? 'violent' : 'nonviolent';
    if (et === 'Strategic developments') return 'nonviolent';
    return 'violent';
  };

  const violentVsNonviolent: Record<
    string,
    Record<
      string,
      {
        violent: { events: number; fatalities: number; px: number };
        nonviolent: { events: number; fatalities: number; px: number };
        px_share_violent_pct: number;
        events_share_violent_pct: number;
        by_disorder: Record<string, { events: number; fatalities: number; px: number }>;
      }
    >
  > = {};
  for (const { label, start, end } of WINDOWS) {
    violentVsNonviolent[label] = { gaza: undefined as never, wb: undefined as never };
    for (const region of ['gaza', 'wb'] as const) {
      const acc = {
        violent: { events: 0, fatalities: 0, px: 0 },
        nonviolent: { events: 0, fatalities: 0, px: 0 },
      };
      const byDisorder: Record<string, { events: number; fatalities: number; px: number }> = {};
      for (const r of detail) {
        if (r.region !== region || !inRange(r.week, start, end)) continue;
        const o = acc[classifyOrigin(r.event_type, r.sub_event_type)];
        o.events += r.event_count; o.fatalities += r.fatalities; o.px += r.population_exposure;
        const d = byDisorder[r.disorder] ?? (byDisorder[r.disorder] = { events: 0, fatalities: 0, px: 0 });
        d.events += r.event_count; d.fatalities += r.fatalities; d.px += r.population_exposure;
      }
      const totPx = acc.violent.px + acc.nonviolent.px;
      const totEv = acc.violent.events + acc.nonviolent.events;
      violentVsNonviolent[label][region] = {
        ...acc,
        px_share_violent_pct: round((100 * acc.violent.px) / (totPx || 1), 1),
        events_share_violent_pct: round((100 * acc.violent.events) / (totEv || 1), 1),
        by_disorder: byDisorder,
      };
    }
  }

  // Yearly totals per region plus the share of aggregate rows with zero
  // exposure — a data-quality view (strategic developments carry no
  // best-estimate exposure by design; rural events can genuinely expose 0).
  const pxByYear: Record<string, { gaza: number; wb: number; zero_px_row_share_pct: number }> = {};
  {
    const rowsByYear = new Map<string, { rows: number; zero: number }>();
    for (const r of detail) {
      const y = r.week.slice(0, 4);
      const pxYear = pxByYear[y] ?? (pxByYear[y] = { gaza: 0, wb: 0, zero_px_row_share_pct: 0 });
      pxYear[r.region] += r.population_exposure;
      const cnt = rowsByYear.get(y) ?? { rows: 0, zero: 0 };
      cnt.rows++;
      if (r.population_exposure === 0) cnt.zero++;
      rowsByYear.set(y, cnt);
    }
    for (const [y, cnt] of rowsByYear) {
      pxByYear[y].zero_px_row_share_pct = round((100 * cnt.zero) / cnt.rows, 1);
    }
  }

  // Monthly exposure since Oct 2023, both regions (report table).
  const monthlyPx: Record<string, { month: string; gaza_px: number; wb_px: number }> = {};
  for (let i = 0; i < weekly.length; i++) {
    if (weekly[i].week < '2023-10-01') continue;
    const month = weekly[i].week.slice(0, 7);
    if (!monthlyPx[month]) monthlyPx[month] = { month, gaza_px: 0, wb_px: 0 };
    monthlyPx[month].gaza_px += gazaPx[i];
    monthlyPx[month].wb_px += wbPx[i];
  }

  // Weekly exposure around each ceasefire transition, to compare the
  // exposure step against the fatality step at each boundary.
  const transitionsPx: Record<string, { week: string; gaza_px: number; wb_px: number }[]> = {};
  for (const { label, start, end } of TRANSITIONS) {
    transitionsPx[label] = weeksIn(start, end).map((w) => ({
      week: w,
      gaza_px: weeklyPx.get(w)?.gaza ?? 0,
      wb_px: weeklyPx.get(w)?.wb ?? 0,
    }));
  }

  // Highest-exposure Gaza weeks inside the current ceasefire: the weeks when
  // the most residents were still near military activity despite the pause.
  const topGazaCeasefirePxWeeks = weekly
    .map((d, i) => ({ week: d.week, gaza_px: gazaPx[i] }))
    .filter((d) => inRange(d.week, cfNow.start, cfNow.end))
    .sort((a, b) => b.gaza_px - a.gaza_px)
    .slice(0, 8);

  // --- Strategic-development stream: captured only on the event axis -----
  // SD events (the closest aggregate-table proxy for the land-seizure wave,
  // plus looting/property destruction) carry ~no fatalities and — by ACLED's
  // design — no exposure value, so they are invisible to impact-weighted
  // metrics. Quantify the stream explicitly (WB by year, ceasefire-window
  // sub-event breakdown, exposure-rule checks) so the report's
  // capture-mechanism claims are reproducible from this script.

  const wbSdByYear: Record<string, { year: string; events: number; fatalities: number }> = {};
  for (const r of detail) {
    if (r.region !== 'wb' || r.event_type !== 'Strategic developments') continue;
    const y = r.week.slice(0, 4);
    if (!wbSdByYear[y]) wbSdByYear[y] = { year: y, events: 0, fatalities: 0 };
    wbSdByYear[y].events += r.event_count;
    wbSdByYear[y].fatalities += r.fatalities;
  }

  const sdSubEventsCfNow = (() => {
    const m = new Map<string, { events: number; fatalities: number; px: number }>();
    for (const r of detail) {
      if (r.region !== 'wb' || r.event_type !== 'Strategic developments') continue;
      if (!inRange(r.week, cfNow.start, cfNow.end)) continue;
      if (!m.has(r.sub_event_type)) m.set(r.sub_event_type, { events: 0, fatalities: 0, px: 0 });
      const o = m.get(r.sub_event_type)!;
      o.events += r.event_count; o.fatalities += r.fatalities; o.px += r.population_exposure;
    }
    return [...m.entries()]
      .map(([st, v]) => ({ sub_event_type: st, events: v.events, fatalities: v.fatalities, px: v.px }))
      .sort((a, b) => b.events - a.events);
  })();

  // Exposure-rule checks: within the two territories (from detail rows) and
  // database-wide (from the dedicated query above).
  const sdRows = detail.filter((r) => r.event_type === 'Strategic developments');
  const sdPxCheckGlobalRaw = await getStrategicDevPxCheck.run(undefined, pool);

  // --- Assemble + write artifact ---

  const results = {
    generated_at: new Date().toISOString(),
    regions: { gaza_strip_admin1_id: GAZA_STRIP_ID, west_bank_admin1_id: WEST_BANK_ID },
    coverage: {
      weeks: weekly.length,
      first_week: weekly[0]?.week,
      last_week: weekly.at(-1)?.week,
      gaps,
      gaza_total_events: gazaEv.reduce((a, b) => a + b, 0),
      gaza_total_fatalities: gazaFat.reduce((a, b) => a + b, 0),
      wb_total_events: wbEv.reduce((a, b) => a + b, 0),
      wb_total_fatalities: wbFat.reduce((a, b) => a + b, 0),
    },
    windows: WINDOWS,
    overall_correlations: {
      pearson_fatalities: round(pearson(gazaFat, wbFat), 3),
      spearman_fatalities: round(spearman(gazaFat, wbFat), 3),
      pearson_events: round(pearson(gazaEv, wbEv), 3),
      spearman_events: round(spearman(gazaEv, wbEv), 3),
      pearson_week_over_week_fatality_changes: round(pearson(dGazaFat, dWbFat), 3),
    },
    lagged_correlations: {
      fatality_levels: lagTable(-8, 8, false),
      event_levels: lagTable(-8, 8, true),
      fatality_changes: lagTable(-4, 4, false, true),
    },
    rolling_26wk_fatalities: rolling26,
    window_summary: windowSummary,
    within_regime_event_correlation: withinRegimeEventCorrelation,
    notable_correlations: notableCorrelations,
    composition,
    sub_events: subEvents,
    settler_proxy_per_window: settlerProxy,
    monthly_since_oct_2023: Object.values(monthlySinceOct2023),
    wb_monthly_by_event_type_since_oct_2025: wbMonthlyByTypeSinceOct2025,
    transitions,
    top_gaza_ceasefire_fatality_weeks: topGazaCeasefireWeeks,
    exposure_analysis: {
      metric:
        "ACLED conflict exposure (`population_best` in the source export): WorldPop-estimated residents within a type-dependent radius of each event (battles/explosions 5 km, riots 2 km, VAC 2 km / 5 km when fatal, protests 1 km, strategic developments none), Voronoi-deduped within location-period. Static 2020-22 WorldPop baseline — not displacement-adjusted.",
      rolling_26wk_exposure: rolling26px,
      exposure_vs_fatalities_correlations: exposureFatalityCorr,
      exposure_by_event_type: exposureByEventType,
      violent_vs_nonviolent_origin: violentVsNonviolent,
      px_by_year: pxByYear,
      monthly_exposure_since_oct_2023: Object.values(monthlyPx),
      transitions_exposure: transitionsPx,
      top_gaza_ceasefire_exposure_weeks: topGazaCeasefirePxWeeks,
    },
    strategic_developments: {
      note:
        'Strategic-development events are captured only on the event axis: ~no fatalities, and no exposure value by ACLED design (no radius assigned). Present in every event-based view; absent from every fatality- and exposure-based view.',
      wb_by_year: Object.values(wbSdByYear),
      wb_ceasefire_sub_events: sdSubEventsCfNow,
      exposure_check_two_territories: {
        sd_rows: sdRows.length,
        sd_rows_with_px: sdRows.filter((r) => r.population_exposure > 0).length,
      },
      exposure_check_database_wide: {
        rows_with_px: Number(sdPxCheckGlobalRaw[0]?.rows_with_px ?? 0),
        rows_total: Number(sdPxCheckGlobalRaw[0]?.rows_total ?? 0),
      },
    },
  };

  const outPath = join(dirname(fileURLToPath(import.meta.url)), 'results.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));

  // --- Console summary ---

  console.log(`\nGaza ↔ West Bank regime analysis — ${results.coverage.weeks} weeks (${results.coverage.first_week} → ${results.coverage.last_week}), gaps: ${gaps.length}`);
  console.log(`Overall corr (fatalities): r=${results.overall_correlations.pearson_fatalities} | week-over-week changes: r=${results.overall_correlations.pearson_week_over_week_fatality_changes} (coupling is regime-level, not weekly)\n`);
  console.table(
    windowSummary.map((w) => ({
      window: w.window,
      weeks: w.weeks,
      gaza_fat_wk: w.gaza_fat_per_wk,
      wb_fat_wk: w.wb_fat_per_wk,
      gaza_ev_wk: w.gaza_ev_per_wk,
      wb_ev_wk: w.wb_ev_per_wk,
      gaza_px_wk: w.gaza_px_per_wk,
      wb_px_wk: w.wb_px_per_wk,
      wb_pct_events: w.wb_share_of_combined_events_pct,
      wb_pct_fat: w.wb_share_of_combined_fatalities_pct,
      wb_pct_px: w.wb_share_of_combined_px_pct,
    })),
  );
  console.log(`\nFull output written to ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
