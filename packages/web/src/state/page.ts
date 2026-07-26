import { createSignal } from "solid-js";
import { isServer } from "solid-js/web";
import { debounce } from "../utils/event";

export const [scrollY, setScrollY] = isServer
  ? [() => 0, () => {}]
  : createSignal(window.scrollY);

export const [viewportDimensions, setViewportDimensions] = isServer
  ? [() => 0, () => {}]
  : createSignal([window.innerWidth, window.innerHeight]);


if (!isServer) {
  const scrollHandler = debounce(() => {
    setScrollY(window.scrollY)
  }, 200);
  window.addEventListener("scroll", scrollHandler);

  const resizeHandler = debounce(() => {
    setViewportDimensions([window.innerWidth, window.innerHeight]);
  }, 200);
  window.addEventListener("resize", resizeHandler)
}
