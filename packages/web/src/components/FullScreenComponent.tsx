import { children, type ParentProps } from "solid-js";

export function FullScreenComponent(props: ParentProps) {
  const resolvedChildren = children(() => props.children);
  return <div class="h-screen w-full">
    { resolvedChildren() }
  </div>
}
