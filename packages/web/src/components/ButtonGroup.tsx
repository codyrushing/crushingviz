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
}

export function ButtonGroup<T extends string>(props: ButtonGroupProps<T>) {
  const isActive = (option: ButtonGroupOption<T>) => option.value === props.value;

  return (
    <div class="flex rounded-lg border border-neutral-700 overflow-hidden" role="group">
      <For each={props.options}>
        {(option) => (
          <button
            type="button"
            title={option.title}
            aria-pressed={isActive(option)}
            classList={{
              "flex-grow px-3 py-1.5 text-xs whitespace-nowrap transition-colors border-l border-border first:border-l-0 cursor-pointer": true,
              "bg-neutral-700 text-white": isActive(option),
              "bg-transparent text-neutral-400 hover:text-white hover:bg-neutral-800": !isActive(option),
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
