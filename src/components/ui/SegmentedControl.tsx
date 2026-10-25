import type { ReactNode } from 'react';
import { classNames } from '../../utils/class-names';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Colours the chosen segment: up / long green, down / short red. */
  tone?: 'positive' | 'negative';
}

const SELECTED = {
  neutral: 'bg-raised-hover text-primary dark:shadow-glow-primary',
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative',
} as const;

/**
 * Figma theme-toggle style segmented control (radio group semantics).
 * With `iconOnly`, labels become accessible names and tooltips.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  iconOnly = false,
}: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  iconOnly?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center rounded-lg border border-line bg-raised p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            onClick={() => onChange(option.value)}
            className={classNames(
              'inline-flex h-6 items-center justify-center gap-1 rounded text-[11px] font-medium pointer-coarse:h-9',
              iconOnly ? 'w-6 pointer-coarse:w-9' : 'px-2.5',
              selected
                ? SELECTED[option.tone ?? 'neutral']
                : 'text-muted-dim hover:text-fg-2',
            )}
          >
            {option.icon}
            {!iconOnly && option.label}
          </button>
        );
      })}
    </div>
  );
}
