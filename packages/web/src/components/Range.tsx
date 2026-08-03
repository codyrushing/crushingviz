import type { JSX } from "solid-js";

export interface RangeProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  class?: string;
  disabled?: boolean;
  ariaLabel?: string;
  onChange?: (value: number) => void;
}

export function Range(props: RangeProps) {
  const progress = () => {
    const min = props.min ?? 0;
    const max = props.max ?? 100;
    const clamped = Math.min(Math.max(props.value, min), max);
    return ((clamped - min) / (max - min)) * 100;
  };

  const rangeClass = [
    ...(props.class ? [props.class] : []),
    "h-4 block cursor-pointer appearance-none py-3",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    `[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-surface`,
    `[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-surface`,
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent",
    "[&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent"
  ].join(" ");

  return (
    <input
      type="range"
      class={[
        rangeClass
      ].join(' ')}
      min={props.min}
      max={props.max}
      step={props.step}
      value={props.value}
      disabled={props.disabled}
      aria-label={props.ariaLabel}
      style={{ "--cv-progress": `${progress()}%` } as JSX.CSSProperties}
      onInput={(e) => props.onChange?.(Number(e.currentTarget.value))}
    />
  );
}
