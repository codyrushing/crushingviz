import { createEffect, createSignal, Show, For } from "solid-js";
import { select, type Selection } from "d3-selection";
import "d3-transition";
import { scaleLinear, scaleBand, scaleSqrt, type ScaleLinear } from "d3-scale";
import { axisBottom, axisLeft, axisTop } from "d3-axis";
import { area, curveBumpX, stack, stackOrderDescending, stackOffsetWiggle, type Series, type SeriesPoint } from "d3-shape";
import { format } from "d3-format";
import { schemeCategory10 } from "d3-scale-chromatic";
import { hierarchy, treemap, treemapBinary, pack, type HierarchyRectangularNode, type HierarchyCircularNode } from "d3-hierarchy";
import { useElementVisibility } from "../../../hooks/useElementVisibility";
import { useScreenSize } from "../../../hooks/useScreenSize";
import { countries, disasterEmdatByType, disasterEmdatRegionalEvents, type EmdatDamageableDisasterTypeName, type EmdatDisasterTypeName, type EmdatDisasterTypeWithSubtypes, type RegionalEmdatEvent } from "../data";

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
// Indices into d3's Category10 scheme; flood_relevant keeps the blue slot.
const TYPE_COLORS: Record<TypeName, string> = {
  Drought: schemeCategory10[8],
  flood_relevant: schemeCategory10[0],
  Earthquake: schemeCategory10[3],
  "Volcanic activity": schemeCategory10[1],
  "Mass movement (dry)": schemeCategory10[7],
};

// EM-DAT's year_span runs to 2026, but 2026 is incomplete — only show full years.
const MIN_YEAR = disasterEmdatByType.year_span[0];
const MAX_YEAR = Math.min(disasterEmdatByType.year_span[1], 2025);

const years: number[] = [];
for (let yr = MIN_YEAR; yr <= MAX_YEAR; yr++) {
  years.push(yr);
}

const fmtAffected = format(".2s");
const fmtDeaths = format(",.0f");
const fmtUSD = (v: number) => format("$.2s")(v).replace("G", "B").replace("k", "K");


// `flood_relevant` is an internal grouping label (Storm + Flood + Mass
// movement (wet)), not a real EM-DAT type — display it as "Flooding".
function getTypeName(type: string): string {
  return type === "flood_relevant" ? "Flooding" : type;
}

// `total` is the all-years total for the hovered type/subtype; `value` is the
// per-year value when `year` is present, otherwise the same as `total`.
type HoverState = { type: TypeName; value: number; total: number; year?: number; subtype?: string };

// Hover payload for an individual event dot; px/py are the dot's center in
// container-relative pixels, used to anchor the tooltip beneath it.
type EventHover = { event: RegionalEmdatEvent; px: number; py: number; r: number };

export function DisastersByType() {
  const { ref } = useElementVisibility();
  const { size, ref: sizeRef } = useScreenSize();
  let affectedContainer!: HTMLDivElement;
  let damageContainer!: HTMLDivElement;
  let affectedChart: ReturnType<typeof DisastersByTypeStreamGraph> | undefined;
  const [hoveredAffected, setHoveredAffected] = createSignal<HoverState | null>(null);
  const [hoveredEvent, setHoveredEvent] = createSignal<EventHover | null>(null);

  createEffect(() => {
    size(); // re-render on (debounced) container resize
    affectedChart = affectedChart ?? DisastersByTypeStreamGraph(affectedContainer, setHoveredAffected, setHoveredEvent);
    affectedChart.render();
  });

  // Highlight the event dots belonging to the hovered subtype.
  createEffect(() => {
    const h = hoveredAffected();
    affectedChart?.highlightSubtype(h?.subtype);
  });

  return (
    <div class="h-screen py-8 flex flex-col font-monospace gap-1" ref={ref}>
      <h2 class="unstyled text-xl sm:text-2xl leading-none font-serif font-bold text-center">Disasters by Type</h2>

      {/* People affected — stacked area chart */}
      <div class="flex flex-col relative flex-1 min-h-0">
        <h3 class="unstyled text-sm font-serif font-semibold text-center opacity-80">Num of affected people by year</h3>
        <Show when={hoveredAffected()} keyed>
          {(h) => (
            <div class="z-1 absolute top-[46%] left-6 pointer-events-none bg-white/90 dark:bg-black/80 backdrop-blur-sm rounded-lg shadow-lg border border-black/10 p-2 text-xs">
              <div class="flex items-center gap-1.5 font-semibold text-sm">
                <span class="inline-block w-2.5 h-2.5" style={{ background: TYPE_COLORS[h.type] }} />
                {h.subtype ?? getTypeName(h.type)}
              </div>
              <div class="mt-1 opacity-80">{fmtAffected(h.total)} total affected</div>
              {h.year != null && (
                <div class="opacity-80">{fmtAffected(h.value)} affected ({h.year})</div>
              )}
            </div>
          )}
        </Show>
        {/* Event dot tooltip — anchored beneath the hovered dot */}
        <Show when={hoveredEvent()} keyed>
          {(h) => (
            <div
              class="z-1 absolute pointer-events-none bg-white/90 dark:bg-black/80 backdrop-blur-sm rounded-lg shadow-lg border border-black/10 p-2 max-w-64 min-w-48"
              style={{ left: `${h.px}px`, top: `${h.py + 2*h.r + 24}px`, transform: "translate(-50%, 0)" }}
            >
              <EventTooltipContent event={h.event} />
            </div>
          )}
        </Show>
        <div class="chart-container flex-1" ref={(el) => { sizeRef(el); affectedContainer = el; }} />
      </div>
    </div>
  );
}

function EventTooltipContent(props: { event: RegionalEmdatEvent }) {
  const e = props.event;
  return (
    <div class="text-xs relative flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-3">
        <div class="font-semibold text-base leading-tight">
          {e.name ?? e.subtype}
          <div class="text-[11px] opacity-70">
            {e.type} — {e.year}
            {e.events_count > 1 ? ` (${e.events_count} events)` : ""}
          </div>
        </div>
        <span
          class="inline-block w-2.5 h-2.5 shrink-0"
          style={{ background: TYPE_COLORS[TYPE_TO_CATEGORY[e.type]] }}
        />
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div class="flex flex-col gap-0.5">
          <div class="text-lg font-bold leading-none">{fmtAffected(e.affected)}</div>
          <div class="text-[10px] opacity-70 leading-tight">Affected</div>
        </div>
        <div class="flex flex-col gap-0.5">
          <div class="text-lg font-bold leading-none">{fmtDeaths(e.deaths)}</div>
          <div class="text-[10px] opacity-70 leading-tight">Deaths</div>
        </div>
        <Show when={e.damage_usd != null} fallback={
          <div class="flex flex-col gap-0.5">
            <div class="text-lg font-bold leading-none opacity-40">—</div>
            <div class="text-[10px] opacity-70 leading-tight">Damage (USD)</div>
          </div>
        }>
          <div class="flex flex-col gap-0.5">
            <div class="text-lg font-bold leading-none">{fmtUSD(e.damage_usd!)}</div>
            <div class="text-[10px] opacity-70 leading-tight">Damage (USD)</div>
          </div>
        </Show>
      </div>
      <div class="flex flex-wrap gap-x-2 gap-y-0.5">
        <For each={e.countries_affected}>
          {(c) => (
            <span class="text-[10px] opacity-80 leading-tight">
              {countries[c]?.flag} {countries[c]?.name ?? c}
            </span>
          )}
        </For>
      </div>
      <Show when={e.note}>
        <div class="text-[10px] opacity-60 leading-tight italic">{e.note}</div>
      </Show>
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

type DotDatum = {
  subtype: string;
  type: TypeName;
  affected: number;
  event: RegionalEmdatEvent;
  children?: DotDatum[];
};

// Minimum treemap cell area (px²) for a category to be worth rendering:
// enough for its 16px header bar plus a sliver of leaf content.
const MIN_CAT_CELL_AREA = 16 * 48;

// Build the two-level hierarchy (category → subtype) sizing leaves by total
// people affected, matching the streamgraph's metric. Categories whose share
// of the grand total is below `minShare` are dropped — at small treemap sizes
// they'd render as meaningless header-only slivers.
function buildTreemapData(minShare = 0): TreemapNodeData {
  const byCat: Record<string, Record<string, number>> = {};
  for (const t of DISASTER_TYPES) byCat[t] = {};
  for (const e of disasterEmdatRegionalEvents.events) {
    const cat = TYPE_TO_CATEGORY[e.type];
    // Match the streamgraph's year range (2026 is incomplete) so subtype
    // totals never exceed their category's stream total.
    if (!cat || e.year > MAX_YEAR) continue;
    byCat[cat][e.subtype] = (byCat[cat][e.subtype] ?? 0) + (e.affected ?? 0);
  }
  const catTotals: Record<string, number> = {};
  for (const t of DISASTER_TYPES) {
    catTotals[t] = Object.values(byCat[t]).reduce((a, b) => a + b, 0);
  }
  const grandTotal = Object.values(catTotals).reduce((a, b) => a + b, 0);
  // Never drop everything: if even the largest category falls below `minShare`
  // (very small treemap), keep whichever categories tie for the largest share.
  const maxShare = grandTotal > 0
    ? Math.max(...DISASTER_TYPES.map((t) => catTotals[t])) / grandTotal
    : 0;
  const threshold = Math.min(minShare, maxShare);
  const children = DISASTER_TYPES
    .filter((cat) => {
      if (catTotals[cat] <= 0) return false;
      return grandTotal === 0 || catTotals[cat] / grandTotal >= threshold;
    })
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
  onEventHover: (h: EventHover | null) => void,
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
  // Cached streamgraph layout so the event-dot band can position dots by year
  // without re-running the full render.
  let xScale: ScaleLinear<number, number> | null = null;
  let dotsBandC = 0; // vertical center of the dot band (below the streamgraph)
  let dotsBandR = 12; // max cluster radius that fits in the band
  let hoveredSubtype: string | undefined;
  let plotLeft = 0; // plot group origin, for container-relative tooltip coords
  let plotTop = 0;
  let bandScale = 1; // viewport-dependent dot-band scale (see render)

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

    // Split the plot vertically: streamgraph on top, event-dot band + label
    // gutter, then treemap below. The dot band is full-size on viewports
    // ≥1024px wide and shrinks linearly toward half size on narrower screens.
    bandScale = window.innerWidth >= 1024 ? 1 : Math.max(0.5, (window.innerWidth - 320) / (1024 - 320));
    const STREAM_H = Math.max(60, innerHeight * 0.53);
    const GUTTER = 92 * bandScale;
    const TREEMAP_TOP = STREAM_H + GUTTER;
    const TREEMAP_H = Math.max(0, innerHeight - TREEMAP_TOP);

    svg.attr("width", width).attr("height", height);
    plot.attr("transform", `translate(${margin.left},${margin.top})`);
    plotLeft = margin.left;
    plotTop = margin.top;

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
    dotsBandC = STREAM_H + 30 * bandScale;
    dotsBandR = 26 * bandScale;
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
        onHover({ type: d.key as TypeName, value: total, total });
      })
      .on("mousemove", (e, d) => {
        const rect = container.getBoundingClientRect();
        const px = e.clientX - rect.left - margin.left;
        const yr = Math.round(x.invert(Math.max(0, Math.min(innerWidth, px))));
        const s = d as Series<RowData, string>;
        const val = s.find((p) => (p.data as RowData).year === yr);
        onHover({ type: s.key as TypeName, value: val ? val[1] - val[0] : 0, total: totals[s.key] ?? 0, year: yr });
      })
      .on("mouseleave", () => onHover(null))
      .transition()
      .duration(400)
      .attr("d", areaGen);

    renderTreemap(innerWidth, TREEMAP_TOP, TREEMAP_H);
    renderEventDots();
  }

  function renderTreemap(w: number, top: number, h: number) {
    treemapG.attr("transform", `translate(0,${top})`);

    // Section label
    const sectionLabel = treemapG.selectAll<SVGTextElement, unknown>("text.section").data([1]);
    sectionLabel.enter().append("text").attr("class", "section").merge(sectionLabel as any)
      .attr("x", 0)
      .attr("y", -14)
      .attr("fill", "var(--muted)")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .text("Disaster events");

    if (h <= 0) return;

    // A category's treemap share approximates its cell area — drop categories
    // too small to fit a legible cell (header + content) at this size.
    const minShare = MIN_CAT_CELL_AREA / Math.max(1, w * h);
    const tmapRoot = hierarchy(buildTreemapData(minShare))
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
    // HTML label inside a foreignObject so it can ellipsize via CSS when the
    // category cell is too narrow for the full type name.
    catEnter.append("foreignObject").attr("class", "cat-label-fo")
      .append("xhtml:div").attr("class", "cat-label");

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
    catMerge.select<SVGForeignObjectElement>("foreignObject.cat-label-fo")
      .attr("x", (d) => d.x0 + 4)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => Math.max(0, d.x1 - d.x0 - 8))
      .attr("height", 16)
      .select("div.cat-label")
      .text((d) => getTypeName(d.data.name))
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("color", "#fff")
      .style("line-height", "16px")
      .style("overflow", "hidden")
      .style("white-space", "nowrap")
      .style("text-overflow", "ellipsis")
      .style("pointer-events", "none");

    // Leaf cells (subtypes), colored by parent category with stepped opacity
    const leaves = tmapRoot.leaves() as HierarchyRectangularNode<TreemapNodeData>[];
    const leafSel = treemapG.selectAll<SVGRectElement, typeof leaves[number]>("rect.leaf").data(leaves, (d) => d.data.name);
    leafSel.exit().remove();
    const leafEnter = leafSel.enter().append("rect").attr("class", "leaf")
      .style("cursor", "pointer")
      .on("mouseenter", (_e, d) => {
        const cat = (d.parent?.data.name ?? "Drought") as TypeName;
        // Leaf value is the subtype's all-years total.
        onHover({ type: cat, value: d.value ?? 0, total: d.value ?? 0, subtype: d.data.name });
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

  // Event dots: always rendered — one dot per regional event, colored by
  // disaster type, radius scaled by people affected (clamped), clustered by
  // year via circle packing in the band below the streamgraph. Clusters are
  // uniformly shrunk if they would overflow the band.
  function renderEventDots() {
    if (!xScale) return;

    // // Section label above the dot band. Safe at the left edge: the affected
    // // data starts in 2011, so the streamgraph is flat where the label sits.
    // const sectionLabel = eventDotsG.selectAll<SVGTextElement, unknown>("text.section").data([1]);
    // sectionLabel.enter().append("text").attr("class", "section").merge(sectionLabel as any)
    //   .attr("x", 0)
    //   .attr("y", dotsBandC - dotsBandR - 8)
    //   .attr("fill", "var(--muted)")
    //   .style("font-size", "12px")
    //   .style("font-weight", "600")
    //   .style("pointer-events", "none")
    //   .text("Disaster events");

    const events = disasterEmdatRegionalEvents.events.filter(
      (e) => e.year >= MIN_YEAR && e.year <= MAX_YEAR && !!e.deaths && e.affected,
    );
    let maxAffected = 0;
    for (const e of events) maxAffected = Math.max(maxAffected, e.affected);
    // Dot radii scale with the band on narrow screens, but the 4px minimum
    // is preserved so the smallest events stay hoverable.
    const rMax = Math.max(8, 16 * bandScale);
    const rScale = scaleSqrt().domain([0, maxAffected]).range([4, rMax]).clamp(true);

    const packLayout = pack<DotDatum>().radius((d) => rScale(d.data.affected)).padding(0);

    type Dot = DotDatum & { id: number; x: number; y: number; r: number };
    const dots: Dot[] = [];
    let id = 0;
    const byYear = new Map<number, typeof events>();
    for (const e of events) {
      const arr = byYear.get(e.year) ?? [];
      arr.push(e);
      byYear.set(e.year, arr);
    }
    // Pass 1: pack each year's cluster and find the worst-case enclosing
    // radius. A single global shrink factor is then derived from it so every
    // dot's radius stays a constant multiple of sqrt(affected) — per-cluster
    // clamping would break size comparability across years.
    const clusters: { yr: number; cr: HierarchyCircularNode<DotDatum> }[] = [];
    let maxClusterR = 0;
    for (const [yr, arr] of byYear) {
      if (!arr.length) continue;
      const clusterRoot = hierarchy<DotDatum>({
        children: arr.map((e) => ({
          subtype: e.subtype,
          type: TYPE_TO_CATEGORY[e.type],
          affected: e.affected,
          event: e,
        })),
      } as DotDatum);
      packLayout(clusterRoot);
      const cr = clusterRoot as HierarchyCircularNode<DotDatum>;
      clusters.push({ yr, cr });
      maxClusterR = Math.max(maxClusterR, cr.r);
    }
    const k = maxClusterR > dotsBandR ? dotsBandR / maxClusterR : 1;

    // Pass 2: emit dots, positioned relative to their year's x and the band
    // center, all scaled by the same k. The 4px floor keeps the smallest
    // events hoverable; it only flattens dots below that size, not the
    // ordering above it.
    for (const { yr, cr } of clusters) {
      const leaves = cr.leaves() as HierarchyCircularNode<DotDatum>[];
      for (const leaf of leaves) {
        dots.push({
          id: id++,
          subtype: leaf.data.subtype,
          type: leaf.data.type,
          affected: leaf.data.affected,
          event: leaf.data.event,
          x: xScale(yr) + (leaf.x - cr.x) * k,
          y: dotsBandC + (leaf.y - cr.y) * k,
          r: Math.max(4, leaf.r * k),
        });
      }
    }

    const sel = eventDotsG.selectAll<SVGCircleElement, Dot>("circle").data(dots, (d) => String(d.id));
    sel.exit().remove();
    const enter = sel.enter().append("circle").attr("r", 0).style("cursor", "pointer");
    enter
      .merge(sel as any)
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r)
      .attr("fill", (d) => TYPE_COLORS[d.type] ?? "#999")
      .attr("stroke", "var(--background)")
      .attr("stroke-width", 0.5)
      .style("pointer-events", "all")
      .on("mouseenter", (_e, d) => {
        // Clamp so the ~220px tooltip stays inside the container horizontally.
        const w = container.clientWidth;
        const px = Math.max(110, Math.min(w - 110, d.x + plotLeft));
        onEventHover({ event: d.event, px, py: d.y + plotTop, r: d.r });
      })
      .on("mouseleave", () => onEventHover(null));

    highlightSubtype(hoveredSubtype);
  }

  // Dim dots that don't belong to the hovered subtype (undefined = none
  // hovered, so all dots render at full opacity).
  function highlightSubtype(subtype?: string) {
    hoveredSubtype = subtype;
    eventDotsG
      .selectAll<SVGCircleElement, { subtype: string }>("circle")
      .interrupt()
      .transition()
      .duration(150)
      .attr("fill-opacity", (d) => (!subtype || d.subtype === subtype) ? 0.9 : 0.25);
  }

  return { render, highlightSubtype };
}
