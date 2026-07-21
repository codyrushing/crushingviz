import { children, createEffect, type ParentProps } from "solid-js"
import { scrollY } from "../state/scroll";

export const ScrollActiveElement = (props: ParentProps) => {
  const resolvedChildren = children(() => props.children);
  createEffect(
    () => {
      console.log("Scroll Y position is", scrollY());
    }
  );
  return <div>
    Scroll active element
    { resolvedChildren() }
  </div>
}
