import type {
  ChartDrawing,
  DrawingLineStyle,
  DrawingPoint,
  DrawingStyle,
  DrawingType,
} from '../../types/domain';
import {
  decimal,
  flag,
  instant,
  integer,
  list,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';

/**
 * Decoders for `/chart-drawings` (D-149, T-119), checked against the
 * backend's `ChartDrawingResponse`.
 */
export const DRAWING_TYPES: readonly DrawingType[] = [
  'TREND_LINE',
  'HORIZONTAL_LINE',
  'HORIZONTAL_RAY',
  'VERTICAL_LINE',
  'RECTANGLE',
  'FIB_RETRACEMENT',
  'LONG_POSITION',
  'SHORT_POSITION',
  'TEXT',
  'PARALLEL_CHANNEL',
  'FIB_EXTENSION',
  'PRICE_RANGE',
  'DATE_RANGE',
  'ARROW',
  'XABCD_PATTERN',
  'CYPHER_PATTERN',
  'ABCD_PATTERN',
  'THREE_DRIVES_PATTERN',
  'HEAD_AND_SHOULDERS',
  'TRIANGLE_PATTERN',
  'ELLIOTT_IMPULSE_WAVE',
  'ELLIOTT_CORRECTION_WAVE',
  'ELLIOTT_TRIANGLE_WAVE',
  'ELLIOTT_DOUBLE_COMBO',
  'ELLIOTT_TRIPLE_COMBO',
];
const LINE_STYLES: readonly DrawingLineStyle[] = ['SOLID', 'DASHED', 'DOTTED'];

function nullableInteger(value: unknown, name: string): number | null {
  return value === null || value === undefined ? null : integer(value, name);
}

function point(body: unknown, name: string): DrawingPoint {
  const value = record(body, name);
  return {
    time: instant(value.time, name + '.time'),
    price: decimal(value.price, name + '.price'),
  };
}

function style(body: unknown): DrawingStyle {
  const value = record(body, 'style');
  return {
    lineColor: text(value.lineColor, 'style.lineColor'),
    lineWidth: integer(value.lineWidth, 'style.lineWidth'),
    lineStyle: oneOf(LINE_STYLES, value.lineStyle, 'style.lineStyle'),
    fillColor: nullableText(value.fillColor, 'style.fillColor'),
    extendLeft: flag(value.extendLeft, 'style.extendLeft'),
    extendRight: flag(value.extendRight, 'style.extendRight'),
    fontSize: nullableInteger(value.fontSize, 'style.fontSize'),
    fibLevels:
      value.fibLevels === null || value.fibLevels === undefined
        ? null
        : list(value.fibLevels, 'style.fibLevels').map((level, i) =>
            decimal(level, `style.fibLevels[${i}]`),
          ),
  };
}

/** One drawing, as listed or as the answer of POST / PUT. */
export function decodeChartDrawing(body: unknown): ChartDrawing {
  const value = record(body, 'drawing');
  return {
    id: text(value.id, 'id'),
    layoutId: text(value.layoutId, 'layoutId'),
    type: oneOf(DRAWING_TYPES, value.type, 'type'),
    points: list(value.points, 'points').map((each, i) =>
      point(each, `points[${i}]`),
    ),
    style: style(value.style),
    text: nullableText(value.text, 'text'),
    locked: flag(value.locked, 'locked'),
    hidden: flag(value.hidden, 'hidden'),
    version: integer(value.version, 'version'),
  };
}

/** `GET /chart-drawings?layoutId=`. */
export function decodeChartDrawings(body: unknown): readonly ChartDrawing[] {
  return list(body, 'drawings').map(decodeChartDrawing);
}
