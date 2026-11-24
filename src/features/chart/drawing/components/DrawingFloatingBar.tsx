import { useState } from 'react';
import { EyeOff, Lock, LockOpen, Settings2, Trash } from 'lucide-react';
import { useCopy } from '../../../../hooks/use-copy';
import { formatCopy } from '../../../../i18n/copy';
import type { ChartDrawing, DrawingLineStyle } from '../../../../types/domain';
import { classNames } from '../../../../utils/class-names';
import { PALETTE } from '../tools';
import type { DrawingLayer } from '../use-drawing-layer';
import { DrawingSettingsDialog } from './DrawingSettingsDialog';

const ICON_BUTTON =
  'inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-fg-2 disabled:opacity-40';
const LINE_STYLES: readonly DrawingLineStyle[] = ['SOLID', 'DASHED', 'DOTTED'];

/**
 * The bar over the chart while a drawing is selected (D-149 (3)): colour,
 * line width and style, settings, lock, hide and remove. A locked drawing
 * only offers to be unlocked.
 */
export function DrawingFloatingBar({
  layer,
  drawing,
}: {
  layer: DrawingLayer;
  drawing: ChartDrawing;
}) {
  const d = useCopy().drawing;
  const [palette, setPalette] = useState(false);
  const [settings, setSettings] = useState(false);
  const locked = drawing.locked || layer.options.lockAll;
  const style = drawing.style;
  const restyle = (change: Partial<ChartDrawing['style']>) =>
    layer.updateSelected({ style: { ...style, ...change } });

  return (
    <div
      role="toolbar"
      aria-label={d.selectedLabel}
      className="absolute top-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-overlay"
    >
      <div className="relative">
        <button
          type="button"
          aria-label={d.color}
          title={d.color}
          aria-expanded={palette}
          disabled={locked}
          onClick={() => setPalette((open) => !open)}
          className={ICON_BUTTON}
        >
          <span
            aria-hidden="true"
            className="size-4 rounded-sm border border-line-strong"
            style={{ background: style.lineColor }}
          />
        </button>
        {palette && (
          <div className="absolute top-full left-0 z-30 mt-1 grid grid-cols-4 gap-1 rounded-lg border border-line bg-surface p-1.5 shadow-overlay">
            {PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={formatCopy(d.colorOption, { color })}
                aria-pressed={style.lineColor.toUpperCase() === color}
                onClick={() => {
                  restyle({ lineColor: color });
                  setPalette(false);
                }}
                className="size-6 rounded border border-line-strong"
                style={{ background: color }}
              />
            ))}
          </div>
        )}
      </div>
      <select
        aria-label={d.width}
        title={d.width}
        value={style.lineWidth}
        disabled={locked}
        onChange={(event) => restyle({ lineWidth: Number(event.target.value) })}
        className="h-7 rounded-md bg-transparent px-1 text-xs text-fg-2 hover:bg-raised"
      >
        {[1, 2, 3, 4].map((width) => (
          <option key={width} value={width}>
            {formatCopy(d.widthOption, { width })}
          </option>
        ))}
      </select>
      <select
        aria-label={d.lineStyle}
        title={d.lineStyle}
        value={style.lineStyle}
        disabled={locked}
        onChange={(event) =>
          restyle({ lineStyle: event.target.value as DrawingLineStyle })
        }
        className="h-7 rounded-md bg-transparent px-1 text-xs text-fg-2 hover:bg-raised"
      >
        {LINE_STYLES.map((each) => (
          <option key={each} value={each}>
            {d.lineStyles[each]}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />
      <button
        type="button"
        aria-label={d.settings}
        title={d.settings}
        disabled={locked}
        onClick={() => setSettings(true)}
        className={ICON_BUTTON}
      >
        <Settings2 size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={drawing.locked ? d.unlock : d.lock}
        title={drawing.locked ? d.unlock : d.lock}
        aria-pressed={drawing.locked}
        disabled={layer.options.lockAll}
        onClick={() => layer.updateSelected({ locked: !drawing.locked })}
        className={classNames(ICON_BUTTON, drawing.locked && 'text-primary')}
      >
        {drawing.locked ? (
          <Lock size={15} aria-hidden="true" />
        ) : (
          <LockOpen size={15} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        aria-label={d.hide}
        title={d.hide}
        onClick={() => layer.updateSelected({ hidden: true })}
        className={ICON_BUTTON}
      >
        <EyeOff size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={d.remove}
        title={d.remove}
        disabled={locked}
        onClick={layer.removeSelected}
        className={classNames(ICON_BUTTON, 'hover:text-negative')}
      >
        <Trash size={15} aria-hidden="true" />
      </button>
      {settings && (
        <DrawingSettingsDialog
          drawing={drawing}
          onClose={() => setSettings(false)}
          onSave={(change) => {
            layer.updateSelected(change);
            setSettings(false);
          }}
        />
      )}
    </div>
  );
}
