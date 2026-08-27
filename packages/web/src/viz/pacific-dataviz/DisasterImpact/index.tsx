import { createEffect, createMemo, createSignal, For, Show, onCleanup } from "solid-js";
import { select, type Selection } from "d3-selection";
import "d3-transition";
import { scaleLinear, scaleSequential, type ScaleLinear } from "d3-scale";
import { interpolateBlues, interpolateRdYlGn } from "d3-scale-chromatic";
import { axisBottom, axisLeft, axisRight, axisTop } from "d3-axis";
import { area, curveBumpX, curveMonotoneX, line, stack, stackOffsetWiggle, type Series, type SeriesPoint } from "d3-shape";
import { useElementVisibility } from "../../../hooks/useElementVisibility";
import { countries, GDPByCountry, disasterAffected, populationByCountry, disasterLossPctGDP } from "../data";
import { Tooltip } from "../../../components/Tooltip";
import { ButtonGroup } from "../../../components/ButtonGroup";
import { XCircle } from "../../../icons/XCircle";
import { format } from "d3-format";

// remove countries whose population is too statistically small
// and could confound per-capita values
disasterAffected.countries = Object.fromEntries(
  Object.entries(disasterAffected.countries)
    .filter(([k, v]) => v.pop_ref_2014 > 10000)
    .map(([k, v]) => [k, v])
);

type Metric = "affected" | "affectedPctPop" | "lossPctGDP";

const METRICS: { value: Metric; label: string; title?: string }[] = [
  { value: "affected", label: "Num affected", title: "Number of directly affected persons" },
  { value: "affectedPctPop", label: "% of population", title: "Affected persons as a share of population" },
  // { value: "lossPctGDP", label: "Loss % of GDP", title: "Direct economic loss as a share of GDP" }
];

const METRICS_BY_VALUE: Partial<Record<Metric, (typeof METRICS)[number]>> = {};
for (const m of METRICS) {
  METRICS_BY_VALUE[m.value] = m;
}

const minYear = Math.min(disasterAffected.year_span[0], disasterLossPctGDP.year_span[0]);
// there is incomplete 2026 data in the dataset, let's only show full years
const maxYear = Math.min(Math.max(disasterAffected.year_span[1], disasterLossPctGDP.year_span[1]), 2025);
export const [selectedYear, setSelectedYear] = createSignal<number>(minYear);
export const [selectedCountry, setSelectedCountry] = createSignal<string | null>(null);
const [hoveredCountry, setHoveredCountry] = createSignal<string | null>(null);

function toggleSelectedCountry(code: string) {
  if (selectedCountry() === code) {
    setHoveredCountry(null);
  }
  setSelectedCountry(prev => (prev === code ? null : code));
}

// Which country is currently highlighted: a locked selection wins, else the hovered one.
function activeCountry() {
  return selectedCountry() ?? hoveredCountry();
}

export function DisasterImpact() {
  const { isVisible, intersectionRatio, hiddenAbove, hiddenBelow, ref } =
    useElementVisibility();
  let chartContainer!: HTMLDivElement;
  let chart: ReturnType<typeof DisasterImpactChart> | undefined;
  const [metric, setMetric] = createSignal<Metric>("affectedPctPop");


  createEffect(
    () => {
      chart = chart ?? DisasterImpactChart(chartContainer);
      chart.render(metric());
    }
  );

  return (
    <div class="h-screen flex font-monospace gap-1" ref={ref}>
      <div class="flex flex-col flex-1 gap-0 min-w-0">
        <div class="max-w-sm mx-auto">
          <ButtonGroup
            value={metric()}
            onChange={setMetric}
            options={METRICS}
          />
        </div>
        <div class="chart-container flex-1" ref={chartContainer}></div>
        <div class="countries flex-1"><CountryLollipops metric={metric} /></div>
      </div>
    </div>
  );
}

/*
The purpose of this component:
* Demonstrate relationship between GDP per-capita and disaster exposure, both in absolute and per-capita terms
* Show which countries have the greatest disaster exposure (will be used later)
* Show avg and peak disaster exposure
Not needed:
* Per-year historical data

Strategy:
* Dual bars - GDP in one direction, disaster exposure in the other.
* Boxplot - shows mean and ma    * color is unclear
x, but better for showing a more continuous distribution. this data is mostly peaks and valleys
* Lollipop - two heads (mean and max)
  * but how to show GDP?
    * color is unclear
    * ordering obscures the relative values
    * do another lollipop for GDP in opposite direction
*/
function CountryLollipops(props: { metric: () => Metric }) {
  let container!: HTMLDivElement;
  let svgHost!: HTMLDivElement;
  const [size, setSize] = createSignal({ width: 0, height: 0 });
  const [sortBy, setSortBy] = createSignal<"metric" | "gdp">("metric");
  const [metricAgg, setMetricAgg] = createSignal<"mean" | "max">("mean");

  // Measure the SVG host so geometry matches the drawable area (excluding the
  // sort button row above it).
  createEffect(() => {
    const el = svgHost;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });

  // Per-country mean/max of the active metric plus mean GDP per capita.
  // Mirrors the computations in CountryTooltipContent.
  const stats = createMemo(() => {
    const m = props.metric();
    return rows.map((row, i) => {
      const vals = Object.values(row.series[m]).filter(Number.isFinite);
      const mean = vals.length ? vals.reduce<number>((a, b) => a + b, 0) / vals.length : NaN;
      const max = vals.length ? Math.max(...vals) : NaN;
      return { code: row.code, name: row.name, flag: row.flag, mean, max, gdp: avgGdpPc[i] };
    });
  });

  const sorted = createMemo(() => {
    const key = sortBy();
    return [...stats()].sort((a, b) => {
      const av = key === "metric" ? a.mean : a.gdp;
      const bv = key === "metric" ? b.mean : b.gdp;
      return (Number.isFinite(av) ? av : Infinity) - (Number.isFinite(bv) ? bv : Infinity);
    });
  });

  // The metric lollipop plots only one aggregation at a time (mean OR max),
  // each fit to its own scale so the smaller mean values aren't drowned out
  // by peaks. GDP stays a single mean-per-capita lollipop in the other direction.
  const globalMaxMetric = createMemo(() => {
    const agg = metricAgg();
    return Math.max(...stats().map(s => (agg === "mean" ? s.mean : s.max)).filter(Number.isFinite), 0);
  });
  const globalMaxGdp = Math.max(...avgGdpPc.filter(Number.isFinite), 0);

  // Two side-by-side bars per country (metric + GDP) growing the same
  // direction. Flags label each band along the longer axis. The shorter axis
  // has two y-axes: metric on one side, GDP on the other.
  const layout = createMemo(() => {
    const { width, height } = size();
    if (!width || !height) return null;
    const n = sorted().length;
    if (!n) return null;
    const horizontal = width >= height;
    // padding for flag strip + axis ticks/labels
    const flagPad = 28;
    const axisPad = 44;
    if (horizontal) {
      const band = width / n;
      const baselineY = height - flagPad;
      const plotTop = axisPad / 2;
      const plotH = baselineY - plotTop;
      const flagY = height - flagPad / 2;
      return {
        horizontal: true as const,
        band, baselineY, plotTop, plotH, flagY,
        metricAxisX: axisPad / 2,
        gdpAxisX: width - axisPad / 2,
      };
    } else {
      const band = height / n;
      const baselineX = flagPad;
      const plotRight = width - axisPad / 2;
      const plotW = plotRight - baselineX;
      const flagX = flagPad / 2;
      return {
        horizontal: false as const,
        band, baselineX, plotRight, plotW, flagX,
        metricAxisY: axisPad / 2,
        gdpAxisY: height - axisPad / 2,
      };
    }
  });

  // Axis scales: range goes from baseline (0 value) toward the opposite end,
  // so higher values map further from the baseline. For horizontal, higher =
  // smaller y (upward). For vertical, higher = larger x (rightward).
  const metricAxisScale = createMemo(() => {
    const l = layout();
    if (!l) return null;
    const range: [number, number] = l.horizontal ? [l.baselineY, l.plotTop] : [l.baselineX, l.plotRight];
    return scaleLinear().domain([0, globalMaxMetric() || 1]).range(range).nice();
  });
  const gdpAxisScale = createMemo(() => {
    const l = layout();
    if (!l) return null;
    const range: [number, number] = l.horizontal ? [l.baselineY, l.plotTop] : [l.baselineX, l.plotRight];
    return scaleLinear().domain([0, globalMaxGdp || 1]).range(range).nice();
  });

  const flagSize = createMemo(() => {
    const l = layout();
    if (!l) return 12;
    return Math.max(10, Math.min(l.band * 0.7, 22));
  });

  const nodes = createMemo(() => {
    const l = layout();
    const ms = metricAxisScale();
    const gs = gdpAxisScale();
    if (!l || !ms || !gs) return [];
    const fs = flagSize();
    const gap = l.band * 0.08;
    const barW = Math.max(3, (l.band - gap) / 2);
    const agg = metricAgg();
    return sorted().map((d, idx) => {
      const horiz = l.horizontal;
      const along = idx * l.band + l.band / 2;
      const metricVal = agg === "mean" ? d.mean : d.max;
      const gdpColor = Number.isFinite(d.gdp) ? color(d.gdp) : "#999";
      // metric bar on the left/top half of the band, GDP on the right/bottom
      const metricOffset = -barW / 2 - gap / 2;
      const gdpOffset = barW / 2 + gap / 2;

      if (horiz) {
        const metricBarX = along + metricOffset;
        const gdpBarX = along + gdpOffset;
        const metricTopY = Number.isFinite(metricVal) ? ms(metricVal) : l.baselineY;
        const gdpTopY = Number.isFinite(d.gdp) ? gs(d.gdp) : l.baselineY;
        return {
          ...d, horiz, agg, barW, fs,
          flagCx: along, flagCy: l.flagY,
          metricBarX, metricBarY: metricTopY, metricBarW: barW, metricBarH: Math.max(0, l.baselineY - metricTopY),
          gdpBarX, gdpBarY: gdpTopY, gdpBarW: barW, gdpBarH: Math.max(0, l.baselineY - gdpTopY),
          gdpColor,
        };
      } else {
        const metricBarY = along + metricOffset;
        const gdpBarY = along + gdpOffset;
        const metricEndX = Number.isFinite(metricVal) ? ms(metricVal) : l.baselineX;
        const gdpEndX = Number.isFinite(d.gdp) ? gs(d.gdp) : l.baselineX;
        return {
          ...d, horiz, agg, barW, fs,
          flagCx: l.flagX, flagCy: along,
          metricBarX: l.baselineX, metricBarY, metricBarW: Math.max(0, metricEndX - l.baselineX), metricBarH: barW,
          gdpBarX: l.baselineX, gdpBarY, gdpBarW: Math.max(0, gdpEndX - l.baselineX), gdpBarH: barW,
          gdpColor,
        };
      }
    });
  });

  // Render the two d3 axes reactively. They must be rebuilt whenever layout,
  // scales, or metric agg change.
  let metricAxisG: SVGGElement | undefined;
  let gdpAxisG: SVGGElement | undefined;
  createEffect(() => {
    const l = layout();
    const ms = metricAxisScale();
    const gs = gdpAxisScale();
    if (!l || !ms || !gs || !metricAxisG || !gdpAxisG) return;
    const mSel = select(metricAxisG);
    const gSel = select(gdpAxisG);
    mSel.selectAll("*").remove();
    gSel.selectAll("*").remove();
    if (l.horizontal) {
      mSel.call(axisLeft(ms).ticks(4).tickSize(-l.plotH));
      gSel.call(axisRight(gs).ticks(4).tickSize(-l.plotH));
      mSel.attr("transform", `translate(${l.metricAxisX},0)`);
      gSel.attr("transform", `translate(${l.gdpAxisX},0)`);
    } else {
      mSel.call(axisTop(ms).ticks(4).tickSize(-l.plotW));
      gSel.call(axisBottom(gs).ticks(4).tickSize(-l.plotW));
      mSel.attr("transform", `translate(0,${l.metricAxisY})`);
      gSel.attr("transform", `translate(0,${l.gdpAxisY})`);
    }
    for (const sel of [mSel, gSel]) {
      sel.select(".domain").remove();
      sel.selectAll(".tick line").style("stroke", "var(--muted)").style("stroke-opacity", 0.35).style("stroke-width", 0.5);
      sel.selectAll(".tick text").style("font-size", "10px").style("fill", "currentColor").style("fill-opacity", 0.6);
    }
  });

  const metricLabel = createMemo(() =>
    `${METRICS_BY_VALUE[props.metric()]?.label ?? props.metric()} (${metricAgg()})`
  );
  const gdpLabel = "Mean GDP per capita";

  return (
    <div class="w-full h-full flex flex-col" ref={container}>
      <div class="flex justify-end items-center gap-2 px-2 pt-1">
        <button
          type="button"
          class="px-2 py-1 text-[11px] rounded-md border border-black/20 bg-transparent text-foreground hover:bg-black/5 cursor-pointer"
          onClick={() => setMetricAgg(prev => (prev === "mean" ? "max" : "mean"))}
        >
          {metricAgg() === "mean" ? "Show max" : "Show mean"}
        </button>
        <button
          type="button"
          class="px-2 py-1 text-[11px] rounded-md border border-black/20 bg-transparent text-foreground hover:bg-black/5 cursor-pointer"
          onClick={() => setSortBy(prev => (prev === "metric" ? "gdp" : "metric"))}
        >
          {sortBy() === "metric" ? "Sort by GDP per capita" : "Sort by metric"}
        </button>
      </div>
      <div class="flex-1 min-h-0" ref={svgHost}>
        <Show when={nodes().length > 0}>
          <svg width={size().width} height={size().height} class="block">
            {/* axes */}
            <g ref={metricAxisG} />
            <g ref={gdpAxisG} />
            {/* axis labels */}
            <Show when={layout()}>
              {(l) => (
                <>
                  <text
                    x={l().horizontal ? l().metricAxisX : l().baselineX + l().plotW / 2}
                    y={l().horizontal ? l().baselineY + l().plotH / 2 : l().metricAxisY - 10}
                    text-anchor="middle" dominant-baseline="middle"
                    fill="currentColor" fill-opacity={0.7}
                    font-size={11} font-weight={600}
                    transform={l().horizontal ? `rotate(-90 ${l().metricAxisX} ${l().baselineY + l().plotH / 2})` : ""}
                  >{metricLabel()}</text>
                  <text
                    x={l().horizontal ? l().gdpAxisX : l().baselineX + l().plotW / 2}
                    y={l().horizontal ? l().baselineY + l().plotH / 2 : l().gdpAxisY + 18}
                    text-anchor="middle" dominant-baseline="middle"
                    fill="currentColor" fill-opacity={0.7}
                    font-size={11} font-weight={600}
                    transform={l().horizontal ? `rotate(-90 ${l().gdpAxisX} ${l().baselineY + l().plotH / 2})` : ""}
                  >{gdpLabel}</text>
                </>
              )}
            </Show>
            <For each={nodes()}>
              {(n) => {
                return (
                  <g
                    opacity={(() => {
                      const a = activeCountry();
                      return a != null && a !== n.code ? 0.35 : 1;
                    })()}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredCountry(n.code)}
                    onMouseLeave={() => setHoveredCountry(null)}
                    onClick={() => toggleSelectedCountry(n.code)}
                  >
                    {/* metric bar */}
                    <rect
                      x={n.metricBarX} y={n.metricBarY}
                      width={n.metricBarW} height={n.metricBarH}
                      fill="#d62728" fill-opacity={0.8}
                    />
                    {/* GDP bar */}
                    <rect
                      x={n.gdpBarX} y={n.gdpBarY}
                      width={n.gdpBarW} height={n.gdpBarH}
                      fill="#1f77b4" fill-opacity={0.8}
                    />
                    {/* flag */}
                    <text
                      x={n.flagCx} y={n.flagCy}
                      text-anchor="middle" dominant-baseline="central"
                      font-size={n.fs}
                      style={{ "user-select": "none" }}
                    >{n.flag}</text>
                  </g>
                );
              }}
            </For>
          </svg>
        </Show>
      </div>
    </div>
  );
}

function CountriesKey(props: { metric: () => Metric }) {
  const items = rows
    .map((row, i) => ({ code: row.code, name: row.name, flag: row.flag, avg: avgGdpPc[i] }))
    .sort((a, b) => (Number.isFinite(a.avg) ? a.avg : -Infinity) - (Number.isFinite(b.avg) ? b.avg : -Infinity));

  const nCols = Object.keys(disasterAffected.countries).length;

  return (<div style={{ "grid-template-columns": `repeat(${nCols}, minmax(0, 1fr))` } as Record<string, string>} class="grid justify-center h-10 md:h-12 lg:mx-4">
      <For each={items}>
        {({ code, name, flag, avg }) => {
          return (
            <Tooltip
              class="mx-auto odd:justify-start odd:self-start even:justify-end even:self-end"
              position="bottom"
              disabled={!!selectedCountry() && selectedCountry() !== code}
              forceOpen={activeCountry() === code}
              content={<CountryTooltipContent code={code} />}
            >
              <button
                type="button"
                class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] md:text-xs leading-tight text-black font-medium cursor-pointer border border-black/20 hover:opacity-90"
                classList={{ "ring-2 ring-black/60": selectedCountry() === code, "opacity-40": activeCountry() != null && activeCountry() !== code }}
                style={{ background: Number.isFinite(avg) ? color(avg) : "#999" }}
                onClick={() => toggleSelectedCountry(code)}
                onMouseEnter={() => setHoveredCountry(code)}
                onMouseLeave={() => setHoveredCountry(null)}
              >
                <span>{flag}</span>
                <span>{code}</span>
              </button>
            </Tooltip>
          )
        }}
      </For>
    </div>);
}

function CountryTooltipContent(props: { code: string; }) {
  const row = rows.find(r => r.code === props.code)!;
  const idx = rows.indexOf(row);
  const avgGdp = avgGdpPc[idx];
  const sparklineColor = Number.isFinite(avgGdp) ? color(avgGdp) : "#999";

  let avgPopText = "—";
  const popData = populationByCountry[props.code];
  if (popData) {
    const popVals = Object.values(popData).filter(Number.isFinite);
    const avgPop = popVals.length ? popVals.reduce<number>((a, b) => a + b, 0) / popVals.length : 0;
    if (avgPop) avgPopText = Math.round(avgPop).toLocaleString();
  }
  return (
    <div class="text-xs relative min-w-48 sm:max-w-3xs flex flex-col gap-2">
      <div class="flex items-center justify-between gap-3">
        <div class="font-semibold text-base mb-0.5">{row.flag} {row.name}</div>
        <button
          type="button"
          class="text-foreground hover:text-muted cursor-pointer"
          title="Clear selection"
          onClick={() => {
            setHoveredCountry(null);
            setSelectedCountry(null);
          }}
        >
          <XCircle class="size-6" />
        </button>
      </div>
      <div class="font-bold text-lg">{minYear} ― {maxYear}</div>
      <Show when={Number.isFinite(avgGdp)}>
        <div class="flex items-start">
          <div class="w-3/4">Yearly GDP per capita:</div>
          <div>
            <div class="flex-1 text-base font-bold relative">{format("$.2s")(avgGdp)}</div>
            <div class="-mt-1 text-[12px]">(avg)</div>
          </div>
        </div>
      </Show>
      <div>
        {(() => {
          const m = "affected"
          const def = METRICS_BY_VALUE[m];
          let cumulative = Object.values(row.series[m]).filter(Number.isFinite).reduce((a, b) => a + b, 0);
          return <div class="flex items-start">
            <div class="w-3/4">
              {def?.title}:
            </div>
            <div>
              <div class="font-bold text-base">{format('.2s')(cumulative)}</div>
              <div class="-mt-1 text-[12px]">(total)</div>
            </div>
          </div>;
        })()}
      </div>
      <div>
        {(() => {
          const m = "affectedPctPop";
          const def = METRICS_BY_VALUE["affectedPctPop"];
          const series = Object.values(row.series[m]).filter(Number.isFinite);
          const avg = series.reduce((a, b) => a + b, 0) / series.length;
          const max = Math.max(...series);
          return <div class="flex items-start">
            <div class="w-3/4">
              {def?.title}:
            </div>
            <div class="flex flex-col gap-2">
              <div>
                <div class="font-bold text-base">{format('.2~r')(avg * 100)}%</div>
                <div class="-mt-1 text-[12px]">(avg)</div>
              </div>
              <div>
                <div class="font-bold text-base">{format('.2~r')(max * 100)}%</div>
                <div class="-mt-1 text-[12px]">(max)</div>
              </div>
            </div>
          </div>;
        })()}
      </div>
      {/*<svg width={sparklineW} height={sparklineH}>
        {(() => {
          const m = props.metric();
          const [rMin, rMax] = metricRanges[m];
          const sy = scaleLinear().domain([rMin, rMax]).range([sparklineH, 0]);
          const gen = line<[number, number]>()
            .x(d => sx(d[0]))
            .y(d => sy(d[1]))
            .curve(curveMonotoneX);
          const pts: [number, number][] = [];
          for (const yr of years) {
            const v = row.series[m][String(yr)];
            if (v != null && Number.isFinite(v)) pts.push([yr, v]);
          }
          return <path d={gen(pts) ?? ""} fill="none" stroke={sparklineColor} stroke-width="1.5" />;
        })()}
      </svg>*/}
    </div>
  );
}

type CountryRow = {
  code: string;
  name: string;
  flag: string;
  gdpPc: { [year: string]: number };
  series: { [K in Metric]: { [year: string]: number } };
};

type RowData = { year: number } & Record<string, number>;

function nearestValue(series: { [year: string]: number }, year: number): number | undefined {
  const direct = series[String(year)];
  if (direct != null) return direct;
  let best: number | undefined;
  let bestDist = Infinity;
  for (const [yStr, v] of Object.entries(series)) {
    const dist = Math.abs(Number(yStr) - year);
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return best;
}

function buildRows(): CountryRow[] {
  const rows: CountryRow[] = [];
  for (const code of Object.keys(disasterAffected.countries)) {
    const affectedSeries = disasterAffected.countries[code].series;
    const popSeries = populationByCountry[code] ?? {};
    const lossData = disasterLossPctGDP.countries[code];

    const series: CountryRow["series"] = { affected: {}, affectedPctPop: {}, lossPctGDP: {} };
    for (const [year, count] of Object.entries(affectedSeries)) {
      series.affected[year] = count;
      const pop = popSeries[year];
      if (pop != null && pop !== 0) series.affectedPctPop[year] = (count / pop);
    }
    if (lossData) {
      for (const [year, entry] of Object.entries(lossData.by_year)) {
        if (entry.pct_of_gdp != null) series.lossPctGDP[year] = entry.pct_of_gdp;
      }
    }

    rows.push({
      code,
      name: countries[code]?.name ?? code,
      flag: countries[code]?.flag ?? code,
      gdpPc: GDPByCountry[code]?.gdp_pc_usd ?? {},
      series
    });
  }
  return rows;
}

const rows = buildRows();

const years: number[] = [];
for (let yr = minYear; yr <= maxYear; yr++) years.push(yr);

const metricRanges: Record<Metric, [number, number]> = { affected: [Infinity, -Infinity], affectedPctPop: [Infinity, -Infinity], lossPctGDP: [Infinity, -Infinity] };
for (const row of rows) {
  for (const m of ["affected", "affectedPctPop", "lossPctGDP"] as Metric[]) {
    for (const v of Object.values(row.series[m])) {
      if (Number.isFinite(v)) {
        if (v < metricRanges[m][0]) metricRanges[m][0] = v;
        if (v > metricRanges[m][1]) metricRanges[m][1] = v;
      }
    }
  }
}

// Average per capita GDP over the full dataset, used to color each country's area.
const avgGdpPc: number[] = [];
for (const row of rows) {
  const vals = Object.values(row.gdpPc);
  avgGdpPc.push(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN);
}

const color = scaleSequential(
  interpolateBlues
).domain([
  Math.min(...avgGdpPc.filter(Number.isFinite)),
  Math.max(...avgGdpPc.filter(Number.isFinite))
]);

// Wiggle offset centers the stream's baseline to minimize slope changes, but the
// baseline can drift away from zero. This wrapper applies the standard wiggle and
// then shifts each x-column so the stream's vertical midpoint sits exactly at 0.
function stackOffsetWiggleCentered(
  series: Series<RowData, string>[],
  order: number[]
): void {
  stackOffsetWiggle(series, order);
  if (!series.length) return;
  const m = series[0].length;
  for (let i = 0; i < m; ++i) {
    let top = -Infinity;
    let bottom = Infinity;
    for (const s of series) {
      top = Math.max(top, s[i][1]);
      bottom = Math.min(bottom, s[i][0]);
    }
    const shift = -(top + bottom) / 2;
    for (const s of series) {
      s[i][0] += shift;
      s[i][1] += shift;
    }
  }
}

function DisasterImpactChart(container: HTMLElement) {
  const root = select(container);

  let svg: Selection<SVGSVGElement, unknown, null, undefined>;
  let plot: Selection<SVGGElement, unknown, null, undefined>;
  let xAxisG: Selection<SVGGElement, unknown, null, undefined>;
  let yAxisG: Selection<SVGGElement, unknown, null, undefined>;
  let gdpLegendG: Selection<SVGGElement, unknown, null, undefined>;
  let x: ScaleLinear<number, number>;
  let y: ScaleLinear<number, number>;
  let areaPaths: Selection<SVGPathElement, unknown, null, undefined>[] = [];
  let initialized = false;

  function init() {
    const { clientWidth: width, clientHeight: height } = container;
    const margin = { top: 30, right: 20, bottom: 16, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    root.selectAll("*").remove();

    root.transition("streamgraph-update").duration(400);

    svg = root.append("svg").attr("width", width).attr("height", height);
    plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const yScalePadding = 10;
    x = scaleLinear().domain([minYear, maxYear]).range([0, innerWidth]);
    y = scaleLinear().range([innerHeight - yScalePadding/2, yScalePadding/2]);

    xAxisG = plot.append("g");
    yAxisG = plot.append("g");

    const legendGradientId = "gdp-legend-gradient";
    const legendWidth = Math.max(innerWidth/10, 100);
    const legendBarHeight = 16;
    const legendMin = Math.min(...avgGdpPc.filter(Number.isFinite));
    const legendMax = Math.max(...avgGdpPc.filter(Number.isFinite));

    gdpLegendG = plot.append("g").attr("transform", `translate(${innerWidth/2 - legendWidth/2},${innerHeight - legendBarHeight - 10})`);

    gdpLegendG
      .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("dy", "1em")
      .attr("fill", "currentColor")
      .attr("opacity", 0.8)
      .style("font-size", "10px")
      .text("GDP per capita");

    const legendGradient = gdpLegendG
      .append("defs")
      .append("linearGradient")
      .attr("id", legendGradientId)
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    const nStops = 20;
    for (let i = 0; i <= nStops; i++) {
      const t = i / nStops;
      legendGradient
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", color(legendMin + (legendMax - legendMin) * t));
    }

    gdpLegendG
      .append("rect")
      .attr("x", 0)
      .attr("y", 14)
      .attr("width", legendWidth)
      .attr("height", legendBarHeight)
      .attr("fill", `url(#${legendGradientId})`)
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.15)
      .attr("stroke-width", 0.5);

    gdpLegendG
      .append("text")
      .attr("dy", "4em")
      .attr("fill", "currentColor")
      .attr("opacity", 0.8)
      .style("font-size", "10px")
      .text("Lo")

    gdpLegendG
      .append("text")
      .attr("dy", "4em")
      .attr("dx", legendWidth)
      .attr("x", "-1em")
      .attr("fill", "currentColor")
      .attr("opacity", 0.8)
      .style("font-size", "10px")
      .text("Hi");

    initialized = true;
  }

  function update(metric: Metric) {
    const data: RowData[] = years.map(yr => {
      const d: RowData = { year: yr };
      rows.forEach((r, i) => {
        d[String(i)] = r.series[metric][String(yr)] ?? 0;
      });
      return d;
    });

    const stackGen = stack<RowData>().keys(rows.map((_, i) => String(i))).offset(stackOffsetWiggleCentered);
    const series = stackGen(data);

    let maxAbs = 0;
    for (const s of series) {
      for (const p of s) {
        maxAbs = Math.max(maxAbs, Math.abs(p[0]), Math.abs(p[1]));
      }
    }

    // y-axis
    y.domain([-maxAbs, maxAbs]);

    // yAxisG.call(axisLeft(y).ticks(5));
    // yAxisG.select(".domain").remove();

    // x-axis
    const gridTicks = years.filter(yr => yr % 5 === 0);
    xAxisG
      .call(
        axisTop(x)
          .tickValues(gridTicks)
          .tickFormat(d => String(Number(d)))
          .tickSize(-innerHeight)
    );
    xAxisG.select(".domain").remove();
    xAxisG
      .selectAll(".tick line")
      .style("stroke", "var(--muted)")
      .style("stroke-width", 0.5)
      .style("stroke-opacity", 0.5);


    xAxisG
      .selectAll(".tick text")
      .attr("color", "var(--muted)")
      .attr("font-size", "1.2em")

    const areaGen = area<SeriesPoint<RowData>>()
      .x(d => x((d.data as RowData).year))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(curveBumpX);

    while (areaPaths.length < series.length) {
      areaPaths.push(
        plot.append("path")
      );
    }

    areaPaths.forEach((path, i) => {
      const avg = avgGdpPc[i];
      const fill = Number.isFinite(avg) ? color(avg) : "#999";
      const code = rows[i].code;
      const active = activeCountry();
      const dimmed = active != null && active !== code;
      path
        .datum(series[i])
        .attr("fill", fill)
        .attr("fill-opacity", dimmed ? 0.1 : 0.85)
        .attr("stroke", active === code ? fill : "none")
        .attr("stroke-width", 1)
        .attr("cursor", "pointer")
        .style("pointer-events", "all")
        .on("mouseenter", () => {
          if (selectedCountry()) return;
          setHoveredCountry(code)
        })
        .on("mouseleave", () => {
          if (selectedCountry()) return;
          setHoveredCountry(null)
        })
        .on("click", () => toggleSelectedCountry(code))
        .transition("streamgraph-update")
        .attr("d", areaGen)
    });
  }

  function render(metric: Metric) {
    if (!initialized) init();
    update(metric);
  }

  return { render };
}
