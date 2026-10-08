import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Kbd } from '../../components/ui/Kbd';
import { useCopy } from '../../hooks/use-copy';
import { classNames } from '../../utils/class-names';
import type { NavItem } from './navigation';

/** Figma ⌘K palette: jump to any destination by name. */
export function CommandPalette({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly NavItem[];
}) {
  const copy = useCopy();
  const navigate = useNavigate();
  const ref = useRef<HTMLDialogElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) =>
      copy.nav[item.labelKey].toLowerCase().includes(needle),
    );
  }, [items, query, copy]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  function close() {
    setQuery('');
    setActive(0);
    onOpenChange(false);
  }

  function go(item: NavItem | undefined) {
    if (!item) return;
    close();
    navigate(item.to);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[active]);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-label={copy.palette.open}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="mx-auto mt-[15vh] w-[calc(100vw-32px)] max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-surface p-0 text-fg shadow-overlay backdrop:bg-(--cp-backdrop) backdrop:backdrop-blur-sm"
    >
      <div
        aria-hidden="true"
        className="h-px bg-linear-to-r from-transparent via-primary to-transparent"
      />
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <Search
          size={15}
          aria-hidden="true"
          className="shrink-0 text-muted-dim"
        />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={
            results[active] ? listId + '-' + active : undefined
          }
          aria-label={copy.palette.placeholder}
          placeholder={copy.palette.placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted-x"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div className="py-2">
        <div className="px-4 py-1.5 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
          {copy.palette.section}
        </div>
        <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto">
          {results.map((item, index) => {
            const Icon = item.icon;
            return (
              <li
                key={item.to}
                id={listId + '-' + index}
                role="option"
                aria-selected={index === active}
                onClick={() => go(item)}
                onMouseEnter={() => setActive(index)}
                className={classNames(
                  'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm',
                  index === active ? 'bg-raised text-primary' : 'text-fg-2',
                )}
              >
                <Icon size={13} aria-hidden="true" className="text-muted-dim" />
                {copy.nav[item.labelKey]}
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="px-4 py-3 text-xs text-muted-dim">
              {copy.palette.empty}
            </li>
          )}
        </ul>
      </div>
      <div className="border-t border-line px-4 py-3 text-[11px] text-muted-x">
        {copy.palette.hint}
      </div>
    </dialog>
  );
}
