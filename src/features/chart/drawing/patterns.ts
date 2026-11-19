import type { DrawingStyle, DrawingType } from '../../../types/domain';
import type { FigureLabels, Pixel, Shape } from './geometry';

/** The drawing types drawn as a chain of swings (D-149 patterns). */
export type PatternType = Extract<
  DrawingType,
  | 'XABCD_PATTERN'
  | 'CYPHER_PATTERN'
  | 'ABCD_PATTERN'
  | 'THREE_DRIVES_PATTERN'
  | 'HEAD_AND_SHOULDERS'
  | 'TRIANGLE_PATTERN'
  | 'ELLIOTT_IMPULSE_WAVE'
  | 'ELLIOTT_CORRECTION_WAVE'
  | 'ELLIOTT_TRIANGLE_WAVE'
  | 'ELLIOTT_DOUBLE_COMBO'
  | 'ELLIOTT_TRIPLE_COMBO'
>;

/** The name of each swing, in the order the Trader clicks them. */
export const SWING_NAMES: Readonly<Record<PatternType, readonly string[]>> = {
  XABCD_PATTERN: ['X', 'A', 'B', 'C', 'D'],
  CYPHER_PATTERN: ['X', 'A', 'B', 'C', 'D'],
  ABCD_PATTERN: ['A', 'B', 'C', 'D'],
  THREE_DRIVES_PATTERN: ['', '1', 'A', '2', 'B', '3'],
  HEAD_AND_SHOULDERS: ['', '', '', '', '', '', ''],
  TRIANGLE_PATTERN: ['A', 'B', 'C', 'D'],
  // A wave's origin is not named.
  ELLIOTT_IMPULSE_WAVE: ['', '1', '2', '3', '4', '5'],
  ELLIOTT_CORRECTION_WAVE: ['', 'A', 'B', 'C'],
  ELLIOTT_TRIANGLE_WAVE: ['', 'A', 'B', 'C', 'D', 'E'],
  ELLIOTT_DOUBLE_COMBO: ['', 'W', 'X', 'Y'],
  ELLIOTT_TRIPLE_COMBO: ['', 'W', 'X', 'Y', 'X', 'Z'],
};

export function isPattern(type: DrawingType): type is PatternType {
  return type in SWING_NAMES;
}

/** `|to − from| / |base|`, the Fibonacci ratio of one leg to another. */
export function legRatio(leg: number, base: number): number | null {
  return base === 0 ? null : Math.abs(leg) / Math.abs(base);
}

const ratioText = (ratio: number | null) =>
  ratio === null ? '–' : ratio.toFixed(3);

/**
 * Whether swing `i` is a top: above its neighbours on the pane (a smaller
 * y). An end swing is compared with its one neighbour.
 */
export function isTop(p: readonly Pixel[], i: number): boolean {
  const here = p[i]!.y;
  const before = p[i - 1]?.y;
  const after = p[i + 1]?.y;
  if (before === undefined) return after === undefined || here <= after;
  if (after === undefined) return here <= before;
  return here <= before && here <= after;
}

/** Where two lines, each through two points, cross; null when parallel. */
export function crossing(a: Pixel, b: Pixel, c: Pixel, d: Pixel): Pixel | null {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < 1e-9) return null;
  const t =
    ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denominator;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

/** The point of the line through `a` and `b` at `x`. */
function lineAt(a: Pixel, b: Pixel, x: number): Pixel {
  if (b.x === a.x) return { x, y: a.y };
  return { x, y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) };
}

const middle = (a: Pixel, b: Pixel): Pixel => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/**
 * The shapes of a pattern through its swings: the legs, a fill where the
 * pattern has one, the Fibonacci ratio of its legs on dashed guides, and the
 * name of each swing above a top or below a bottom. The handles are the
 * swings.
 */
export function patternShapes(
  type: PatternType,
  p: readonly Pixel[],
  prices: readonly number[],
  style: DrawingStyle,
  labels: FigureLabels,
  width: number,
): Shape[] {
  const shapes: Shape[] = [];
  const color = style.lineColor;
  const leg = (from: Pixel, to: Pixel): Shape => ({
    kind: 'segment',
    from,
    to,
    color,
    width: style.lineWidth,
    dash: style.lineStyle,
  });
  const guide = (from: Pixel, to: Pixel): Shape => ({
    kind: 'segment',
    from,
    to,
    color,
    width: 1,
    dash: 'DASHED',
  });
  const tag = (at: Pixel, text: string, size = 10): Shape => ({
    kind: 'text',
    at,
    text,
    color: '#FFFFFF',
    size,
    align: 'center',
    baseline: 'middle',
    background: color,
  });
  const fill = (...points: Pixel[]) => {
    if (style.fillColor)
      shapes.push({ kind: 'polygon', points, fill: style.fillColor });
  };
  const ratio = (from: number, to: number, a: number, b: number) =>
    ratioText(legRatio(prices[b]! - prices[a]!, prices[to]! - prices[from]!));
  const guided = (a: number, b: number, text: string) => {
    shapes.push(guide(p[a]!, p[b]!), tag(middle(p[a]!, p[b]!), text));
  };

  switch (type) {
    case 'XABCD_PATTERN':
    case 'CYPHER_PATTERN':
      fill(p[0]!, p[1]!, p[2]!);
      fill(p[2]!, p[3]!, p[4]!);
      break;
    case 'HEAD_AND_SHOULDERS':
      fill(p[0]!, p[1]!, p[2]!);
      fill(p[2]!, p[3]!, p[4]!);
      fill(p[4]!, p[5]!, p[6]!);
      break;
    default:
      break;
  }

  for (let i = 1; i < p.length; i++) shapes.push(leg(p[i - 1]!, p[i]!));

  switch (type) {
    case 'XABCD_PATTERN':
      // B, C and D as ratios of the leg before; D also of XA.
      guided(0, 2, ratio(0, 1, 1, 2));
      guided(1, 3, ratio(1, 2, 2, 3));
      guided(2, 4, ratio(2, 3, 3, 4));
      guided(0, 4, ratio(0, 1, 1, 4));
      break;
    case 'CYPHER_PATTERN':
      // B retraces XA, C extends XA, D retraces XC.
      guided(0, 2, ratio(0, 1, 1, 2));
      guided(0, 3, ratio(0, 1, 0, 3));
      guided(2, 4, ratio(0, 3, 3, 4));
      break;
    case 'ABCD_PATTERN':
      guided(0, 2, ratio(0, 1, 1, 2));
      guided(1, 3, ratio(1, 2, 2, 3));
      break;
    case 'THREE_DRIVES_PATTERN':
      // Each pullback of the drive before, each drive of its pullback.
      guided(1, 3, ratio(1, 2, 2, 3));
      guided(3, 5, ratio(3, 4, 4, 5));
      break;
    case 'HEAD_AND_SHOULDERS': {
      const left = Math.min(p[0]!.x, p[2]!.x);
      const right = Math.max(p[6]!.x, p[4]!.x);
      shapes.push(
        guide(lineAt(p[2]!, p[4]!, left), lineAt(p[2]!, p[4]!, right)),
      );
      const names: [number, string][] = [
        [1, labels.leftShoulder],
        [3, labels.head],
        [5, labels.rightShoulder],
      ];
      for (const [i, name] of names) {
        const top = isTop(p, i);
        shapes.push({
          kind: 'text',
          at: { x: p[i]!.x, y: p[i]!.y + (top ? -8 : 8) },
          text: name,
          color,
          size: 11,
          align: 'center',
          baseline: top ? 'bottom' : 'top',
        });
      }
      break;
    }
    case 'TRIANGLE_PATTERN': {
      // The sides through A–C and B–D, carried to where they meet when it
      // lies ahead, else to the right of the last swing.
      const end = Math.max(p[2]!.x, p[3]!.x);
      const apex = crossing(p[0]!, p[2]!, p[1]!, p[3]!);
      const x = apex && apex.x > end && apex.x < end + width ? apex.x : end + 1;
      const upper = lineAt(p[0]!, p[2]!, x);
      const lower = lineAt(p[1]!, p[3]!, x);
      fill(p[0]!, upper, lower, p[1]!);
      shapes.push(guide(p[0]!, upper), guide(p[1]!, lower));
      break;
    }
    default:
      break;
  }

  p.forEach((pixel, i) => {
    const name = SWING_NAMES[type][i];
    if (!name) return;
    const top = isTop(p, i);
    shapes.push(tag({ x: pixel.x, y: pixel.y + (top ? -12 : 12) }, name, 11));
  });
  return shapes;
}
