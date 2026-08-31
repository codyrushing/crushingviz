import { createEffect, createMemo, createSignal, For, Show, onCleanup } from "solid-js";
import { select, type Selection } from "d3-selection";
import "d3-transition";
import { scaleLinear, scaleSequential, type ScaleLinear } from "d3-scale";
import { interpolateBlues, interpolateRdYlGn, schemeBlues, schemeGreens, schemePurples } from "d3-scale-chromatic";
import { axisBottom, axisLeft, axisRight, axisTop } from "d3-axis";
import { area, curveBumpX, curveMonotoneX, line, stack, stackOffsetWiggle, type Series, type SeriesPoint } from "d3-shape";
import { useElementVisibility } from "../../../hooks/useElementVisibility";
import { useScreenSize } from "../../../hooks/useScreenSize";
import { countries, GDPByCountry, disasterAffected, populationByCountry, disasterLossPctGDP } from "../data";
import { Tooltip } from "../../../components/Tooltip";
import { ButtonGroup, type ButtonGroupOption } from "../../../components/ButtonGroup";
import { XIcon } from "../../../icons/XIcon";
import { format } from "d3-format";
import { interpolateRgb } from "d3-interpolate";
import { CountryBars } from "./CountryBars";
import {
  activeCountry,
  GDP_LABEL,
  hoveredCountry,
  maxYear,
  minYear,
  selectedCountry,
  selectedYear,
  setHoveredCountry,
  setSelectedCountry,
  setSelectedYear,
  toggleSelectedCountry,
} from "./shared";
import { DisasterImpactSourcesModal } from "./DisasterImpactSourcesModal";

export { activeCountry, GDP_LABEL, hoveredCountry, maxYear, minYear, selectedCountry, selectedYear, setHoveredCountry, setSelectedCountry, setSelectedYear, toggleSelectedCountry };

export type Metric = "affected" | "affectedPctPop";

const METRICS: ButtonGroupOption<Metric>[] = [
  { value: "affectedPctPop", label: "% of population", title: "Affected persons as a share of population" },
  { value: "affected", label: "Num affected", title: "Number of directly affected persons" },
];

export const METRICS_BY_VALUE: Partial<Record<Metric, (typeof METRICS)[number]>> = {};
for (const m of METRICS) {
  METRICS_BY_VALUE[m.value] = m;
}

export function DisasterImpact() {
  const { isVisible, intersectionRatio, hiddenAbove, hiddenBelow, ref } =
    useElementVisibility();
  const { size, ref: sizeRef } = useScreenSize();
  let chartContainer!: HTMLDivElement;
  let chart: ReturnType<typeof DisasterImpactStreamGraph> | undefined;
  const [metric, setMetric] = createSignal<Metric>("affectedPctPop");


  createEffect(
    () => {
      size(); // re-render on (debounced) container resize
      chart = chart ?? DisasterImpactStreamGraph(chartContainer);
      chart.render(metric());
    }
  );

  createEffect(
    () => {
      activeCountry();
      chart?.highlight();
    }
  );

  return (
    <div class="h-screen min-h-128 py-8 flex flex-col font-monospace gap-1" ref={ref}>
      <h2 class="unstyled text-xl sm:text-2xl font-serif font-bold text-center">Disaster Impact and GDP</h2>
      <div class="flex flex-col flex-1 gap-6 min-w-0">
        <div class="flex flex-col relative flex-1">
          <Show when={activeCountry()} keyed>
            {(code) => (
              <div class="z-1 w-56 sm:w-sm absolute bottom-2 left-4 bg-white/90 dark:bg-black/80 backdrop-blur-sm rounded-lg shadow-lg border border-black/10 p-2">
                <CountryTooltipContent code={code} />
              </div>
            )}
          </Show>

          <div class="max-w-sm mx-auto sticky top-16 z-2">
            <ButtonGroup
              value={metric()}
              onChange={setMetric}
              options={METRICS}
            />
          </div>
          <div class="chart-container flex-1" ref={(el) => { sizeRef(el); chartContainer = el; }}></div>
        </div>
        <div class="countries flex-1"><CountryBars metric={metric} /></div>
      </div>
      <DisasterImpactSourcesModal />
    </div>
  );
}

function CountryTooltipContent(props: { code: string; }) {
  const row = rows.find(r => r.code === props.code)!;
  const idx = rows.indexOf(row);
  const avgGdp = avgGdpPc[idx];
  const affectedVals = Object.values(row.series.affected).filter(Number.isFinite);
  const affectedTotal = affectedVals.reduce((a, b) => a + b, 0);
  const pctEntriesSorted = Object.entries(row.series.affectedPctPop).filter(([_, v]) => Number.isFinite(v)).sort((a, b) => b[1] - a[1]);
  const pctAvg = pctEntriesSorted.length ? pctEntriesSorted.reduce((acc, v) => acc + v[1], 0) / pctEntriesSorted.length : NaN;
  const [pctMaxYear, pctMax] = pctEntriesSorted[0]

  return (
    <div class="text-xs flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-3">
        <div class="font-semibold text-base leading-tight">
          {row.flag} {row.name}
          <div class="text-[11px] opacity-70">{minYear} ― {maxYear}</div>
        </div>
        <button
          type="button"
          class="absolute p-1 top-0 right-0 text-foreground pointer-events-auto hover:text-muted cursor-pointer shrink-0"
          title="Clear selection"
          onClick={() => {
            setHoveredCountry(null);
            setSelectedCountry(null);
          }}
        >
          <XIcon class="size-4" />
        </button>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Show when={Number.isFinite(avgGdp)}>
          <div class="flex flex-col gap-0.5">
            <div class="text-lg font-bold leading-none">{format("$.2s")(avgGdp)}</div>
            <div class="text-[10px] opacity-70 leading-tight">GDP per capita (avg)</div>
          </div>
        </Show>
        <div class="flex flex-col gap-0.5">
          <div class="text-lg font-bold leading-none">{format('.2s')(affectedTotal)}</div>
          <div class="text-[10px] opacity-70 leading-tight">{METRICS_BY_VALUE.affected?.title} (total)</div>
        </div>
        <div class="flex flex-col gap-0.5">
          <div class="text-lg font-bold leading-none">{format('.2~r')(pctAvg * 100)}%</div>
          <div class="text-[10px] opacity-70 leading-tight">{METRICS_BY_VALUE.affectedPctPop?.title} (avg)</div>
        </div>
        <div class="flex flex-col gap-0.5">
          <div class="text-lg font-bold leading-none">{format('.2~r')(pctMax * 100)}%</div>
          <div class="text-[10px] opacity-70 leading-tight">{METRICS_BY_VALUE.affectedPctPop?.title} (max) ({pctMaxYear})</div>
        </div>
      </div>
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

function buildRows(): CountryRow[] {
  const rows: CountryRow[] = [];
  for (const code of Object.keys(disasterAffected.countries)) {
    const affectedSeries = disasterAffected.countries[code].series;
    const popSeries = populationByCountry[code] ?? {};

    const series: CountryRow["series"] = { affected: {}, affectedPctPop: {} };
    for (const [year, count] of Object.entries(affectedSeries)) {
      if (Number(year) > 2025) continue;
      series.affected[year] = count;
      const pop = popSeries[year];
      if (pop != null && pop !== 0) series.affectedPctPop[year] = (count / pop);
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

export const rows = buildRows();

const years: number[] = [];
for (let yr = minYear; yr <= maxYear; yr++) years.push(yr);

const metricRanges: Record<Metric, [number, number]> = { affected: [Infinity, -Infinity], affectedPctPop: [Infinity, -Infinity] };
for (const row of rows) {
  for (const m of ["affected", "affectedPctPop"] as Metric[]) {
    for (const v of Object.values(row.series[m])) {
      if (Number.isFinite(v)) {
        if (v < metricRanges[m][0]) metricRanges[m][0] = v;
        if (v > metricRanges[m][1]) metricRanges[m][1] = v;
      }
    }
  }
}

// Average per capita GDP over the full dataset, used to color each country's area.
export const avgGdpPc: number[] = [];
for (const row of rows) {
  const vals = Object.values(row.gdpPc);
  avgGdpPc.push(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN);
}

export const color = scaleSequential(
  interpolateRgb(schemePurples[9][3], schemePurples[9][8])
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

function DisasterImpactStreamGraph(container: HTMLElement) {
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
    root.selectAll("*").remove();

    svg = root.append("svg");
    plot = svg.append("g");
    xAxisG = plot.append("g");
    yAxisG = plot.append("g");
    gdpLegendG = plot.append("g");
    areaPaths = [];

    initialized = true;
  }

  // Rebuilt on every render because the bar width depends on innerWidth.
  function renderLegend(innerWidth: number) {
    const legendGradientId = "gdp-legend-gradient";
    const legendWidth = Math.max(innerWidth/10, 100);
    const legendBarHeight = 16;
    const legendMin = Math.min(...avgGdpPc.filter(Number.isFinite));
    const legendMax = Math.max(...avgGdpPc.filter(Number.isFinite));

    gdpLegendG.attr("transform", `translate(10,10)`).selectAll("*").remove();

    gdpLegendG
      .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("dy", "1em")
      .attr("fill", "currentColor")
      .attr("opacity", 0.8)
      .style("font-size", "10px")
      .text(GDP_LABEL);

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
  }

  function update(metric: Metric, innerHeight: number) {
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
      .interrupt()
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
      path
        .datum(series[i])
        .attr("fill", fill)
        .attr("fill-opacity", 0.85)
        .attr("stroke", "none")
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

  function highlight() {
    if (!initialized) return;
    const active = activeCountry();
    areaPaths.forEach((path, i) => {
      const code = rows[i].code;
      const avg = avgGdpPc[i];
      const fill = Number.isFinite(avg) ? color(avg) : "#999";
      const dimmed = active != null && active !== code;
      path
        .attr("fill-opacity", dimmed ? 0.1 : 0.85)
        .attr("stroke", active === code ? fill : "none");
    });
  }

  function render(metric: Metric) {
    if (!initialized) init();
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;

    const margin = { top: 30, right: 20, bottom: 16, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);
    plot.attr("transform", `translate(${margin.left},${margin.top})`);

    const yScalePadding = 10;
    x = scaleLinear().domain([minYear, maxYear]).range([0, innerWidth]);
    y = scaleLinear().range([innerHeight - yScalePadding/2, yScalePadding/2]);

    renderLegend(innerWidth);
    update(metric, innerHeight);
  }

  return { render, highlight };
}
