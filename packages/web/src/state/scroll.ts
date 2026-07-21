import { createSignal } from "solid-js";
import { isServer } from "solid-js/web";
import { debounce } from "../utils/event";

export const [scrollY, setScrollY] = isServer
  ? [() => 0, () => {}]
  : createSignal(0);

if (!isServer) {
  const handler = debounce(() => setScrollY(window.scrollY), 200);
  handler();
  window.addEventListener("scroll", handler);
}
