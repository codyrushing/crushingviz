import { createEffect } from "solid-js";
import { useElementVisibility } from "../../hooks/useElementVisibility";

export function DisasterImpactViz() {
  const { isVisible, intersectionRatio, hiddenAbove, hiddenBelow, ref } =
    useElementVisibility();

  createEffect(() => {
    console.log(
      "visible:",
      isVisible(),
      "ratio:",
      intersectionRatio(),
      "above:",
      hiddenAbove(),
      "below:",
      hiddenBelow(),
    );
  });

  return (
    <div class="h-screen" ref={ref}>
      {isVisible() ? (
        <p>
          active
        </p>
      ) : (
        <p>
          inactive
        </p>
      )}
    </div>
  );
}
