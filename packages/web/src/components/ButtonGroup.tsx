import { For } from "solid-js";

export interface ButtonGroupOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

export interface ButtonGroupProps<T extends string> {
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md"
}

export function ButtonGroup<T extends string>(props: ButtonGroupProps<T>) {
  const isActive = (option: ButtonGroupOption<T>) => option.value === props.value;
  const size = props.size ?? "md";
  return (
    <div class="flex rounded-lg border border-neutral-700 overflow-hidden" role="group">
      <For each={props.options}>
        {(option) => (
          <button
            type="button"
            title={option.title}
            aria-pressed={isActive(option)}
            classList={{
              "flex-grow leading-none text-[12px] md:text-xs whitespace-nowrap transition-colors border-l border-border first:border-l-0 cursor-pointer": true,
              "px-3 py-1.5": size === "md",
              "text-[10px] md:text-[11px] px-2 py-1": size === "sm",
              "bg-neutral-700 text-white": isActive(option),
              "bg-background text-neutral-400 hover:text-white hover:bg-neutral-800": !isActive(option),
            }}
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  );
}
