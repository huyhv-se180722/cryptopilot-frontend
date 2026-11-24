import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Magnet,
  PenLine,
  Redo2,
  Trash,
  Undo2,
} from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Dialog } from '../../../../components/ui/Dialog';
import { useCopy } from '../../../../hooks/use-copy';
import { formatCopy } from '../../../../i18n/copy';
import { classNames } from '../../../../utils/class-names';
import { TOOL_GROUPS, type ToolGroupId, type ToolId } from '../tools';
import { layoutName } from '../layout-name';
import type { DrawingLayer } from '../use-drawing-layer';
import { TOOL_ICONS } from './tool-icons';

const BUTTON =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-md disabled:opacity-40';

function BarButton({
  label,
  pressed,
  onClick,
  disabled,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      disabled={disabled}
      onClick={onClick}
      className={classNames(
        BUTTON,
        pressed
          ? 'bg-primary-soft text-primary'
          : 'text-muted hover:bg-raised hover:text-fg-2',
      )}
    >
      {children}
    </button>
  );
}

/**
 * The drawing bar on the left of the chart (D-149 (3)): one button per
 * group of tools, opening on the tool used last in it, with the other tools
 * of the group in a menu; then magnet, stay in drawing mode, lock and hide
 * all, undo, redo and remove all. Hidden on touch screens, which only show
 * the drawings.
 */
export function DrawingToolbar({
  layer,
  symbol,
}: {
  layer: DrawingLayer;
  symbol: string;
}) {
  const d = useCopy().drawing;
  const [recent, setRecent] = useState<Record<ToolGroupId, ToolId>>(
    () =>
      Object.fromEntries(
        TOOL_GROUPS.map((group) => [group.id, group.tools[0]]),
      ) as Record<ToolGroupId, ToolId>,
  );
  const [open, setOpen] = useState<ToolGroupId | null>(null);
  const [confirming, setConfirming] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  // A press outside the bar closes its menu.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!bar.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const choose = (group: ToolGroupId, tool: ToolId) => {
    setRecent((current) => ({ ...current, [group]: tool }));
    layer.setTool(tool);
    setOpen(null);
  };

  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label={d.toolbarLabel}
      aria-orientation="vertical"
      className="flex shrink-0 flex-col items-center gap-0.5 border-r border-line pr-1 pointer-coarse:hidden"
    >
      {TOOL_GROUPS.map((group) => {
        const current = recent[group.id];
        return (
          <div key={group.id} className="relative flex items-center">
            <BarButton
              label={d.tools[current]}
              pressed={layer.tool === current}
              onClick={() =>
                layer.setTool(layer.tool === current ? null : current)
              }
            >
              {TOOL_ICONS[current]}
            </BarButton>
            {group.tools.length > 1 && (
              <button
                type="button"
                aria-label={formatCopy(d.moreTools, {
                  group: d.groups[group.id],
                })}
                title={formatCopy(d.moreTools, { group: d.groups[group.id] })}
                aria-haspopup="menu"
                aria-expanded={open === group.id}
                onClick={() => setOpen(open === group.id ? null : group.id)}
                className="inline-flex h-8 w-3 items-center justify-center text-muted-dim hover:text-fg-2"
              >
                <ChevronRight size={10} aria-hidden="true" />
              </button>
            )}
            {open === group.id && (
              <div
                role="menu"
                aria-label={d.groups[group.id]}
                className="absolute top-0 left-full z-20 ml-1 flex min-w-44 flex-col rounded-lg border border-line bg-surface p-1 shadow-overlay"
              >
                {group.tools.map((tool: ToolId) => (
                  <button
                    key={tool}
                    type="button"
                    role="menuitemradio"
                    aria-checked={layer.tool === tool}
                    onClick={() => choose(group.id, tool)}
                    className={classNames(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                      layer.tool === tool
                        ? 'bg-primary-soft text-primary'
                        : 'text-fg-2 hover:bg-raised',
                    )}
                  >
                    {TOOL_ICONS[tool]}
                    {d.tools[tool]}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />
      <BarButton
        label={d.magnet}
        pressed={layer.options.magnet}
        onClick={() => layer.setOption('magnet', !layer.options.magnet)}
      >
        <Magnet size={16} aria-hidden="true" />
      </BarButton>
      <BarButton
        label={d.stayInDrawing}
        pressed={layer.options.stayInDrawing}
        onClick={() =>
          layer.setOption('stayInDrawing', !layer.options.stayInDrawing)
        }
      >
        <PenLine size={16} aria-hidden="true" />
      </BarButton>
      <BarButton
        label={d.lockAll}
        pressed={layer.options.lockAll}
        onClick={() => layer.setOption('lockAll', !layer.options.lockAll)}
      >
        {layer.options.lockAll ? (
          <Lock size={16} aria-hidden="true" />
        ) : (
          <LockOpen size={16} aria-hidden="true" />
        )}
      </BarButton>
      <BarButton
        label={d.hideAll}
        pressed={layer.options.hideAll}
        onClick={() => layer.setOption('hideAll', !layer.options.hideAll)}
      >
        {layer.options.hideAll ? (
          <EyeOff size={16} aria-hidden="true" />
        ) : (
          <Eye size={16} aria-hidden="true" />
        )}
      </BarButton>
      {layer.hiddenCount > 0 && (
        <BarButton
          label={formatCopy(d.showHidden, { count: layer.hiddenCount })}
          onClick={layer.showHidden}
        >
          <span className="relative">
            <EyeOff size={16} aria-hidden="true" />
            <span className="absolute -top-1.5 -right-2 rounded-full bg-primary px-1 text-xs leading-3 text-white">
              {layer.hiddenCount}
            </span>
          </span>
        </BarButton>
      )}
      <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />
      <BarButton label={d.undo} onClick={layer.undo} disabled={!layer.canUndo}>
        <Undo2 size={16} aria-hidden="true" />
      </BarButton>
      <BarButton label={d.redo} onClick={layer.redo} disabled={!layer.canRedo}>
        <Redo2 size={16} aria-hidden="true" />
      </BarButton>
      <BarButton
        label={d.removeAll}
        onClick={() => setConfirming(true)}
        disabled={layer.count === 0}
      >
        <Trash size={16} aria-hidden="true" />
      </BarButton>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={d.removeAllTitle}
        description={formatCopy(d.removeAllBody, {
          symbol,
          layout: layoutName(layer.layouts.active, d.layouts.defaultName),
        })}
        size="sm"
        accent="negative"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {d.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                layer.removeAll();
                setConfirming(false);
              }}
            >
              {d.removeAllConfirm}
            </Button>
          </>
        }
      />
    </div>
  );
}
