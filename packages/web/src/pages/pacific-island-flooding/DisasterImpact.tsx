import { createEffect, For } from "solid-js";
import { select } from "d3-selection";
import { useElementVisibility } from "../../hooks/useElementVisibility";
import { countries } from "./data";

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
    <div class="h-screen flex" ref={ref}>
      <div class="chart-container flex-1" ref={chartContainer}></div>
      <CountriesKey />
    </div>
  );
}

function CountriesKey() {
  return <div class="p-4 flex flex-col">
    <For each={Object.entries(countries)}>{
      ([code, country]) => <div class="flex-1">
        {country.name} {country.flag}
      </div>
    }</For>
  </div>

}

function DisasterImpactChart(container:HTMLElement) {
  const root = select(container);

  function init() {

  }

  return {
    init
  }
}
