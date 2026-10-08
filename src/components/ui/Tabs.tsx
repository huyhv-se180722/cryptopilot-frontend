import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { classNames } from '../../utils/class-names';

export interface TabItem {
  id: string;
  label: string;
  panel: ReactNode;
  disabled?: boolean;
  /** Optional count shown after the label (e.g. plans per status). */
  count?: number;
}
export function Tabs({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const prefix = useId();
  const enabled = items.filter((item) => !item.disabled);
  const active = enabled.some((item) => item.id === value)
    ? value
    : enabled[0]?.id;
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const index = enabled.findIndex((item) => item.id === id);
    let next: TabItem | undefined;
    if (event.key === 'ArrowRight')
      next = enabled[(index + 1) % enabled.length];
    else if (event.key === 'ArrowLeft')
      next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    if (next) {
      event.preventDefault();
      onChange(next.id);
      document.getElementById(prefix + '-tab-' + next.id)?.focus();
    }
  }
  return (
    <div>
      <div
        className="mb-4 flex gap-1 overflow-x-auto border-b border-line"
        role="tablist"
        aria-label={label}
      >
        {items.map((item) => {
          const selected = active === item.id;
          return (
            <button
              type="button"
              role="tab"
              key={item.id}
              id={prefix + '-tab-' + item.id}
              aria-selected={selected}
              aria-controls={prefix + '-panel-' + item.id}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => onKeyDown(event, item.id)}
              className={classNames(
                'relative flex h-9 shrink-0 items-center gap-1.5 px-3 text-xs font-medium whitespace-nowrap pointer-coarse:h-11',
                selected ? 'text-primary' : 'text-muted hover:text-fg-2',
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span className="rounded-full bg-raised px-1.5 font-mono text-[10px] text-muted-dim">
                  {item.count}
                </span>
              )}
              {selected && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          role="tabpanel"
          tabIndex={0}
          key={item.id}
          id={prefix + '-panel-' + item.id}
          aria-labelledby={prefix + '-tab-' + item.id}
          hidden={active !== item.id}
        >
          {item.panel}
        </div>
      ))}
    </div>
  );
}
