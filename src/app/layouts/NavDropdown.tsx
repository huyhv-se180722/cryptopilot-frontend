import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useCopy } from '../../hooks/use-copy';
import { classNames } from '../../utils/class-names';
import type { NavItem } from './navigation';

/**
 * A TopNav entry that opens a list of destinations (the AI topics). The list
 * is placed `fixed` under the trigger, because the nav row scrolls sideways
 * and would clip it; it closes on a pick, Escape, an outside click, a scroll
 * or a resize.
 */
export function NavDropdown({ item }: { item: NavItem }) {
  const copy = useCopy();
  const { pathname } = useLocation();
  const [place, setPlace] = useState<{ top: number; left: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const children = item.children ?? [];
  const active = pathname === item.to || pathname.startsWith(item.to + '/');
  const open = place !== null;
  const Icon = item.icon;
  const label = copy.nav[item.labelKey];

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPlace({ top: rect.bottom, left: rect.left });
  }

  function close(focusTrigger = false) {
    setPlace(null);
    if (focusTrigger) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('a')?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !listRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      )
        setPlace(null);
    };
    const onMove = () => setPlace(null);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const links = [
      ...(listRef.current?.querySelectorAll<HTMLElement>('a') ?? []),
    ];
    const index = links.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      links[(index + 1) % links.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      links[(index - 1 + links.length) % links.length]?.focus();
    } else if (event.key === 'Tab') {
      setPlace(null);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            show();
          }
        }}
        className={classNames(
          'relative flex h-[52px] shrink-0 items-center gap-1.5 px-2.5 text-[12px] font-medium whitespace-nowrap min-[1400px]:px-2 2xl:px-3',
          active ? 'text-primary' : 'text-muted hover:text-fg-2',
        )}
      >
        <Icon
          size={13}
          aria-hidden="true"
          className={active ? undefined : 'opacity-60'}
        />
        <span className="sr-only min-[1400px]:not-sr-only">{label}</span>
        <ChevronDown
          size={11}
          aria-hidden="true"
          className={classNames(
            'transition-transform',
            open && 'rotate-180',
            !active && 'opacity-60',
          )}
        />
        {active && (
          <span
            aria-hidden="true"
            className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary dark:bg-linear-to-r dark:from-primary dark:to-accent dark:shadow-glow-primary"
          />
        )}
      </button>
      {place && (
        <div
          ref={listRef}
          id={listId}
          role="menu"
          aria-label={copy.nav.aiMenu}
          onKeyDown={onListKeyDown}
          style={{ top: place.top + 4, left: place.left }}
          className="fixed z-50 min-w-56 overflow-hidden rounded-xl border border-line-strong bg-surface py-1 shadow-overlay"
        >
          {children.map((child) => {
            const ChildIcon = child.icon;
            return (
              <NavLink
                key={child.to}
                to={child.to}
                role="menuitem"
                tabIndex={-1}
                onClick={() => close()}
                className={({ isActive }) =>
                  classNames(
                    'flex items-center gap-2.5 px-3 py-2.5 text-xs no-underline pointer-coarse:py-3',
                    isActive
                      ? 'bg-primary-soft font-semibold text-primary'
                      : 'text-fg-2 hover:bg-raised focus-visible:bg-raised',
                  )
                }
              >
                <ChildIcon size={14} aria-hidden="true" />
                {copy.nav[child.labelKey]}
              </NavLink>
            );
          })}
        </div>
      )}
    </>
  );
}
