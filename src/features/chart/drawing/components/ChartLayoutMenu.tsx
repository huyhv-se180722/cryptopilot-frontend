import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Dialog } from '../../../../components/ui/Dialog';
import { useCopy } from '../../../../hooks/use-copy';
import { useToast } from '../../../../hooks/use-toast';
import { formatCopy } from '../../../../i18n/copy';
import { problemOf } from '../../../../services/api/errors';
import type { ChartLayout } from '../../../../types/domain';
import { classNames } from '../../../../utils/class-names';
import { layoutName } from '../layout-name';
import { MENU_WIDTH, panelPlace } from '../panel-place';
import type { DrawingLayer } from '../use-drawing-layer';

/** A pair without layouts shows the "Copy 1" its first drawing opens. */
const FIRST: ChartLayout = {
  id: '',
  pairId: '',
  number: 1,
  name: null,
  drawings: 0,
};

const ICON_BUTTON =
  'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-fg-2 disabled:opacity-40';

/**
 * The copies of a pair's chart (D-149): each a layout with its own drawings.
 * The menu shows the copy in view, switches to another, renames one in
 * place (a blank name brings back "Copy n"), removes one after a
 * confirmation, and opens a new copy, empty or duplicating the one in view.
 */
export function ChartLayoutMenu({
  layer,
  symbol,
}: {
  layer: DrawingLayer;
  symbol: string;
}) {
  const d = useCopy().drawing;
  const l = d.layouts;
  const { show } = useToast();
  const { layouts } = layer;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [removing, setRemoving] = useState<ChartLayout | null>(null);
  const [busy, setBusy] = useState(false);
  // Where the panel sits: under the trigger's left edge, moved back inside
  // the viewport when it would spill past either side (the toolbar on one
  // line at 100% pushes the trigger far right and cut off the rename field),
  // and narrower than its 288 px on a screen that cannot hold it.
  const [place, setPlace] = useState({ left: 0, width: MENU_WIDTH });
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const trigger = root.current?.getBoundingClientRect();
      if (!trigger) return;
      setPlace(panelPlace(trigger.left, window.innerWidth));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setEditing(null);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const active = layouts.active ?? FIRST;
  const rows = layouts.list.length > 0 ? layouts.list : [FIRST];
  const name = (layout: ChartLayout) => layoutName(layout, l.defaultName);
  // The copy in view counts its drawings as they change.
  const countOf = (layout: ChartLayout) =>
    layout.id === active.id ? layer.count : layout.drawings;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      show({
        tone: 'error',
        message:
          problemOf(error)?.code === 'CHART_LAYOUT_LIMIT_REACHED'
            ? l.limitReached
            : l.failed,
      });
    } finally {
      setBusy(false);
    }
  };

  const openNew = (duplicate: boolean) =>
    run(async () => {
      const current = await layouts.ensure();
      await layouts.create(duplicate ? current : undefined);
      setOpen(false);
    });

  const saveName = (layout: ChartLayout) =>
    run(async () => {
      const id = layout.id || (await layouts.ensure());
      await layouts.rename(id, draft.trim() === '' ? null : draft.trim());
      setEditing(null);
    });

  const startEditing = (layout: ChartLayout) => {
    setEditing(layout.id);
    setDraft(layout.name ?? '');
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={formatCopy(l.menuLabel, { symbol })}
        title={formatCopy(l.menuLabel, { symbol })}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-7 max-w-48 items-center gap-1.5 rounded-md border border-line px-2 text-xs font-medium text-fg-2 hover:bg-raised pointer-coarse:h-9"
      >
        <Layers size={13} aria-hidden="true" />
        <span className="truncate">{name(active)}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="group"
          aria-label={formatCopy(l.menuLabel, { symbol })}
          style={{ left: place.left, width: place.width }}
          className="absolute top-full z-30 mt-1 rounded-lg border border-line bg-surface p-1 shadow-overlay"
        >
          <ul className="flex flex-col">
            {rows.map((layout) => (
              <li
                key={layout.id || 'first'}
                className={classNames(
                  'flex items-center gap-1 rounded-md pr-1',
                  layout.id === active.id && 'bg-primary-soft',
                )}
              >
                {editing === layout.id ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-1 py-1 pl-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveName(layout);
                    }}
                  >
                    <input
                      autoFocus
                      aria-label={l.nameLabel}
                      value={draft}
                      maxLength={60}
                      placeholder={formatCopy(l.namePlaceholder, {
                        n: layout.number,
                      })}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.stopPropagation();
                          setEditing(null);
                        }
                      }}
                      className="h-7 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-xs text-fg outline-none focus-visible:border-primary"
                    />
                    <button
                      type="submit"
                      aria-label={l.saveName}
                      title={l.saveName}
                      disabled={busy}
                      className={ICON_BUTTON}
                    >
                      <Check size={14} aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-pressed={layout.id === active.id}
                      onClick={() => {
                        if (layout.id) layouts.select(layout.id);
                        setOpen(false);
                      }}
                      className="flex min-w-0 flex-1 flex-col items-start px-2 py-1.5 text-left"
                    >
                      <span
                        className={classNames(
                          'max-w-full truncate text-xs',
                          layout.id === active.id
                            ? 'font-medium text-primary'
                            : 'text-fg-2',
                        )}
                      >
                        {name(layout)}
                      </span>
                      <span className="text-xs text-muted">
                        {formatCopy(l.drawingCount, {
                          count: countOf(layout),
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={formatCopy(l.rename, { name: name(layout) })}
                      title={formatCopy(l.rename, { name: name(layout) })}
                      onClick={() => startEditing(layout)}
                      className={ICON_BUTTON}
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                    {layout.id && (
                      <button
                        type="button"
                        aria-label={formatCopy(l.remove, {
                          name: name(layout),
                        })}
                        title={formatCopy(l.remove, { name: name(layout) })}
                        onClick={() => {
                          setRemoving(layout);
                          setOpen(false);
                        }}
                        className={ICON_BUTTON}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-1 flex flex-col border-t border-line pt-1">
            <button
              type="button"
              disabled={busy || layouts.full}
              onClick={() => void openNew(false)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-fg-2 hover:bg-raised disabled:opacity-40"
            >
              <Plus size={14} aria-hidden="true" />
              {l.newCopy}
            </button>
            <button
              type="button"
              disabled={busy || layouts.full}
              onClick={() => void openNew(true)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-fg-2 hover:bg-raised disabled:opacity-40"
            >
              <Copy size={14} aria-hidden="true" />
              {l.duplicate}
            </button>
            {layouts.full && (
              <p className="px-2 py-1 text-xs text-muted">{l.limitHint}</p>
            )}
          </div>
        </div>
      )}
      <Dialog
        open={removing !== null}
        onOpenChange={(value) => !value && setRemoving(null)}
        title={formatCopy(l.removeTitle, {
          name: removing ? name(removing) : '',
        })}
        description={formatCopy(l.removeBody, {
          count: removing ? countOf(removing) : 0,
        })}
        size="sm"
        accent="negative"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {d.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                removing &&
                void run(async () => {
                  await layouts.remove(removing.id);
                  setRemoving(null);
                })
              }
            >
              {l.removeConfirm}
            </Button>
          </>
        }
      />
    </div>
  );
}
