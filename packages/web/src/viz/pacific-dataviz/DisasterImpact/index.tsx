import { createEffect, createSignal, For } from "solid-js";
import { select, type Selection } from "d3-selection";
import "d3-transition";
import { scaleLinear, scaleSequential, type ScaleLinear, type ScaleSequential } from "d3-scale";
import { interpolateRdYlGn } from "d3-scale-chromatic";
import { axisBottom, axisLeft } from "d3-axis";
import { area, curveBumpX, stack, stackOffsetWiggle, type Series, type SeriesPoint } from "d3-shape";
import { useElementVisibility } from "../../../hooks/useElementVisibility";
import { countries, GDPByCountry, disasterAffected, populationByCountry, disasterLossPctGDP } from "../data";
import type { GDPData } from "../data";
import { Tooltip } from "../../../components/Tooltip";
import { ButtonGroup } from "../../../components/ButtonGroup";
import { Range } from "../../../components/Range";

type Metric = "affected" | "affectedPctPop" | "lossPctGDP";

const GDP_BIN_SIZE = 10000;

const METRICS: { value: Metric; label: string; title?: string }[] = [
  { value: "affected", label: "Num affected", title: "Number of directly affected persons" },
  { value: "affectedPctPop", label: "% of population", title: "Affected persons as a share of population" },
  { value: "lossPctGDP", label: "Loss % of GDP", title: "Direct economic loss as a share of GDP" }
];

const minYear = Math.min(disasterAffected.year_span[0], disasterLossPctGDP.year_span[0]);
const maxYear = Math.max(disasterAffected.year_span[1], disasterLossPctGDP.year_span[1]);
export const [selectedYear, setSelectedYear] = createSignal<number>(minYear);

export function DisasterImpact() {
  const { isVisible, intersectionRatio, hiddenAbove, hiddenBelow, ref } =
    useElementVisibility();
  let chartContainer!: HTMLDivElement;
  let chart: ReturnType<typeof DisasterImpactChart> | undefined;
  const [metric, setMetric] = createSignal<Metric>("affected");


  createEffect(
    () => {
      chart = chart ?? DisasterImpactChart(chartContainer);


      chart.render(metric());
    }
  );

  return (
    <div class="h-screen flex font-monospace gap-1" ref={ref}>
      <div class="flex flex-col flex-1 min-w-0">
        <div class="flex flex-col w-full gap-2">
          <div class="max-w-sm mx-auto">
            <ButtonGroup
              value={metric()}
              onChange={setMetric}
              options={METRICS}
            />
          </div>
          <GDPLegend />
        </div>
        <div class="chart-container flex-1" ref={chartContainer}></div>
      </div>
      <CountriesSmallMultiples />
    </div>
  );
}

export function GDPLegend() {
  const rows = buildRows();
  const avgGdpPc = rows.map(row => {
    const vals = Object.values(row.gdpPc);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
  });
  const finite = avgGdpPc.filter(Number.isFinite);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const color = scaleSequential(interpolateRdYlGn).domain([min, max]);

  const width = 240;
  const barHeight = 16;
  const gradientId = "gdp-legend-gradient";
  const nStops = 20;
  const gradientStops = Array.from({ length: nStops + 1 }, (_, i) => {
    const value = min + (max - min) * (i / nStops);
    return { offset: `${(i / nStops) * 100}%`, color: color(value) };
  });

  return (
    <div class="flex flex-col items-start font-monospace">
      <span class="text-[10px] leading-tight opacity-80">GDP per capita</span>
      <svg width={width} height={barHeight}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <For each={gradientStops}>
              {stop => <stop offset={stop.offset} stop-color={stop.color} />}
            </For>
          </linearGradient>
        </defs>
        <rect
          x={0}
          y={0}
          width={width}
          height={barHeight}
          fill={`url(#${gradientId})`}
          stroke="currentColor"
          stroke-opacity={0.15}
          stroke-width={0.5}
        />
      </svg>
    </div>
  );
}

export function DateRangeSlider() {
  return <div class="flex gap-1 items-center">
    <input class="text-lg bg-surface p-1 rounded-sm appearance-none" value={selectedYear()} type="number" min={minYear} max={maxYear} step={1} onInput={e => setSelectedYear(Number(e.currentTarget?.value))} />
    <Range class="grow" value={selectedYear()} min={minYear} max={maxYear} step={1} onChange={value => setSelectedYear(value)} />
  </div>
}

function CountriesSmallMultiples() {
  return <></>
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
      if (pop != null && pop !== 0) series.affectedPctPop[year] = (count / pop) * 100;
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
  const rows = buildRows();

  // Average per capita GDP over the full dataset, used to color each country's area.
  const avgGdpPc: number[] = [];
  for (const row of rows) {
    const vals = Object.values(row.gdpPc);
    avgGdpPc.push(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN);
  }

  let svg: Selection<SVGSVGElement, unknown, null, undefined>;
  let plot: Selection<SVGGElement, unknown, null, undefined>;
  let xAxisG: Selection<SVGGElement, unknown, null, undefined>;
  let yAxisG: Selection<SVGGElement, unknown, null, undefined>;
  let x: ScaleLinear<number, number>;
  let y: ScaleLinear<number, number>;
  let color: ScaleSequential<string>;
  let areaPaths: Selection<SVGPathElement, unknown, null, undefined>[] = [];
  let initialized = false;

  const years: number[] = [];
  for (let yr = minYear; yr <= maxYear; yr++) years.push(yr);

  function init() {
    const { clientWidth: width, clientHeight: height } = container;
    const margin = { top: 30, right: 20, bottom: 40, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    root.selectAll("*").remove();

    root.transition("streamgraph-update").duration(400);

    svg = root.append("svg").attr("width", width).attr("height", height);
    plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    x = scaleLinear().domain([minYear, maxYear]).range([0, innerWidth]);
    y = scaleLinear().range([innerHeight, 0]);

    const finite = avgGdpPc.filter(v => Number.isFinite(v));
    color = scaleSequential(interpolateRdYlGn).domain([
      Math.min(...finite),
      Math.max(...finite)
    ]);
    xAxisG = plot.append("g");

    yAxisG = plot.append("g")

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
    yAxisG.call(axisLeft(y).ticks(5));
    yAxisG.select(".domain").remove();

    yAxisG.call(axisLeft(y).ticks(5));
    yAxisG.select(".domain").remove();

    // x-axis
    const gridTicks = years.filter(yr => yr % 5 === 0);
    xAxisG
      .call(
        axisBottom(x)
          .tickValues(gridTicks)
          .tickFormat(d => String(Number(d)))
          .tickSizeOuter(-50)
          .tickSize(innerHeight)
    );
    xAxisG.select(".domain").remove();
    xAxisG
      .selectAll(".tick line")
      .style("stroke", "var(--muted)")
      .style("stroke-width", 0.5)
      .style("stroke-opacity", 0.5);


    xAxisG
      .selectAll(".tick text")
      .attr("y", 0)
      .attr("dy", "-1em")
      .attr("x", 0)
      .attr("dx", "0em")
      .attr("color", "var(--muted)")

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
      path
        .datum(series[i])
        .attr("fill", fill)
        .attr("fill-opacity", 0.85)
        .attr("stroke", fill)
        .attr("stroke-opacity", 1)
        .attr("stroke-width", 1)
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
