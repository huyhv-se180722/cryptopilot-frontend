import { useId, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { Dialog } from '../../../../components/ui/Dialog';
import { Input } from '../../../../components/ui/Input';
import { useCopy } from '../../../../hooks/use-copy';
import { formatCopy } from '../../../../i18n/copy';
import type {
  ChartDrawing,
  ChartDrawingChange,
} from '../../../../types/domain';
import { positionValid } from '../controller';
import { EXTENDABLE, FILLED, toolOfType } from '../tools';
import type { ToolId } from '../tools';

const PRICE = /^\d+(\.\d+)?$/;

/** A text drawing's font: 12 px at least (the type scale, D-161), 48 at most. */
const FONT_MIN = 12;
const FONT_MAX = 48;
const FONT_DEFAULT = 14;

/** The font size typed, kept within its bounds; the default when not a number. */
function fontSizeOf(typed: string): number {
  const size = Math.round(Number(typed));
  if (!Number.isFinite(size) || typed.trim() === '') return FONT_DEFAULT;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, size));
}

/** `#RRGGBB` of a colour that may carry an alpha byte, for `<input type=color>`. */
const opaque = (color: string) => color.slice(0, 7);

/** The tool name a drawing is shown under. */
function toolOf(drawing: ChartDrawing): ToolId {
  switch (drawing.type) {
    case 'TREND_LINE':
      return drawing.style.extendLeft && drawing.style.extendRight
        ? 'extendedLine'
        : drawing.style.extendRight
          ? 'ray'
          : 'trendLine';
    case 'HORIZONTAL_LINE':
      return 'horizontalLine';
    case 'HORIZONTAL_RAY':
      return 'horizontalRay';
    case 'VERTICAL_LINE':
      return 'verticalLine';
    case 'PARALLEL_CHANNEL':
      return 'parallelChannel';
    case 'ARROW':
      return 'arrow';
    case 'FIB_RETRACEMENT':
      return 'fibRetracement';
    case 'FIB_EXTENSION':
      return 'fibExtension';
    case 'RECTANGLE':
      return 'rectangle';
    case 'LONG_POSITION':
      return 'longPosition';
    case 'SHORT_POSITION':
      return 'shortPosition';
    case 'PRICE_RANGE':
      return 'priceRange';
    case 'DATE_RANGE':
      return 'dateRange';
    case 'TEXT':
      return 'text';
    default:
      return toolOfType(drawing.type);
  }
}

/**
 * The settings of one drawing (D-149 (3)): its colours, extension, text and
 * the exact price of each anchor. A vertical line and a date range have no
 * price to set.
 */
export function DrawingSettingsDialog({
  drawing,
  onClose,
  onSave,
}: {
  drawing: ChartDrawing;
  onClose: () => void;
  onSave: (change: Partial<ChartDrawingChange>) => void;
}) {
  const d = useCopy().drawing;
  const id = useId();
  const [style, setStyle] = useState(drawing.style);
  const [text, setText] = useState(drawing.text ?? '');
  // Kept as typed so "16" can be entered digit by digit; bounded on blur and
  // on save, not on every keystroke.
  const [fontSize, setFontSize] = useState(
    String(drawing.style.fontSize ?? FONT_DEFAULT),
  );
  const [prices, setPrices] = useState(drawing.points.map((p) => p.price));
  const [error, setError] = useState<string | null>(null);
  const position =
    drawing.type === 'LONG_POSITION' || drawing.type === 'SHORT_POSITION';
  const priced =
    drawing.type !== 'VERTICAL_LINE' && drawing.type !== 'DATE_RANGE';
  const filled = FILLED.has(drawing.type) || drawing.type === 'TEXT';
  const priceLabel = (index: number) =>
    position
      ? [d.entryPrice, d.stopPrice, d.targetPrice][index]!
      : formatCopy(d.pointPrice, { n: index + 1 });

  const save = () => {
    if (prices.some((price) => !PRICE.test(price) || Number(price) <= 0)) {
      setError(d.invalidPrice);
      return;
    }
    const points = drawing.points.map((point, i) => ({
      ...point,
      price: prices[i]!,
    }));
    if (!positionValid(drawing.type, points)) {
      setError(d.invalidPosition);
      return;
    }
    if (drawing.type === 'TEXT' && text.trim() === '') return;
    onSave({
      style:
        drawing.type === 'TEXT'
          ? { ...style, fontSize: fontSizeOf(fontSize) }
          : style,
      text: text.trim() === '' ? null : text.trim(),
      points,
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={formatCopy(d.settingsTitle, { tool: d.tools[toolOf(drawing)] })}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {d.cancel}
          </Button>
          <Button onClick={save}>{d.save}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-xs">
        <div className="flex items-center gap-3">
          <label htmlFor={id + '-line'} className="w-24 text-muted">
            {d.color}
          </label>
          <input
            id={id + '-line'}
            type="color"
            value={opaque(style.lineColor)}
            onChange={(event) =>
              setStyle({
                ...style,
                lineColor: event.target.value.toUpperCase(),
              })
            }
            className="h-7 w-12 rounded border border-line bg-transparent"
          />
        </div>
        {filled && (
          <div className="flex items-center gap-3">
            <label htmlFor={id + '-fill'} className="w-24 text-muted">
              {d.fill}
            </label>
            <input
              id={id + '-fill'}
              type="color"
              disabled={style.fillColor === null}
              value={opaque(style.fillColor ?? style.lineColor)}
              onChange={(event) =>
                setStyle({
                  ...style,
                  // A fill is kept see-through so the candles show.
                  fillColor: event.target.value.toUpperCase() + '33',
                })
              }
              className="h-7 w-12 rounded border border-line bg-transparent disabled:opacity-40"
            />
            <Checkbox
              label={d.noFill}
              checked={style.fillColor === null}
              onChange={(event) =>
                setStyle({
                  ...style,
                  fillColor: event.target.checked
                    ? null
                    : opaque(style.lineColor) + '33',
                })
              }
            />
          </div>
        )}
        {EXTENDABLE.has(drawing.type) && (
          <div className="flex gap-4">
            <Checkbox
              label={d.extendLeft}
              checked={style.extendLeft}
              onChange={(event) =>
                setStyle({ ...style, extendLeft: event.target.checked })
              }
            />
            <Checkbox
              label={d.extendRight}
              checked={style.extendRight}
              onChange={(event) =>
                setStyle({ ...style, extendRight: event.target.checked })
              }
            />
          </div>
        )}
        {drawing.type === 'TEXT' && (
          <Input
            label={d.fontSize}
            type="number"
            min={FONT_MIN}
            max={FONT_MAX}
            value={fontSize}
            onChange={(event) => setFontSize(event.target.value)}
            onBlur={() => setFontSize(String(fontSizeOf(fontSize)))}
          />
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor={id + '-text'} className="text-muted">
            {d.text}
          </label>
          <textarea
            id={id + '-text'}
            value={text}
            maxLength={500}
            rows={2}
            placeholder={d.textPlaceholder}
            onChange={(event) => setText(event.target.value)}
            className="rounded-md border border-line bg-raised px-2 py-1.5 text-fg"
          />
        </div>
        {priced &&
          prices.map((price, i) => (
            <Input
              key={i}
              label={priceLabel(i)}
              inputMode="decimal"
              value={price}
              onChange={(event) => {
                const next = [...prices];
                next[i] = event.target.value.trim();
                setPrices(next);
                setError(null);
              }}
            />
          ))}
        {error && (
          <p role="alert" className="text-negative">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
