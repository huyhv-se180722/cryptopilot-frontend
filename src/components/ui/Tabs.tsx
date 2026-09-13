import { useId, type KeyboardEvent, type ReactNode } from 'react';
export interface TabItem {
  id: string;
  label: string;
  panel: ReactNode;
  disabled?: boolean;
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
      <div className="tabs" role="tablist" aria-label={label}>
        {items.map((item) => (
          <button
            type="button"
            role="tab"
            key={item.id}
            id={prefix + '-tab-' + item.id}
            aria-selected={active === item.id}
            aria-controls={prefix + '-panel-' + item.id}
            tabIndex={active === item.id ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, item.id)}
          >
            {item.label}
          </button>
        ))}
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
