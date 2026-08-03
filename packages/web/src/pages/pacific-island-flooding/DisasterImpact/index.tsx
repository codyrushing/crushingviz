import { createEffect, createSignal, For } from "solid-js";
import { select } from "d3-selection";
import { scaleLinear, scaleSequential } from "d3-scale";
import { interpolateRdYlBu } from "d3-scale-chromatic";
import { line } from "d3-shape";
import { axisBottom, axisLeft } from "d3-axis";
import * as d3Array from "d3-array"
import { useElementVisibility } from "../../../hooks/useElementVisibility";
import { countries, GDPByCountry, disasterAffected, populationByCountry, disasterLossPctGDP } from "../data";
import type { GDPData } from "../data";
import { Tooltip } from "../../../components/Tooltip";
import { ButtonGroup } from "../../../components/ButtonGroup";
import { Range } from "../../../components/Range";

type Metric = "affected" | "affectedPctPop" | "lossPctGDP";

const METRICS: { value: Metric; label: string; title?: string }[] = [
  { value: "affected", label: "Affected", title: "Number of directly affected persons" },
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
    <div class="h-screen flex font-monospace" ref={ref}>
      <div class="flex flex-col flex-1 min-w-0">
        <div class="flex w-full gap-2">
          <ButtonGroup
            value={metric()}
            onChange={setMetric}
            options={METRICS}
          />
          <div class="flex-1">
            <DateRangeSlider />
          </div>
        </div>
        <div class="chart-container flex-1" ref={chartContainer}></div>
      </div>
      <CountriesKey />
    </div>
  );
}

export function DateRangeSlider() {
  return <div class="flex gap-1 items-center">
    <input class="text-lg bg-surface p-1 rounded-sm appearance-none" value={selectedYear()} type="number" min={minYear} max={maxYear} step={1} onInput={e => setSelectedYear(Number(e.currentTarget?.value))} />
    <Range class="grow" value={selectedYear()} min={minYear} max={maxYear} step={1} onChange={value => setSelectedYear(value)} />
  </div>
}

function CountriesKey() {
  const valueAccessor = ({ gdp }: {gdp: GDPData}) => gdp.latest_gdp_pc_usd.value!;
  const data = Object.entries(GDPByCountry)
    .map(
      ([countryCode, gdp]) => ({
        country: {
          code: countryCode,
          ...countries[countryCode]
        },
        gdp
      })
    )
    .sort(
      (a, b) => valueAccessor(a) - valueAccessor(b)
    );

  const colorScale = scaleSequential()
    .domain([
      valueAccessor(data[0]!), valueAccessor(data.at(-1)!)
    ])
    .interpolator(interpolateRdYlBu);

  return <div class="flex">
    <div class="flex flex-col items-center">
      <div class="flex flex-1 flex-col items-center">
        <For each={data}>{
          (d) => {
            const color = colorScale(valueAccessor(d));
            return <div class="flex-1 flex py-0.5">
              <Tooltip content={d.country.name} position="left">
                <div
                  style={{ "background-color": `color-mix(in srgb, ${color} 100%, #FFFFFF)` }}
                  class={`aspect-square rounded-full flex items-center justify-center cursor-pointer hover:bg-[${color}]`}
                >
                  <div class="text-center w-full">{d.country.flag}</div>
                </div>
              </Tooltip>
            </div>
          }
        }</For>
      </div>
    </div>
    <ColorLegend />
  </div>
}

function ColorLegend() {
  const stops = 8;
  const gradient = `linear-gradient(to right, ${Array.from(
    { length: stops + 1 },
    (_, i) => interpolateRdYlBu(i / stops)
  ).join(", ")})`;

  return (
    <div class="flex items-center justify-center overflow-visible" style={{ width: "5rem" }}>
      <div class="rotate-90 origin-center flex flex-col items-center gap-1">
        <span class="text-xs whitespace-nowrap">Per-capita GDP</span>
        <div class="flex gap-1 items-center">
          <span class="text-xs rotate-270">low</span>
          <div class="w-32 h-1.5" style={{ background: gradient }} />
          <span class="text-xs rotate-270">high</span>
        </div>
      </div>
    </div>
  );
}

type SeriesPoint = {
  year: number,
  count: number
};

function seriesForMetric(code: string, metric: Metric): SeriesPoint[] {
  switch (metric) {
    case "affected": {
      const data = disasterAffected.countries[code];
      return Object.entries(data.series).map(([year, count]) => ({
        year: Number(year),
        count
      }));
    }
    case "affectedPctPop": {
      const data = disasterAffected.countries[code];
      const popByYear = populationByCountry[code];
      return Object.entries(data.series).flatMap(([year, count]) => {
        const pop = popByYear?.[year];
        if (pop == null || pop === 0) return [];
        return [{ year: Number(year), count: (count / pop) * 100 }];
      });
    }
    case "lossPctGDP": {
      const data = disasterLossPctGDP.countries[code];
      if (!data) return [];
      return Object.entries(data.by_year).flatMap(([year, entry]) => {
        if (entry.pct_of_gdp == null) return [];
        return [{ year: Number(year), count: entry.pct_of_gdp }];
      });
    }
  }
}

function DisasterImpactChart(container: HTMLElement) {
  const root = select(container);

  function consecutiveSegments(points: SeriesPoint[]): SeriesPoint[][] {
    const segments: SeriesPoint[][] = [];
    let current: SeriesPoint[] = [];
    for (const point of points) {
      const prev = current[current.length - 1];
      if (prev && point.year !== prev.year + 1) {
        segments.push(current);
        current = [];
      }
      current.push(point);
    }
    if (current.length > 0) segments.push(current);
    return segments;
  }

  function init() {

  }

  function render(metric: Metric) {
    const { clientWidth: width, clientHeight: height } = container;
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    root.selectAll("*").remove();

    const svg = root
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const plot = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const seriesByCountry = Object.entries(disasterAffected.countries).map(
      ([code]) => ({
        code,
        points: seriesForMetric(code, metric).sort((a, b) => a.year - b.year)
      })
    );

    const allPoints = seriesByCountry.flatMap((s) => s.points);
    const [minYear, maxYear] = d3Array.extent(allPoints, (p) => p.year) as [number, number];
    const maxCount = d3Array.max(allPoints, (p) => p.count) ?? 0;

    const x = scaleLinear().domain([minYear, maxYear]).range([0, innerWidth]);
    const y = scaleLinear().domain([0, maxCount]).range([innerHeight, 0]);

    const lineGenerator = line<SeriesPoint>()
      .x((d) => x(d.year))
      .y((d) => y(d.count));

    plot.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(axisBottom(x).ticks(Math.max(2, Math.min(20, Math.floor(innerWidth / 60)))));

    plot.append("g")
      .call(axisLeft(y).ticks(5));

    for (const { points } of seriesByCountry) {
      for (const segment of consecutiveSegments(points)) {
        if (segment.length < 2) continue;
        plot.append("path")
          .datum(segment)
          .attr("fill", "none")
          .attr("stroke", "steelblue")
          .attr("stroke-width", 1.5)
          .attr("stroke-opacity", 0.7)
          .attr("d", lineGenerator(segment));
      }
      for (const point of points) {
        plot.append("circle")
          .attr("cx", x(point.year))
          .attr("cy", y(point.count))
          .attr("r", 2.5)
          .attr("fill", "steelblue")
          .attr("fill-opacity", 0.8);
      }
    }
  }

  return {
    init,
    render
  }
}
