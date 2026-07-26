import { batch, createEffect, createSignal, onCleanup } from "solid-js";

export const useElementVisibility = () => {
  const [isVisible, setIsVisible] = createSignal(false);
  const [intersectionRatio, setIntersectionRatio] = createSignal(0);
  const [hiddenAbove, setHiddenAbove] = createSignal(0);
  const [hiddenBelow, setHiddenBelow] = createSignal(0);
  let element: HTMLElement | undefined;

  createEffect(() => {
    if (!element) return;
    const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);
    const observer = new IntersectionObserver(
      ([entry]) => {
        batch(() => {
          setIsVisible(entry.isIntersecting);
          setIntersectionRatio(entry.intersectionRatio);

          const elHeight = entry.boundingClientRect.height;
          const vpTop = entry.rootBounds!.top;
          const elTop = entry.boundingClientRect.top;
          const vpBottom = entry.rootBounds!.bottom;
          const elBottom = entry.boundingClientRect.bottom;

          setHiddenAbove(Math.max(0, (vpTop - elTop) / elHeight));
          setHiddenBelow(Math.max(0, (elBottom - vpBottom) / elHeight));
        });
      },
      { threshold: thresholds },
    );
    observer.observe(element);
    onCleanup(() => observer.disconnect());
  });

  return {
    isVisible,
    intersectionRatio,
    hiddenAbove,
    hiddenBelow,
    ref: (el: HTMLElement) => {
      element = el;
    },
  } as const;
};
