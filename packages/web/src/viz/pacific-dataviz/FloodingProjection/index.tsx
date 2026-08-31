import { createEffect, createSignal, Show } from "solid-js";
import { select, type Selection } from "d3-selection";
import "d3-transition";
import { scaleLinear, type ScaleLinear } from "d3-scale";
import { schemeBlues } from "d3-scale-chromatic";
import { axisLeft, axisTop } from "d3-axis";
import { area, line } from "d3-shape";
import { format } from "d3-format";
import { useElementVisibility } from "../../../hooks/useElementVisibility";
import { useScreenSize } from "../../../hooks/useScreenSize";
import { XIcon } from "../../../icons/XIcon";
import {
  affectedProjection2050,
  countries,
  disasterEmdatByType,
  type AffectedProjectionCountryProjected,
} from "../data";
import { FloodingProjectionSourcesModal } from "./FloodingProjectionSourcesModal";

// Historical window shown as solid lines (EM-DAT full years). The projection
// continues the cumulative total from the year AFTER history ends, so no
// year is counted in both segments.
const MIN_YEAR = 2000;
const HIST_MAX_YEAR = 2025;
const MAX_YEAR = 2050;
const SPLIT_YEAR = HIST_MAX_YEAR + 0.5; // x-position of the history/projection divider

const fmtAffected = format(".2s");
const fmtRange = format(".1f");

type Pt = { year: number; v: number };
type BandPt = { year: number; lo: number; hi: number };

type CountryRow = {
  code: string;
  name: string;
  flag: string;
  hist: Pt[];          // CUMULATIVE affected, 2000–HIST_MAX_YEAR (EM-DAT flood_relevant)
  proj: Pt[];          // CUMULATIVE affected, continuing after HIST_MAX_YEAR
  band: BandPt[];      // CUMULATIVE low/high band, same years as proj
  stats: AffectedProjectionCountryProjected;
};

function buildRows(): CountryRow[] {
  const rows: CountryRow[] = [];
  for (const [code, c] of Object.entries(affectedProjection2050.countries)) {
    if ("no_emdat_records" in c) continue;
    const histSeries = disasterEmdatByType.countries[code]?.flood_relevant.series_affected ?? {};
    // Accumulate history first; the projection then continues the running
    // total, so the whole line is monotonically non-decreasing.
    let cum = 0;
    const hist: Pt[] = [];
    for (let yr = MIN_YEAR; yr <= HIST_MAX_YEAR; yr++) {
      cum += histSeries[String(yr)] ?? 0;
      hist.push({ year: yr, v: cum });
    }
    // Projected years overlapping the historical window are dropped —
    // otherwise that year's increment double-counts and renders as a
    // vertical jump where the dashed segment picks up.
    const projPts = Object.entries(c.series)
      .map(([yrS, p]) => ({ year: Number(yrS), v: p.affected, lo: c.series_low[yrS].affected, hi: c.series_high[yrS].affected }))
      .filter((p) => p.year > HIST_MAX_YEAR)
      .sort((a, b) => a.year - b.year);
    const proj: Pt[] = [];
    const band: BandPt[] = [];
    let cumLo = cum;
    let cumHi = cum;
    for (const p of projPts) {
      cum += p.v;
      cumLo += p.lo;
      cumHi += p.hi;
      proj.push({ year: p.year, v: cum });
      band.push({ year: p.year, lo: cumLo, hi: cumHi });
    }
    rows.push({
      code,
      name: countries[code]?.name ?? code,
      flag: countries[code]?.flag ?? code,
      hist,
      proj,
      band,
      stats: c,
    });
  }
  // Draw small-burden countries last so their hit areas sit above the big
  // lines and stay hoverable.
  const peak = (r: CountryRow) =>
    Math.max(...r.hist.map((p) => p.v), ...r.proj.map((p) => p.v));
  return rows.sort((a, b) => peak(b) - peak(a));
}

const rows = buildRows();

// Single line color — countries are distinguished by hover/selection dimming,
// not hue.
const LINE_COLOR = schemeBlues[9][6];

export function FloodingProjection() {
  const { ref } = useElementVisibility();
  const { size, ref: sizeRef } = useScreenSize();
  let chartContainer!: HTMLDivElement;
  let chart: ReturnType<typeof FloodingProjectionChart> | undefined;
  const [selected, setSelected] = createSignal<string | null>(null);
  const [hovered, setHovered] = createSignal<string | null>(null);

  // A locked selection wins, else the hovered line.
  const active = () => selected() ?? hovered();

  const toggleSelected = (code: string) => {
    if (selected() === code) setHovered(null);
    setSelected((prev) => (prev === code ? null : code));
  };

  createEffect(() => {
    size(); // re-render on (debounced) container resize
    chart = chart ?? FloodingProjectionChart(chartContainer, active, setHovered, toggleSelected);
    chart.render();
  });

  createEffect(() => {
    active();
    chart?.highlight();
  });

  return (
    <div class="h-screen min-h-128 py-8 flex flex-col font-monospace gap-1" ref={ref}>
      <h2 class="unstyled text-xl sm:text-2xl leading-none font-serif font-bold text-center">Flood-Affected Population to 2050</h2>
      <div class="flex flex-col relative flex-1 min-h-0">
        <h3 class="unstyle text-sm font-serif font-semibold text-center opacity-80">
          Cumulative people affected by flooding — history ({MIN_YEAR}–{HIST_MAX_YEAR}) and projected ({HIST_MAX_YEAR}–{MAX_YEAR})
        </h3>

        <div class="relative flex flex-col flex-1">
          <Show when={active()} keyed>
            {(code) => (
              <div class="z-1 w-56 sm:w-sm absolute top-10 left-16 bg-white/90 dark:bg-black/80 backdrop-blur-sm rounded-lg shadow-lg border border-black/10 p-2">
                <CountryTooltipContent
                  code={code}
                  onClear={() => {
                    setHovered(null);
                    setSelected(null);
                  }}
                />
              </div>
            )}
          </Show>
          <div class="chart-container flex-1" ref={(el) => { sizeRef(el); chartContainer = el; }} />
        </div>
      </div>
      <FloodingProjectionSourcesModal />
    </div>
  );
}

function CountryTooltipContent(props: { code: string; onClear: () => void }) {
  const row = rows.find((r) => r.code === props.code)!;
  const s = row.stats;
  const worst = s.worst_historical_flood;
  return (
    <div class="text-xs flex-col gap-1.5">
      <div class="flex items-center justify-between gap-3">
        <div class="font-semibold text-base leading-tight">
          {row.flag} {row.name}
          <div class="text-[11px] opacity-70">{MIN_YEAR} ― {MAX_YEAR}</div>
        </div>
        <button
          type="button"
          class="absolute p-1 top-0 right-0 text-foreground hover:text-muted cursor-pointer shrink-0"
          title="Clear selection"
          onClick={props.onClear}
        >
          <XIcon class="size-4" />
        </button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-0.5">
          <div class="text-lg font-bold leading-none">{fmtAffected(s.baseline_annual_affected)}</div>
          <div class="text-[10px] opacity-70 leading-tight">Affected per year (2000–25 avg)</div>
        </div>
        <div class="flex flex-col gap-0.5">
          <div class="text-lg font-bold leading-none">{s.baseline_events}</div>
          <div class="text-[10px] opacity-70 leading-tight">Flood-relevant events recorded</div>
        </div>
        <div class="flex flex-col gap-0.5">
          <div class="text-lg font-bold leading-none">{fmtRange(s.af_central)}x</div>
          <div class="text-[10px] opacity-70 leading-tight">Flood frequency by 2050</div>
        </div>
        <div class="flex flex-col gap-0.5">
          <div class="text-lg font-bold leading-none">{fmtAffected(s.series["2050"]?.affected ?? 0)}</div>
          <div class="text-[10px] opacity-70 leading-tight">Projected affected / yr (2050)</div>
        </div>
      </div>
      <div class="opacity-80">
        Cumulative 2025–2050: {fmtAffected(s.cumulative_affected.central)} affected
        <span class="opacity-70"> ({fmtAffected(s.cumulative_affected.low)}–{fmtAffected(s.cumulative_affected.high)})</span>
      </div>
      <Show when={worst}>
        {(w) => (
          <div class="opacity-80">
            {w().year} flood ({fmtAffected(w().affected)} affected): 1-in-{w().return_period_today_yrs}-yr event →
            roughly every {fmtRange(w().return_period_2050_yrs)} yrs by 2050
          </div>
        )}
      </Show>
      <div class="text-[10px] opacity-60 leading-tight italic">
        {s.small_n_flag ? "Baseline from <3 recorded events — illustrative. " : ""}
        Illustrative projection; affected counts are person-incidents (EM-DAT + amplification model).
      </div>
    </div>
  );
}

function FloodingProjectionChart(
  container: HTMLElement,
  getActive: () => string | null,
  onHover: (code: string | null) => void,
  onSelect: (code: string) => void,
) {
  const root = select(container);
  let svg: Selection<SVGSVGElement, unknown, null, undefined>;
  let plot: Selection<SVGGElement, unknown, null, undefined>;
  let xAxisG: Selection<SVGGElement, unknown, null, undefined>;
  let yAxisG: Selection<SVGGElement, unknown, null, undefined>;
  let regionG: Selection<SVGGElement, unknown, null, undefined>;
  let bandG: Selection<SVGGElement, unknown, null, undefined>;
  let linesG: Selection<SVGGElement, unknown, null, undefined>;
  let hitsG: Selection<SVGGElement, unknown, null, undefined>;
  let x!: ScaleLinear<number, number>;
  let y!: ScaleLinear<number, number>;
  let innerHeight = 0;

  function init() {
    root.selectAll("*").remove();
    svg = root.append("svg").style("display", "block").style("overflow", "visible");
    // Plot-area clip: the high band can extend above the y-domain cap.
    svg.append("defs")
      .append("clipPath")
      .attr("id", "flooding-projection-clip")
      .append("rect");
    plot = svg.append("g");
    xAxisG = plot.append("g");
    yAxisG = plot.append("g");
    regionG = plot.append("g");
    bandG = plot.append("g").attr("clip-path", "url(#flooding-projection-clip)");
    linesG = plot.append("g");
    hitsG = plot.append("g");
  }

  function render() {
    init();
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    const margin = { top: 28, right: 24, bottom: 28, left: 64 };
    const innerWidth = width - margin.left - margin.right;
    innerHeight = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);
    plot.attr("transform", `translate(${margin.left},${margin.top})`);
    svg.select<SVGRectElement>("#flooding-projection-clip rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerWidth)
      .attr("height", innerHeight);

    x = scaleLinear().domain([MIN_YEAR, MAX_YEAR]).range([0, innerWidth]);

    // y-domain caps at the central (af_central) line; the high band may
    // extend above the plot top.
    let maxV = 0;
    for (const r of rows) {
      for (const p of r.hist) maxV = Math.max(maxV, p.v);
      for (const p of r.proj) maxV = Math.max(maxV, p.v);
    }
    y = scaleLinear().domain([0, maxV]).range([innerHeight, 0]).nice();

    // x-axis: 5-year gridlines (axisTop, per house convention)
    const gridTicks: number[] = [];
    for (let yr = MIN_YEAR; yr <= MAX_YEAR; yr += 5) gridTicks.push(yr);
    xAxisG
      .call(axisTop(x).tickValues(gridTicks).tickFormat((d) => String(Number(d))).tickSize(-innerHeight));
    xAxisG.select(".domain").remove();
    xAxisG.selectAll(".tick line").style("stroke", "var(--muted)").style("stroke-opacity", 0.5).style("stroke-width", 0.5);
    xAxisG.selectAll(".tick text").attr("fill", "var(--muted)").style("font-size", "1.1em");

    // y-axis
    yAxisG
      .call(axisLeft(y).ticks(6).tickFormat((d) => fmtAffected(Number(d))).tickSize(-innerWidth));
    yAxisG.select(".domain").remove();
    yAxisG.selectAll(".tick line").style("stroke", "var(--muted)").style("stroke-opacity", 0.3).style("stroke-width", 0.5);
    yAxisG.selectAll(".tick text").attr("fill", "var(--muted)").style("font-size", "0.9em");
    // Drop the topmost y tick label — it collides with the x-axis labels
    // (axisTop) rendered just above the plot area.
    yAxisG
      .selectAll<SVGGElement, number>(".tick")
      .filter((d) => y(d) < 10)
      .select("text")
      .remove();

    renderRegion(innerWidth);
    renderLines();
    highlight();
  }

  // Shaded projection region + divider + era labels.
  function renderRegion(innerWidth: number) {
    const xSplit = x(SPLIT_YEAR);
    regionG
      .append("rect")
      .attr("x", xSplit)
      .attr("y", 0)
      .attr("width", Math.max(0, innerWidth - xSplit))
      .attr("height", innerHeight)
      .attr("fill", "var(--muted)")
      .attr("fill-opacity", 0.05);
    regionG
      .append("line")
      .attr("x1", xSplit).attr("x2", xSplit)
      .attr("y1", 0).attr("y2", innerHeight)
      .attr("stroke", "var(--muted)")
      .attr("stroke-dasharray", "4 4")
      .attr("stroke-opacity", 0.6);
    regionG
      .append("text")
      .attr("x", x(MIN_YEAR + (SPLIT_YEAR - MIN_YEAR) / 2))
      .attr("y", 12)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--muted)")
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .text("history");
    regionG
      .append("text")
      .attr("x", x(SPLIT_YEAR + (MAX_YEAR - SPLIT_YEAR) / 2))
      .attr("y", 12)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--muted)")
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .text("projected");
  }

  function renderLines() {
    const histGen = line<Pt>()
      .x((p) => x(p.year))
      .y((p) => y(p.v));

    // The projected segment starts from the 2024 historical value so the
    // dashed continuation connects visually to the solid history.
    const projPoints = (r: CountryRow): Pt[] => [r.hist[r.hist.length - 1], ...r.proj];
    const projGen = line<Pt>()
      .x((p) => x(p.year))
      .y((p) => y(p.v));

    for (const r of rows) {
      const stroke = LINE_COLOR;
      linesG
        .append("path")
        .attr("class", "hist")
        .attr("fill", "none")
        .attr("stroke", stroke)
        .attr("stroke-width", 1.5)
        .attr("d", histGen(r.hist));
      linesG
        .append("path")
        .attr("class", "proj")
        .attr("fill", "none")
        .attr("stroke", stroke)
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5 3")
        .attr("d", projGen(projPoints(r)));

      // Wide invisible hit area tracing history + projected continuation.
      const hitD = `${histGen(r.hist) ?? ""} ${projGen(projPoints(r)) ?? ""}`;
      hitsG
        .append("path")
        .attr("fill", "none")
        .attr("stroke", "transparent")
        .attr("stroke-width", 14)
        .style("pointer-events", "stroke")
        .style("cursor", "pointer")
        .attr("d", hitD)
        .on("mouseenter", () => onHover(r.code))
        .on("mouseleave", () => onHover(null))
        .on("click", () => onSelect(r.code));
    }
  }

  // Dim non-active lines; show the low/high band behind the active one.
  function highlight() {
    const active = getActive();
    linesG.selectAll<SVGPathElement, unknown>("path")
      .interrupt()
      .transition()
      .duration(150)
      .attr("stroke-opacity", (_d, i) => {
        // Paths are appended hist+proj per row, in `rows` order.
        const row = rows[Math.floor(i / 2)];
        return active == null || row.code === active ? 0.9 : 0.1;
      })
      .attr("stroke-width", (_d, i) => {
        const row = rows[Math.floor(i / 2)];
        return active === row.code ? 2.5 : 1.5;
      });

    // Low/high uncertainty band for the active country's projected segment.
    // bandG precedes linesG in DOM order, so lines draw on top of it.
    bandG.selectAll("*").remove();
    if (!active || innerHeight <= 0) return;
    const row = rows.find((r) => r.code === active);
    if (!row) return;
    const bandGen = area<BandPt>()
      .x((p) => x(p.year))
      .y0((p) => y(p.lo))
      .y1((p) => y(p.hi));
    bandG
      .append("path")
      .attr("fill", LINE_COLOR)
      .attr("fill-opacity", 0.15)
      .attr("d", bandGen(row.band));
  }

  return { render, highlight };
}
