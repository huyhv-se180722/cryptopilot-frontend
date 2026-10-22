import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { classNames } from '../../../utils/class-names';

const PRESETS = [25, 50, 75, 100] as const;

/**
 * The share of the available balance an order uses, as the exchange's order
 * panel has it: a slider from 0 to 100 % with the share it is at, and the
 * 25 / 50 / 75 / 100 % marks to jump to beside it (below it on a narrow
 * panel), the one in use pressed. The arrow
 * keys move it by 1 %, Page Up / Down by 10 %, Home / End to the ends.
 */
export function ShareSlider({
  value,
  disabled,
  onChange,
}: {
  /** Whole percent, 0 to 100. */
  value: number;
  disabled: boolean;
  onChange: (percent: number) => void;
}) {
  const p = useCopy().paper;
  const shown = formatCopy(p.sharePercent, { percent: value });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex min-w-40 flex-1 items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          disabled={disabled}
          aria-label={p.shareLabel}
          aria-valuetext={shown}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-(--cp-primary) disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:h-11"
        />
        <span
          aria-hidden="true"
          className="w-10 shrink-0 text-right font-mono text-[11px] text-fg-2"
        >
          {shown}
        </span>
      </div>
      <div
        role="group"
        aria-label={p.sharePresets}
        className="grid w-full grid-cols-4 gap-1 sm:w-auto"
      >
        {PRESETS.map((percent) => (
          <button
            key={percent}
            type="button"
            disabled={disabled}
            aria-pressed={value === percent}
            onClick={() => onChange(percent)}
            className={classNames(
              'h-6 rounded-md border px-2 text-[11px] font-medium disabled:opacity-50 pointer-coarse:h-9',
              value === percent
                ? 'border-primary-line bg-primary-soft text-primary'
                : 'border-line text-muted hover:border-primary-line hover:text-primary',
            )}
          >
            {formatCopy(p.sharePercent, { percent })}
          </button>
        ))}
      </div>
    </div>
  );
}
