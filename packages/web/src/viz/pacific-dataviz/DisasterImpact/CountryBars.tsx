import { createEffect, createSignal } from "solid-js";
import { select, type Selection } from "d3-selection";
import "d3-transition";
import { scaleBand, scaleLinear } from "d3-scale";
import { axisLeft, axisTop } from "d3-axis";
import { useScreenSize } from "../../../hooks/useScreenSize";
import {
  activeCountry,
  setHoveredCountry,
  toggleSelectedCountry,
} from "./shared";
import {
  avgGdpPc,
  type Metric,
  METRICS_BY_VALUE,
  rows,
} from "./index";
import { ButtonGroup, type ButtonGroupOption } from "../../../components/ButtonGroup";
import { format } from "d3-format";
import { Dynamic } from "solid-js/web";
import { schemeBlues, schemeGreens, schemeOranges, schemePurples, schemeReds } from "d3-scale-chromatic";

type SortKey = "metric" | "gdp";
type Agg = "mean" | "max";

type CountryStat = {
  code: string;
  name: string;
  flag: string;
  mean: number;
  max: number;
  gdp: number;
};

const METRIC_AGGS: ButtonGroupOption<Agg>[] = [
  { value: "mean", label: "Mean", title: "Avg affected per year" },
  { value: "max", label: "Max", title: "Max yearly affected" },
];

const SORT_OPTIONS: ButtonGroupOption<SortKey>[] = [
  { value: "metric", label: "Disaster impact", title: "Disaster impact" },
  { value: "gdp", label: "GDP", title: "GDP per capita" },
]

function computeStats(metric: Metric): CountryStat[] {
  return rows.map((row, i) => {
    const vals = Object.values(row.series[metric]).filter(Number.isFinite);
    const mean = vals.length ? vals.reduce<number>((a, b) => a + b, 0) / vals.length : NaN;
    const max = vals.length ? Math.max(...vals) : NaN;
    return { code: row.code, name: row.name, flag: row.flag, mean, max, gdp: avgGdpPc[i] };
  });
}

const formattersByMetric: Record<Metric, ReturnType<typeof format>> = {
  "affected": format('.2s'),
  "affectedPctPop": format('.0%')
}

function sortStats(stats: CountryStat[], { sortBy, agg }: { sortBy: SortKey, agg: Agg }): CountryStat[] {
  const getMetricValue = (stat: CountryStat) => agg === "mean" ? stat.mean : stat.max;
  return [...stats].sort((a, b) => {
    const av = sortBy === "metric" ? getMetricValue(a) : a.gdp;
    const bv = sortBy === "metric" ? getMetricValue(b) : b.gdp;
    return (Number.isFinite(av) ? av : Infinity) - (Number.isFinite(bv) ? bv : Infinity);
  });
}

const METRIC_COLOR = schemeOranges[9][5];
const GDP_COLOR = schemePurples[9][5];

function Legend(props: { metric: () => Metric; agg: () => Agg }) {
  const metricLabel = () => `${METRICS_BY_VALUE[props.metric()]?.title ?? METRICS_BY_VALUE[props.metric()]?.label ?? props.metric()} (per-year ${props.agg()})`;
  return (
    <div class="flex flex-col sm:flex-row justify-center place-self-center gap-2 sm:gap-4 text-[11px]">
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-2.5 h-2.5 shrink-0" style={{ background: GDP_COLOR }} />
        GDP per capita
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-2.5 h-2.5 shrink-0" style={{ background: METRIC_COLOR }} />
        {metricLabel()}
      </span>
    </div>
  );
}

export function CountryBars(props: { metric: () => Metric }) {
  const [sortBy, setSortBy] = createSignal<SortKey>("metric");
  const [metricAgg, setMetricAgg] = createSignal<Agg>("mean");

  let svgHost!: HTMLDivElement;
  const { size, ref } = useScreenSize();

  let chart: ReturnType<typeof CountryBarsChart> | undefined;

  createEffect(() => {
    // activate the useScreenSize
    size();
    chart = chart ?? CountryBarsChart(svgHost);
    chart.update({
      metric: props.metric(),
      sortBy: sortBy(),
      metricAgg: metricAgg(),
    });
  });

  createEffect(() => {
    activeCountry();
    chart?.highlight();
  });


  return (
    <div class="w-full h-full flex flex-col">
      <div class="flex gap-2 flex-col mt-4 z-1">
        <Legend metric={props.metric} agg={metricAgg} />
        <div class="flex flex-row justify-center">
          <div>
            <ButtonGroup
              size="sm"
              value={metricAgg()}
              onChange={setMetricAgg}
              options={METRIC_AGGS}
            />
          </div>
        </div>
      </div>
      <div class="flex-1 min-h-0" ref={(el: HTMLDivElement) => { svgHost = el; ref(el); }} />
      <div class="flex flex-row mt-2">
        <div class="mx-auto">
          <label class="text-[12px] block text-center">Sort countries by</label>
          <ButtonGroup
            size="sm"
            value={sortBy()}
            onChange={setSortBy}
            options={SORT_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
}

type UpdateOpts = {
  metric: Metric;
  sortBy: SortKey;
  metricAgg: Agg;
};

function CountryBarsChart(container: HTMLElement) {
  const root = select(container);

  let svg: Selection<SVGSVGElement, unknown, null, undefined>;
  let plotG: Selection<SVGGElement, unknown, null, undefined>;
  let metricAxisG: Selection<SVGGElement, unknown, null, undefined>;
  let metricLabelG: Selection<SVGTextElement, unknown, null, undefined>;
  let barsG: Selection<SVGGElement, unknown, null, undefined>;
  let initialized = false;

  const globalMaxGdp = Math.max(...avgGdpPc.filter(Number.isFinite), 0);

  function init() {
    root.selectAll("*").remove();
    svg = root.append("svg").style("display", "block");
    plotG = svg.append("g");
    metricAxisG = plotG.append("g");
    metricLabelG = plotG.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "currentColor")
      .attr("fill-opacity", 0.7)
      .style("font-size", "11px")
      .style("font-weight", "600");
    barsG = plotG.append("g");
    initialized = true;
  }

  function update(opts: UpdateOpts) {
    const { metric, sortBy: sortByKey, metricAgg: agg } = opts;

    // Read container dimensions dynamically, like DisasterImpactChart.
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    if (!initialized) init();

    const stats = sortStats(computeStats(metric), {agg, sortBy: sortByKey});
    if (!stats.length) return;

    const horizontal = width >= height;
    const margin = horizontal
      ? { top: 12, right: 8, bottom: 20, left: 50 }
      : { top: 12, right: 8, bottom: 20, left: 44 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const globalMaxMetric = Math.max(...stats.map(s => (agg === "mean" ? s.mean : s.max)).filter(Number.isFinite), 0);

    svg.attr("width", width).attr("height", height);
    plotG.attr("transform", `translate(${margin.left},${margin.top})`);

    // scaleBand positions each country along the longer axis with padding
    // between bands. A nested scaleBand splits each band into metric + GDP.
    const codes = stats.map(s => s.code);
    const bandRange: [number, number] = horizontal ? [0, innerWidth] : [0, innerHeight];
    const bandScale = scaleBand().domain(codes).range(bandRange).paddingInner(0).paddingOuter(0);
    const bandW = bandScale.bandwidth();

    const subScale = scaleBand<string>()
      .domain(["metric", "gdp"])
      .range([0, bandW])
      .paddingInner(0)
      .paddingOuter(0.3);
    const barW = subScale.bandwidth();

    // Value axis: for horizontal, bars grow upward (y goes from baseline to top);
    // for vertical, bars grow rightward (x goes from left to right).
    const valueRange: [number, number] = horizontal
      ? [innerHeight, 0]
      : [0, innerWidth];
    const ms = scaleLinear().domain([0, globalMaxMetric || 1]).range(valueRange).nice();
    const gs = scaleLinear().domain([0, globalMaxGdp || 1]).range(valueRange).nice();

    // Metric axis — gridlines extend across the full inner area
    metricAxisG.interrupt().selectAll("*").remove();
    if (horizontal) {
      metricAxisG.call(
        axisLeft(ms).ticks(4).tickSize(-innerWidth).tickFormat(formattersByMetric[metric])
      );
    } else {
      metricAxisG.call(
        axisTop(ms).ticks(4).tickSize(-innerHeight).tickFormat(formattersByMetric[metric])
      );
    }
    metricAxisG.select(".domain").remove();
    metricAxisG.selectAll(".tick line").style("stroke", "var(--muted)").style("stroke-opacity", 0.35).style("stroke-width", 0.5);
    metricAxisG.selectAll(".tick text").style("font-size", "10px").style("fill", "currentColor").style("fill-opacity", 0.6);

    // Metric axis label
    const metricLabelText = `${METRICS_BY_VALUE[metric]?.label ?? metric} (${agg})`;
    if (horizontal) {
      metricLabelG
        .attr("x", -innerHeight / 2).attr("y", -margin.left + 12)
        .attr("transform", "rotate(-90)").text(metricLabelText);
    } else {
      metricLabelG
        .attr("x", innerWidth / 2).attr("y", -margin.top + 10)
        .attr("transform", "").text(metricLabelText);
    }

    const fs = Math.max(10, Math.min(bandW * 0.7, 14));

    const barData = stats.map((d) => {
      const bandStart = bandScale(d.code)!;
      const metricSlot = subScale("metric")!;
      const gdpSlot = subScale("gdp")!;
      const metricVal = agg === "mean" ? d.mean : d.max;

      let mBarX: number, mBarY: number, mBarW: number, mBarH: number;
      let gBarX: number, gBarY: number, gBarW: number, gBarH: number;
      let flagCx: number, flagCy: number;

      if (horizontal) {
        const metricTop = Number.isFinite(metricVal) ? ms(metricVal) : innerHeight;
        const gdpTop = Number.isFinite(d.gdp) ? gs(d.gdp) : innerHeight;
        mBarX = bandStart + metricSlot; mBarY = metricTop; mBarW = barW; mBarH = Math.max(0, innerHeight - metricTop);
        gBarX = bandStart + gdpSlot; gBarY = gdpTop; gBarW = barW; gBarH = Math.max(0, innerHeight - gdpTop);
        flagCx = bandStart + bandW / 2; flagCy = innerHeight + fs / 2 + 4;
      } else {
        const metricEnd = Number.isFinite(metricVal) ? ms(metricVal) : 0;
        const gdpEnd = Number.isFinite(d.gdp) ? gs(d.gdp) : 0;
        mBarX = 0; mBarY = bandStart + metricSlot; mBarW = Math.max(0, metricEnd); mBarH = barW;
        gBarX = 0; gBarY = bandStart + gdpSlot; gBarW = Math.max(0, gdpEnd); gBarH = barW;
        flagCx = -fs / 2 - 4; flagCy = bandStart + bandW / 2;
      }

      return { ...d, mBarX, mBarY, mBarW, mBarH, gBarX, gBarY, gBarW, gBarH, flagCx, flagCy, fs };
    });

    // Data join with key on country code for object constancy
    const groups = barsG.selectAll<SVGGElement, typeof barData[number]>(".country-bar")
      .data(barData, d => d.code);

    const groupsEnter = groups.enter().append("g")
      .attr("class", "country-bar")
      .style("cursor", "pointer")
      .attr("opacity", 1);

    // Enter elements at their final geometry so the initial render doesn't
    // animate from 0. The transitions below are then a visual no-op for
    // newly entered elements, but still animate meaningful updates.
    groupsEnter.append("rect").attr("class", "metric-bar").attr("fill", METRIC_COLOR).attr("fill-opacity", 0.8)
      .attr("x", d => d.mBarX).attr("y", d => d.mBarY)
      .attr("width", d => d.mBarW).attr("height", d => d.mBarH);
    groupsEnter.append("rect").attr("class", "gdp-bar").attr("fill", GDP_COLOR).attr("fill-opacity", 0.8)
      .attr("x", d => d.gBarX).attr("y", d => d.gBarY)
      .attr("width", d => d.gBarW).attr("height", d => d.gBarH);
    groupsEnter.append("text").attr("class", "flag-text")
      .attr("text-anchor", "middle").attr("dominant-baseline", "central")
      .style("user-select", "none")
      .attr("x", d => d.flagCx).attr("y", d => d.flagCy)
      .attr("font-size", d => d.fs)
      .attr("fill", "var(--muted)")
      .text(d => d.code);

    const allGroups = groupsEnter.merge(groups as any);

    allGroups
      .on("mouseenter", (_e, d) => setHoveredCountry(d.code))
      .on("mouseleave", () => setHoveredCountry(null))
      .on("click", (_e, d) => toggleSelectedCountry(d.code));

    allGroups.attr("opacity", 1);

    // Bar geometry transitions
    allGroups.select<SVGRectElement>(".metric-bar")
      .transition().duration(400)
      .attr("x", d => d.mBarX)
      .attr("y", d => d.mBarY)
      .attr("width", d => d.mBarW)
      .attr("height", d => d.mBarH);

    allGroups.select<SVGRectElement>(".gdp-bar")
      .transition().duration(400)
      .attr("x", d => d.gBarX)
      .attr("y", d => d.gBarY)
      .attr("width", d => d.gBarW)
      .attr("height", d => d.gBarH);

    allGroups.select<SVGTextElement>(".flag-text")
      .transition().duration(400)
      .attr("x", d => d.flagCx)
      .attr("y", d => d.flagCy)
      .attr("font-size", d => d.fs)
      .attr("fill", "var(--muted)")
      .text(d => d.code);

    groups.exit().remove();
  }

  function highlight() {
    if (!initialized) return;
    const a = activeCountry();
    barsG.selectAll<SVGGElement, any>(".country-bar")
      .attr("opacity", (d) => a != null && a !== d.code ? 0.35 : 1);
  }

  return { update, highlight };
}
