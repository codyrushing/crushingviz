import { createEffect, createSignal, Show } from "solid-js";
import { select, type Selection } from "d3-selection";
import "d3-transition";
import { scaleLinear, scaleBand, type ScaleLinear } from "d3-scale";
import { axisBottom, axisLeft, axisTop } from "d3-axis";
import { area, curveBumpX, stack, stackOrderDescending, stackOffsetWiggle, type Series, type SeriesPoint } from "d3-shape";
import { format } from "d3-format";
import { hierarchy, treemap, treemapBinary, type HierarchyRectangularNode } from "d3-hierarchy";
import { useElementVisibility } from "../../../hooks/useElementVisibility";
import { disasterEmdatByType, disasterEmdatRegionalEvents, type EmdatDamageableDisasterTypeName, type EmdatDisasterTypeName, type EmdatDisasterTypeWithSubtypes } from "../data";

// Disaster types rendered in the chart. `flood_relevant` (Storm + Flood +
// Mass movement (wet), per `flood_relevant_definition`) is included as a
// single band; its constituent subtypes are therefore excluded to avoid
// double-counting. `all` and `coastal_flood_only` are also excluded as
// overlapping aggregates.
const DISASTER_TYPES = [
  "Drought",
  "flood_relevant",
  "Earthquake",
  "Volcanic activity",
  "Mass movement (dry)",
] as const;

type TypeName = (typeof DISASTER_TYPES)[number];

// Curated categorical palette — distinct, roughly color-blind friendly.
const TYPE_COLORS: Record<TypeName, string> = {
  Drought: "#bcbd22",
  flood_relevant: "#1f77b4",
  Earthquake: "#d62728",
  "Volcanic activity": "#ff7f0e",
  "Mass movement (dry)": "#7f7f7f",
};

// EM-DAT's year_span runs to 2026, but 2026 is incomplete — only show full years.
const MIN_YEAR = disasterEmdatByType.year_span[0];
const MAX_YEAR = Math.min(disasterEmdatByType.year_span[1], 2025);

const years: number[] = [];
for (let yr = MIN_YEAR; yr <= MAX_YEAR; yr++) {
  years.push(yr);
}

const fmtAffected = format(".2s");
const fmtUSD = format("$.3s");

type HoverState = { type: TypeName; value: number; year?: number; subtype?: string };

export function DisastersByType() {
  const { ref } = useElementVisibility();
  let affectedContainer!: HTMLDivElement;
  let damageContainer!: HTMLDivElement;
  let affectedChart: ReturnType<typeof DisastersByTypeStreamGraph> | undefined;
  const [hoveredAffected, setHoveredAffected] = createSignal<HoverState | null>(null);

  createEffect(() => {
    affectedChart = affectedChart ?? DisastersByTypeStreamGraph(affectedContainer, setHoveredAffected);
    affectedChart.render();
  });

  // Re-render event dots whenever the hovered subtype changes.
  createEffect(() => {
    const h = hoveredAffected();
    affectedChart?.renderEventDots(h?.subtype);
  });

  return (
    <div class="h-screen flex flex-col font-monospace gap-1" ref={ref}>
      <h2 class="text-2xl font-bold text-center">Disasters by Type</h2>

      {/* People affected — stacked area chart */}
      <div class="flex flex-col relative flex-1 min-h-0">
        <h3 class="text-sm font-semibold text-center opacity-80">People affected by year</h3>
        <Show when={hoveredAffected()} keyed>
          {(h) => (
            <div class="z-1 absolute top-2 right-2 pointer-events-none bg-white/90 dark:bg-black/80 backdrop-blur-sm rounded-lg shadow-lg border border-black/10 p-2 text-xs">
              <div class="flex items-center gap-1.5 font-semibold text-sm">
                <span class="inline-block w-2.5 h-2.5" style={{ background: TYPE_COLORS[h.type] }} />
                {h.type}
              </div>
              <div class="mt-1 opacity-80">
                {fmtAffected(h.value)} affected{h.year != null ? ` (${h.year})` : ""}
              </div>
            </div>
          )}
        </Show>
        <div class="chart-container flex-1" ref={affectedContainer} />
      </div>
    </div>
  );
}

type RowData = { year: number } & Record<string, number>;

// Build the per-year matrix for the stacked area (affected metric).
function buildAffectedRows(): RowData[] {
  const byType = disasterEmdatByType.regional_by_year_affected as Record<EmdatDisasterTypeName, { [year: string]: number }>;
  return years.map((yr) => {
    const d: RowData = { year: yr };
    for (const t of DISASTER_TYPES) {
      d[t] = byType[t]?.[String(yr)] ?? 0;
    }
    return d;
  })
  .filter(d => d.year <= 2025);
}

// Total affected per type (for ordering + end labels).
function affectedTotals(): Record<string, number> {
  const rows = buildAffectedRows();
  const totals: Record<string, number> = {};
  for (const t of DISASTER_TYPES) totals[t] = 0;
  for (const r of rows) for (const t of DISASTER_TYPES) totals[t] += r[t];
  return totals;
}

// Maps each EM-DAT disaster type to the top-level streamgraph category. The
// streamgraph collapses Storm + Flood + Mass movement (wet) into a single
// `flood_relevant` band, so the treemap mirrors that grouping at its top level
// while exposing the individual subtypes as leaves.
const TYPE_TO_CATEGORY: Record<EmdatDisasterTypeWithSubtypes, TypeName> = {
  Drought: "Drought",
  Storm: "flood_relevant",
  Flood: "flood_relevant",
  "Mass movement (wet)": "flood_relevant",
  Earthquake: "Earthquake",
  "Volcanic activity": "Volcanic activity",
  "Mass movement (dry)": "Mass movement (dry)",
};

type TreemapNodeData = {
  name: string;
  value?: number;
  children?: TreemapNodeData[];
};

// Build the two-level hierarchy (category → subtype) sizing leaves by total
// people affected, matching the streamgraph's metric.
function buildTreemapData(): TreemapNodeData {
  const byCat: Record<string, Record<string, number>> = {};
  for (const t of DISASTER_TYPES) byCat[t] = {};
  for (const e of disasterEmdatRegionalEvents.events) {
    if (!e.deaths) continue;
    const cat = TYPE_TO_CATEGORY[e.type];
    if (!cat) continue;
    byCat[cat][e.subtype] = (byCat[cat][e.subtype] ?? 0) + (e.affected ?? 0);
  }
  const children = DISASTER_TYPES
    .filter((cat) => Object.keys(byCat[cat]).length > 0)
    .map((cat) => ({
      name: cat,
      children: Object.entries(byCat[cat])
        .filter(([, v]) => v > 0)
        .map(([sub, v]) => ({ name: sub, value: v })),
    }));
  return { name: "Disasters", children };
}

// Wiggle offset centers the stream's baseline to minimize slope changes, but
// the baseline can drift away from zero. This wrapper applies the standard
// wiggle and then shifts each x-column so the stream's vertical midpoint sits
// exactly at 0.
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

function DisastersByTypeStreamGraph(
  container: HTMLElement,
  onHover: (h: HoverState | null) => void,
) {
  const root = select(container);
  let svg: Selection<SVGSVGElement, unknown, null, undefined>;
  let plot: Selection<SVGGElement, unknown, null, undefined>;
  let xAxisG: Selection<SVGGElement, unknown, null, undefined>;
  let yAxisG: Selection<SVGGElement, unknown, null, undefined>;
  let seriesG: Selection<SVGGElement, unknown, null, undefined>;
  let labelG: Selection<SVGGElement, unknown, null, undefined>;
  let treemapG: Selection<SVGGElement, unknown, null, undefined>;
  let eventDotsG: Selection<SVGGElement, unknown, null, undefined>;
  let initialized = false;
  // Cached streamgraph layout so renderEventDots can position dots by year
  // without re-running the full render.
  let xScale: ScaleLinear<number, number> | null = null;
  let streamBottom = 0;

  function init() {
    root.selectAll("*").remove();
    svg = root.append("svg").style("display", "block").style("overflow", "visible");
    plot = svg.append("g");
    xAxisG = plot.append("g");
    yAxisG = plot.append("g");
    seriesG = plot.append("g");
    labelG = plot.append("g");
    eventDotsG = plot.append("g");
    treemapG = plot.append("g");
    initialized = true;
  }

  function render() {
    if (!initialized) init();
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    const margin = { top: 28, right: 20, bottom: 24, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Split the plot vertically: streamgraph on top, treemap below with a
    // small gutter for the section label.
    const STREAM_H = Math.max(60, innerHeight * 0.56);
    const GUTTER = 34;
    const TREEMAP_TOP = STREAM_H + GUTTER;
    const TREEMAP_H = Math.max(0, innerHeight - TREEMAP_TOP);

    svg.attr("width", width).attr("height", height);
    plot.attr("transform", `translate(${margin.left},${margin.top})`);

    const data = buildAffectedRows();
    const totals = affectedTotals();
    // Stack largest-first so the dominant, stable types sit on the baseline.
    const keys = [...DISASTER_TYPES].sort((a, b) => totals[b] - totals[a]);
    const stackGen = stack<RowData>()
      .keys(keys)
      .order(stackOrderDescending)
      .offset(stackOffsetWiggleCentered);
    const series = stackGen(data);

    const x = scaleLinear().domain([MIN_YEAR, MAX_YEAR]).range([0, innerWidth]);
    xScale = x;
    streamBottom = STREAM_H;
    let maxAbs = 0;
    for (const s of series) for (const p of s) maxAbs = Math.max(maxAbs, Math.abs(p[0]), Math.abs(p[1]));
    const yScalePadding = 10;
    const y = scaleLinear()
      .domain([-maxAbs, maxAbs])
      .range([STREAM_H - yScalePadding / 2, yScalePadding / 2]);

    // x-axis gridlines every 5 years
    const gridTicks = years.filter((yr) => yr % 5 === 0);
    xAxisG
      .interrupt()
      .call(axisTop(x).tickValues(gridTicks).tickFormat((d) => String(Number(d))).tickSize(-STREAM_H));
    xAxisG.select(".domain").remove();
    xAxisG.selectAll(".tick line").style("stroke", "var(--muted)").style("stroke-opacity", 0.5).style("stroke-width", 0.5);
    xAxisG.selectAll(".tick text").attr("fill", "var(--muted)").style("font-size", "1.1em");

    yAxisG.interrupt().selectAll("*").remove();

    const areaGen = area<SeriesPoint<RowData>>()
      .x((d) => x((d.data as RowData).year))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(curveBumpX);

    const paths = seriesG.selectAll<SVGPathElement, Series<RowData, string>>("path").data(series, (d) => d.key);

    paths.exit().remove();

    const enter = paths
      .enter()
      .append("path")
      .attr("fill", (d) => TYPE_COLORS[d.key as TypeName] ?? "#999")
      .attr("fill-opacity", 0.85)
      .attr("stroke", "none")
      .style("pointer-events", "all")
      .style("cursor", "pointer");

    enter
      .merge(paths as any)
      .on("mouseenter", (_e, d) => {
        const total = totals[d.key] ?? 0;
        onHover({ type: d.key as TypeName, value: total });
      })
      .on("mousemove", (e, d) => {
        const rect = container.getBoundingClientRect();
        const px = e.clientX - rect.left - margin.left;
        const yr = Math.round(x.invert(Math.max(0, Math.min(innerWidth, px))));
        const s = d as Series<RowData, string>;
        const val = s.find((p) => (p.data as RowData).year === yr);
        onHover({ type: s.key as TypeName, value: val ? val[1] - val[0] : 0, year: yr });
      })
      .on("mouseleave", () => onHover(null))
      .transition()
      .duration(400)
      .attr("d", areaGen);

    renderTreemap(innerWidth, TREEMAP_TOP, TREEMAP_H);
  }

  function renderTreemap(w: number, top: number, h: number) {
    treemapG.attr("transform", `translate(0,${top})`);

    // Section label
    // const sectionLabel = treemapG.selectAll<SVGTextElement, unknown>("text.section").data([1]);
    // sectionLabel.enter().append("text").attr("class", "section").merge(sectionLabel as any)
    //   .attr("x", 0)
    //   .attr("y", -14)
    //   .attr("fill", "var(--muted)")
    //   .style("font-size", "12px")
    //   .style("font-weight", "600")
    //   .text("Affected by subtype (treemap)");

    if (h <= 0) return;

    const tmapRoot = hierarchy(buildTreemapData())
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const tmap = treemap<TreemapNodeData>()
      .tile(treemapBinary)
      .size([w, h])
      .paddingInner(2)
      .paddingTop((d) => (d.depth === 1 ? 16 : 0));

    tmap(tmapRoot);

    const catNodes = (tmapRoot.children ?? []) as HierarchyRectangularNode<TreemapNodeData>[];

    // Category containers: header bar + border + label
    const catSel = treemapG.selectAll<SVGGElement, typeof catNodes[number]>("g.cat").data(catNodes, (d) => d.data.name);
    catSel.exit().remove();
    const catEnter = catSel.enter().append("g").attr("class", "cat");
    catEnter.append("rect").attr("class", "cat-border");
    catEnter.append("rect").attr("class", "cat-header");
    catEnter.append("text").attr("class", "cat-label");

    const catMerge = catEnter.merge(catSel as any);
    catMerge.select(".cat-border")
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0)
      .attr("fill", "none")
      .attr("stroke", "var(--muted)")
      .attr("stroke-width", 0.5);
    catMerge.select(".cat-header")
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", 16)
      .attr("fill", (d) => TYPE_COLORS[d.data.name as TypeName] ?? "#999");
    catMerge.select(".cat-label")
      .attr("x", (d) => d.x0 + 4)
      .attr("y", (d) => d.y0 + 12)
      .text((d) => d.data.name)
      .attr("fill", "#fff")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("pointer-events", "none");

    // Leaf cells (subtypes), colored by parent category with stepped opacity
    const leaves = tmapRoot.leaves() as HierarchyRectangularNode<TreemapNodeData>[];
    const leafSel = treemapG.selectAll<SVGRectElement, typeof leaves[number]>("rect.leaf").data(leaves, (d) => d.data.name);
    leafSel.exit().remove();
    const leafEnter = leafSel.enter().append("rect").attr("class", "leaf")
      .style("cursor", "pointer")
      .on("mouseenter", (_e, d) => {
        const cat = (d.parent?.data.name ?? "Drought") as TypeName;
        onHover({ type: cat, value: d.value ?? 0, subtype: d.data.name });
      })
      .on("mouseleave", () => onHover(null));
    leafEnter.merge(leafSel as any)
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("fill", (d) => TYPE_COLORS[(d.parent?.data.name ?? "Drought") as TypeName] ?? "#999")
      .attr("fill-opacity", (d) => {
        const sibs = d.parent?.children ?? [];
        const idx = sibs.indexOf(d);
        return 0.5 + 0.14 * idx;
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5);

    // Leaf labels — only when the cell is large enough to fit text
    const leafLabelSel = treemapG.selectAll<SVGTextElement, typeof leaves[number]>("text.leaf-label").data(leaves, (d) => d.data.name);
    leafLabelSel.exit().remove();
    const llEnter = leafLabelSel.enter().append("text").attr("class", "leaf-label").style("pointer-events", "none");
    llEnter.merge(leafLabelSel as any)
      .attr("x", (d) => d.x0 + 4)
      .attr("y", (d) => d.y0 + 14)
      .attr("fill", "#fff")
      .style("font-size", "9px")
      .text((d) => (d.x1 - d.x0 > 64 && d.y1 - d.y0 > 22 ? d.data.name : ""));
  }

  // Render a dot for each event of the hovered subtype, placed below the
  // streamgraph at the x-position of its year. Events sharing a year are
  // stacked vertically so they don't overlap.
  function renderEventDots(subtype?: string) {
    if (!subtype || !xScale) {
      eventDotsG.selectAll("*").remove();
      return;
    }
    const events = disasterEmdatRegionalEvents.events.filter(
      (e) => e.subtype === subtype && e.year >= MIN_YEAR && e.year <= MAX_YEAR,
    );
    // Group by year to stack dots vertically within the gutter band.
    const byYear = new Map<number, typeof events>();
    for (const e of events) {
      const arr = byYear.get(e.year) ?? [];
      arr.push(e);
      byYear.set(e.year, arr);
    }
    type Dot = { year: number; idx: number; n: number; type: TypeName };
    const dots: Dot[] = [];
    for (const [yr, arr] of byYear) {
      for (let i = 0; i < arr.length; i++) dots.push({ year: yr, idx: i, n: arr.length, type: TYPE_TO_CATEGORY[arr[i].type] });
    }

    const bandTop = streamBottom + 4;
    const bandH = 14; // gutter is 34px; label sits at +20, dots occupy +4..+18
    const r = 2.5;

    const sel = eventDotsG.selectAll<SVGCircleElement, Dot>("circle").data(dots, (d) => `${d.year}-${d.idx}`);
    sel.exit().remove();
    const enter = sel.enter().append("circle").attr("r", 0);
    enter
      .merge(sel as any)
      .attr("cx", (d) => xScale!(d.year))
      .attr("cy", (d) => bandTop + (d.n === 1 ? bandH / 2 : (d.idx / (d.n - 1)) * bandH))
      .attr("r", r)
      .attr("fill", (d) => TYPE_COLORS[d.type] ?? "#999")
      .attr("fill-opacity", 0.9);
  }

  return { render, renderEventDots };
}
function DamageBarChart(
  container: HTMLElement,
  onHover: (h: HoverState | null) => void,
) {
  const root = select(container);
  let svg: Selection<SVGSVGElement, unknown, null, undefined>;
  let plot: Selection<SVGGElement, unknown, null, undefined>;
  let xAxisG: Selection<SVGGElement, unknown, null, undefined>;
  let yAxisG: Selection<SVGGElement, unknown, null, undefined>;
  let barsG: Selection<SVGGElement, unknown, null, undefined>;
  let initialized = false;

  function init() {
    root.selectAll("*").remove();
    svg = root.append("svg");
    plot = svg.append("g");
    xAxisG = plot.append("g");
    yAxisG = plot.append("g");
    barsG = plot.append("g");
    initialized = true;
  }

  function render() {
    if (!initialized) init();
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    const margin = { top: 28, right: 80, bottom: 24, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);
    plot.attr("transform", `translate(${margin.left},${margin.top})`);

    const dmg = disasterEmdatByType.regional_damage_usd_by_type as Record<EmdatDamageableDisasterTypeName, number>;
    // `flood_relevant` = Storm + Flood + Mass movement (wet) (per
    // `flood_relevant_definition`); the data only stores per-type totals, so
    // sum the constituents and exclude them individually.
    const FLOOD_RELEVANT_PARTS: EmdatDamageableDisasterTypeName[] = ["Storm", "Flood", "Mass movement (wet)"];
    const floodRelevantDamage = FLOOD_RELEVANT_PARTS.reduce((sum, t) => sum + (dmg[t] ?? 0), 0);
    const entries = (DISASTER_TYPES as readonly string[])
      .map((t) => {
        const value = t === "flood_relevant" ? floodRelevantDamage : dmg[t as EmdatDamageableDisasterTypeName] ?? 0;
        return { type: t as TypeName, value };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    const x = scaleLinear().domain([0, (entries[0]?.value ?? 1)]).range([0, innerWidth]).nice();
    const y = scaleBand<TypeName>().domain(entries.map((d) => d.type)).range([0, innerHeight]).padding(0.25);

    xAxisG
      .interrupt()
      .call(axisBottom(x).ticks(5).tickFormat((d) => fmtUSD(Number(d))).tickSize(-innerHeight));
    xAxisG.select(".domain").remove();
    xAxisG.selectAll(".tick line").style("stroke", "var(--muted)").style("stroke-opacity", 0.35).style("stroke-width", 0.5);
    xAxisG.selectAll(".tick text").attr("fill", "var(--muted)").style("font-size", "10px");
    xAxisG.attr("transform", `translate(0,${innerHeight})`);

    yAxisG
      .interrupt()
      .call(axisLeft(y).tickSize(0));
    yAxisG.select(".domain").remove();
    yAxisG.selectAll(".tick text").attr("fill", "currentColor").style("font-size", "11px");

    const bars = barsG.selectAll<SVGRectElement, typeof entries[number]>("rect").data(entries, (d) => d.type);
    bars.exit().remove();
    const enter = bars
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d) => y(d.type)!)
      .attr("height", y.bandwidth())
      .attr("width", 0)
      .attr("fill", (d) => TYPE_COLORS[d.type] ?? "#999")
      .attr("fill-opacity", 0.85)
      .style("cursor", "pointer")
      .on("mouseenter", (_e, d) => onHover({ type: d.type, value: d.value }))
      .on("mouseleave", () => onHover(null));

    enter
      .merge(bars as any)
      .transition()
      .duration(400)
      .attr("x", 0)
      .attr("y", (d) => y(d.type)!)
      .attr("height", y.bandwidth())
      .attr("width", (d) => x(d.value));

    // const vals = labelG.selectAll<SVGTextElement, typeof entries[number]>("text").data(entries, (d) => d.type);
    // vals.exit().remove();
    // const vEnter = vals
    //   .enter()
    //   .append("text")
    //   .attr("dominant-baseline", "central")
    //   .style("font-size", "10px")
    //   .attr("fill", "currentColor");
    // vEnter
    //   .merge(vals as any)
    //   .transition()
    //   .duration(400)
    //   .attr("x", (d) => x(d.value) + 4)
    //   .attr("y", (d) => (y(d.type) ?? 0) + y.bandwidth() / 2)
    //   .text((d) => fmtUSD(d.value));
  }

  return { render };
}
