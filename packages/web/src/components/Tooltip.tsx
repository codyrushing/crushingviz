import { createEffect, createSignal, Show } from "solid-js";
import type { JSX, ComponentProps } from "solid-js";

type TooltipProps = {
  content: JSX.Element;
  children: JSX.Element;
  position?: "left" | "right" | "top" | "bottom";
  forceOpen?: boolean;
  disabled?: boolean;
} & Pick<ComponentProps<'span'>, "class" | "classList">

const positionClasses: Record<NonNullable<TooltipProps["position"]>, string> = {
  left: "right-full mr-2 top-1/2 -translate-y-1/2",
  right: "left-full ml-2 top-1/2 -translate-y-1/2",
  top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
  bottom: "top-full mt-2 left-1/2 -translate-x-1/2"
};

export function Tooltip(props: TooltipProps) {
  const [isOpen, setIsOpen] = createSignal(false);

  // When a forceOpen lock is released (e.g. a selection is cleared), close the
  // tooltip even if the cursor is still hovering it.
  createEffect(() => {
    if (!props.forceOpen) setIsOpen(false);
  });

  const wrapperClasses = ["relative inline-flex", ...(props.class ? [props.class] : [])].join(" ");
  return (
    <span
      classList={props.classList}
      class={wrapperClasses}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {props.children}
      <Show when={!props.disabled && (props.forceOpen || isOpen())}>
        <span
          class={`absolute z-10 text-xs bg-black text-white px-2 py-1 rounded ${positionClasses[props.position ?? "left"]}`}
        >
          {props.content}
        </span>
      </Show>
    </span>
  );
}
