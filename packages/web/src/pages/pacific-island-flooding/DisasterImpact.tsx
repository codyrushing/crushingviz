import { createEffect, For } from "solid-js";
import { select } from "d3-selection";
import { useElementVisibility } from "../../hooks/useElementVisibility";
import { countries, GDPByCountry } from "./data";
import type { GDPData } from "./data";
import { scaleLinear, scaleSequential } from "d3-scale";
import { interpolateRdYlBu } from "d3-scale-chromatic";
import * as d3Array from "d3-array"
import { Tooltip } from "../../components/Tooltip";

export function DisasterImpact() {
  const { isVisible, intersectionRatio, hiddenAbove, hiddenBelow, ref } =
    useElementVisibility();
  let chartContainer!: HTMLDivElement;
  let chart: ReturnType<typeof DisasterImpactChart> | undefined;
  createEffect(
    () => {
      chart = DisasterImpactChart(chartContainer);
    }
  );

  return (
    <div class="h-screen flex font-monospace" ref={ref}>
      <div class="chart-container flex-1" ref={chartContainer}></div>
      <CountriesKey />
    </div>
  );
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

function DisasterImpactChart(container:HTMLElement) {
  const root = select(container);

  function init() {

  }

  return {
    init
  }
}
