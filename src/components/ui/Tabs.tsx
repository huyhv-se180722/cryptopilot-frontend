import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { classNames } from '../../utils/class-names';

export interface TabItem {
  id: string;
  label: string;
  panel: ReactNode;
  disabled?: boolean;
  /** Optional count shown after the label (e.g. plans per status). */
  count?: number;
  /** Optional 15px icon before the label (vertical settings list). */
  icon?: ReactNode;
}

/**
 * `vertical` is the Figma Settings list: a 200px column left of the panel
 * from `md`, a scrolling row of labels above it on narrow screens.
 */
export function Tabs({
  label,
  items,
  value,
  onChange,
  orientation = 'horizontal',
}: {
  label: string;
  items: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  orientation?: 'horizontal' | 'vertical';
}) {
  const vertical = orientation === 'vertical';
  const prefix = useId();
  const enabled = items.filter((item) => !item.disabled);
  const active = enabled.some((item) => item.id === value)
    ? value
    : enabled[0]?.id;
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const index = enabled.findIndex((item) => item.id === id);
    let next: TabItem | undefined;
    if (event.key === 'ArrowRight' || (vertical && event.key === 'ArrowDown'))
      next = enabled[(index + 1) % enabled.length];
    else if (event.key === 'ArrowLeft' || (vertical && event.key === 'ArrowUp'))
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
    <div className={vertical ? 'md:flex md:items-start md:gap-8' : undefined}>
      <div
        className={classNames(
          'mb-4 flex gap-1 overflow-x-auto border-b border-line',
          vertical &&
            'md:mb-0 md:w-[200px] md:shrink-0 md:flex-col md:gap-0.5 md:overflow-visible md:border-r md:border-b-0 md:pr-3',
        )}
        role="tablist"
        aria-label={label}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
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
                vertical &&
                  'md:w-full md:gap-2.5 md:rounded-md md:border-l-2 md:px-2.5 md:text-left md:text-[13px]',
                vertical &&
                  (selected
                    ? 'md:border-primary md:bg-raised-hover'
                    : 'md:border-transparent md:font-normal md:hover:bg-surface-alt'),
              )}
            >
              {item.icon && (
                <span
                  aria-hidden="true"
                  className={classNames(
                    // The narrow row keeps every label in view without icons.
                    vertical ? 'hidden md:flex' : 'flex',
                    selected ? 'opacity-100' : 'opacity-70',
                  )}
                >
                  {item.icon}
                </span>
              )}
              {item.label}
              {item.count !== undefined && (
                <span className="rounded-full bg-raised px-1.5 font-mono text-[10px] text-muted-dim">
                  {item.count}
                </span>
              )}
              {selected && (
                <span
                  aria-hidden="true"
                  className={classNames(
                    'absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary',
                    vertical && 'md:hidden',
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          className={vertical ? 'md:min-w-0 md:flex-1' : undefined}
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
