import type { ReactNode } from 'react';
import { classNames } from '../../utils/class-names';

export interface KpiItem {
  id: string;
  label: string;
  value: ReactNode;
  /** The line under the value (a count, a limit, a source). */
  note?: ReactNode;
  /** Colours the value; the sign of the value is the caller's to show. */
  tone?: 'default' | 'positive' | 'negative';
  /** A small graphic under the value (a progress or win/loss bar). */
  extra?: ReactNode;
}

const tones = {
  default: 'text-fg',
  positive: 'text-positive',
  negative: 'text-negative',
} as const;

/**
 * One panel of key figures split into cells (T-141), in place of a row of
 * separate cards: a short uppercase label, the figure in mono and an
 * optional note. Two cells a row on a phone, as many as fit from 640 px.
 * An optional header line sits above the cells (a scope, a link).
 */
export function KpiStrip({
  label,
  items,
  header,
  className,
}: {
  /** Names the panel for assistive technology. */
  label: string;
  items: readonly KpiItem[];
  header?: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      className={classNames(
        'overflow-hidden rounded-xl border border-line bg-surface',
        className,
      )}
    >
      {header && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-[11.5px] text-muted-dim">
          {header}
        </div>
      )}
      <dl className="m-0 grid grid-cols-2 gap-px bg-line sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex min-w-0 flex-col gap-1.5 bg-surface px-4 py-3.5"
          >
            <dt className="text-[10.5px] font-semibold tracking-[0.06em] text-muted uppercase">
              {item.label}
            </dt>
            <dd
              className={classNames(
                'm-0 font-mono text-xl leading-tight font-semibold',
                tones[item.tone ?? 'default'],
              )}
            >
              {item.value}
            </dd>
            {item.extra}
            {item.note && (
              <dd className="m-0 text-[11.5px] text-muted-dim">{item.note}</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
