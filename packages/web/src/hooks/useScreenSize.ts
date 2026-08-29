import { createEffect, createSignal, onCleanup } from "solid-js";

// Debounced ResizeObserver hook. Returns a ref to attach to an element and a
// signal that fires (debounced) with the element's width/height whenever it
// changes size.
export const useScreenSize = (debounceMs = 300) => {
  const [size, setSize] = createSignal({ width: 0, height: 0 });
  let element: HTMLElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    if (!element) return;
    // Emit immediately so the first render isn't delayed.
    setSize({ width: element.clientWidth, height: element.clientHeight });
    const ro = new ResizeObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!element) return;
        setSize({ width: element.clientWidth, height: element.clientHeight });
      }, debounceMs);
    });
    ro.observe(element);
    onCleanup(() => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
    });
  });

  return {
    size,
    ref: (el: HTMLElement) => {
      element = el;
    },
  } as const;
};
