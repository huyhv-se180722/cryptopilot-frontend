import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { classNames } from '../../utils/class-names';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  onSelect: () => void;
}

/**
 * Dropdown menu (menu button pattern): Enter/Space/ArrowDown open,
 * arrows move, Escape closes and returns focus, outside click closes.
 */
export function Menu({
  trigger,
  label,
  items,
  header,
  align = 'end',
  side = 'bottom',
}: {
  /** Visual content of the trigger button. */
  trigger: ReactNode;
  /** Accessible name of the trigger. */
  label: string;
  items: readonly MenuItem[];
  header?: ReactNode;
  align?: 'start' | 'end';
  /** Open below (default) or above the trigger, e.g. in a bottom dock. */
  side?: 'bottom' | 'top';
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const focusable = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const index = focusable.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusable[(index + 1) % focusable.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusable[(index - 1 + focusable.length) % focusable.length]?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex items-center rounded-full"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={classNames(
            'absolute z-50 min-w-52 overflow-hidden rounded-xl border border-line-strong bg-surface py-1 shadow-overlay',
            side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {header && (
            <div className="border-b border-line px-3 py-2.5">{header}</div>
          )}
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={classNames(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs pointer-coarse:py-3',
                item.tone === 'danger'
                  ? 'text-muted hover:bg-negative-soft hover:text-negative focus-visible:bg-negative-soft'
                  : 'text-fg-2 hover:bg-raised focus-visible:bg-raised',
              )}
            >
              {item.icon && (
                <span aria-hidden="true" className="text-muted-dim">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
