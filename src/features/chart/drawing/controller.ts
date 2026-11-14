import type {
  ChartDrawing,
  DrawingPoint,
  NewChartDrawing,
} from '../../../types/domain';
import {
  figureOf,
  hitFigure,
  type Drawable,
  type Figure,
  type FigureContext,
  type Pixel,
} from './geometry';
import { CLICKS, TOOLS, styleOf, type ToolId } from './tools';

/** What the controller needs from the chart: anchors to pixels and back. */
export interface Projection {
  context: FigureContext;
  /** The pixel of an anchor on the price pane. */
  pixel(point: DrawingPoint): Pixel | null;
  /**
   * The anchor at a pixel: its time on the nearest bar, its price at `y`,
   * or with `magnet` the nearest open, high, low or close of that bar.
   */
  point(at: Pixel, magnet: boolean): DrawingPoint | null;
  /** The anchor `bars` bars later, at the same price. */
  later(point: DrawingPoint, bars: number): DrawingPoint | null;
  /** A price moved by a fraction of itself, at the pair's precision. */
  scale(price: string, factor: number): string;
}

export type Draft = Omit<NewChartDrawing, 'pairId'>;

export interface ControllerEvents {
  create(draft: Draft): void;
  /** A text drawing waits for its text before it is created. */
  requestText(draft: Draft): void;
  change(drawing: ChartDrawing, points: readonly DrawingPoint[]): void;
  remove(drawing: ChartDrawing): void;
  select(id: string | null): void;
  /** The tool was put down after a drawing was finished. */
  toolDone(): void;
  undo(): void;
  redo(): void;
  repaint(): void;
}

export interface ControllerOptions {
  magnet: boolean;
  stayInDrawing: boolean;
  lockAll: boolean;
  hideAll: boolean;
}

type Mode =
  | { kind: 'idle' }
  | {
      kind: 'placing';
      tool: ToolId;
      points: DrawingPoint[];
      cursor: DrawingPoint | null;
    }
  | {
      kind: 'dragging';
      drawing: ChartDrawing;
      handle: number | null;
      origin: Pixel;
      current: readonly DrawingPoint[];
      moved: boolean;
    };

/** One figure to paint, with whether its handles show. */
export interface PaintItem {
  figure: Figure;
  handles: boolean;
}

const SILENT: ControllerEvents = {
  create: () => undefined,
  requestText: () => undefined,
  change: () => undefined,
  remove: () => undefined,
  select: () => undefined,
  toolDone: () => undefined,
  undo: () => undefined,
  redo: () => undefined,
  repaint: () => undefined,
};

const LONG_RISK = 0.01;
const LONG_REWARD = 0.02;
const POSITION_BARS = 20;
const DRAG_THRESHOLD = 3;

/** Whether a position's stop and target lie on their sides of the entry. */
export function positionValid(
  type: ChartDrawing['type'],
  points: readonly DrawingPoint[],
): boolean {
  if (type !== 'LONG_POSITION' && type !== 'SHORT_POSITION') return true;
  const [entry, stop, target] = points.map((point) => Number(point.price));
  return type === 'LONG_POSITION'
    ? stop! < entry! && entry! < target!
    : target! < entry! && entry! < stop!;
}

/** The pixel `at` turned to lie at 0°, 45° or 90° from `origin`. */
export function lockAngle(origin: Pixel, at: Pixel): Pixel {
  const dx = at.x - origin.x;
  const dy = at.y - origin.y;
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  const length = Math.hypot(dx, dy);
  if (Math.abs(Math.cos(angle)) < 1e-9) return { x: origin.x, y: at.y };
  if (Math.abs(Math.sin(angle)) < 1e-9) return { x: at.x, y: origin.y };
  return {
    x: origin.x + length * Math.cos(angle),
    y: origin.y + length * Math.sin(angle),
  };
}

/**
 * The drawing interactions of one chart, without the DOM: the hook feeds it
 * pointer and key events in pane pixels and paints what it answers. Placing
 * is click by click with a live preview (D-149 (3)); a drawing is moved by
 * its body or one handle and saved once, when the pointer is released.
 */
export class DrawingController {
  private drawings: readonly ChartDrawing[] = [];
  private mode: Mode = { kind: 'idle' };
  private tool: ToolId | null = null;
  private selected: string | null = null;
  private options: ControllerOptions = {
    magnet: false,
    stayInDrawing: false,
    lockAll: false,
    hideAll: false,
  };
  private projection: Projection | null = null;
  private events: ControllerEvents = SILENT;

  /** Where the controller reports what the Trader did. */
  setEvents(events: ControllerEvents) {
    this.events = events;
  }

  /** How anchors map to the chart now; null while no chart is attached. */
  setProjection(projection: Projection | null) {
    this.projection = projection;
  }

  get selectedId(): string | null {
    return this.selected;
  }

  get activeTool(): ToolId | null {
    return this.tool;
  }

  get busy(): boolean {
    return this.mode.kind !== 'idle';
  }

  setDrawings(drawings: readonly ChartDrawing[]) {
    this.drawings = drawings;
    if (this.selected && !drawings.some((each) => each.id === this.selected))
      this.select(null);
    this.events.repaint();
  }

  setOptions(options: ControllerOptions) {
    this.options = options;
    if (options.hideAll) this.select(null);
    this.events.repaint();
  }

  setTool(tool: ToolId | null) {
    this.tool = tool;
    this.mode = tool
      ? { kind: 'placing', tool, points: [], cursor: null }
      : { kind: 'idle' };
    if (tool) this.select(null);
    this.events.repaint();
  }

  select(id: string | null) {
    if (this.selected === id) return;
    this.selected = id;
    this.events.select(id);
    this.events.repaint();
  }

  private visible(): readonly ChartDrawing[] {
    return this.options.hideAll
      ? []
      : this.drawings.filter((drawing) => !drawing.hidden);
  }

  private figure(drawable: Drawable): Figure | null {
    const projection = this.projection;
    if (!projection) return null;
    return figureOf(
      drawable,
      drawable.points.map((point) => projection.pixel(point)),
      projection.context,
    );
  }

  private draftOf(tool: ToolId, points: readonly DrawingPoint[]): Draft | null {
    const { type } = TOOLS[tool];
    let all = [...points];
    if (type === 'LONG_POSITION' || type === 'SHORT_POSITION') {
      const projection = this.projection;
      const entry = points[0];
      if (!projection || !entry) return null;
      const right = projection.later(entry, POSITION_BARS) ?? entry;
      const long = type === 'LONG_POSITION';
      all = [
        entry,
        {
          time: right.time,
          price: projection.scale(entry.price, long ? -LONG_RISK : LONG_RISK),
        },
        {
          time: right.time,
          price: projection.scale(
            entry.price,
            long ? LONG_REWARD : -LONG_REWARD,
          ),
        },
      ];
    }
    return {
      type,
      points: all,
      style: styleOf(tool),
      text: null,
      locked: false,
      hidden: false,
    };
  }

  /** The figures to paint, the one being placed or moved included. */
  paintItems(): PaintItem[] {
    const items: PaintItem[] = [];
    const mode = this.mode;
    for (const drawing of this.visible()) {
      const moving = mode.kind === 'dragging' && mode.drawing.id === drawing.id;
      const figure = this.figure(
        moving ? { ...drawing, points: mode.current } : drawing,
      );
      if (figure) items.push({ figure, handles: drawing.id === this.selected });
    }
    if (mode.kind === 'placing' && mode.points.length > 0) {
      const clicks = CLICKS[TOOLS[mode.tool].type];
      const shown = [...mode.points];
      if (mode.cursor && shown.length < clicks) shown.push(mode.cursor);
      while (shown.length < clicks) shown.push(shown[shown.length - 1]!);
      const draft = this.draftOf(mode.tool, shown);
      const figure = draft && this.figure(draft);
      if (figure) items.push({ figure, handles: true });
    }
    return items;
  }

  /** The drawing and part under a pixel, the topmost first. */
  hit(at: Pixel): { drawing: ChartDrawing; handle: number | null } | null {
    const visible = this.visible();
    for (let i = visible.length - 1; i >= 0; i--) {
      const drawing = visible[i]!;
      const figure = this.figure(drawing);
      const hit = figure && hitFigure(figure, at, drawing.id === this.selected);
      if (hit)
        return { drawing, handle: hit.part === 'handle' ? hit.index : null };
    }
    return null;
  }

  /** The cursor to show at a pixel. */
  cursorAt(at: Pixel): string | null {
    if (this.mode.kind === 'placing') return 'crosshair';
    if (this.mode.kind === 'dragging') return 'grabbing';
    const hit = this.hit(at);
    if (!hit) return null;
    if (hit.drawing.locked || this.options.lockAll) return 'pointer';
    return hit.handle === null ? 'move' : 'grab';
  }

  private pointAt(at: Pixel, shift: boolean): DrawingPoint | null {
    const projection = this.projection;
    if (!projection) return null;
    const mode = this.mode;
    let target = at;
    if (shift && mode.kind === 'placing') {
      const last = mode.points[mode.points.length - 1];
      const origin = last && projection.pixel(last);
      if (origin) target = lockAngle(origin, at);
    }
    return projection.point(target, this.options.magnet);
  }

  /**
   * A press on the pane. Answers true when the press is the drawing's, so
   * the chart must not pan with it.
   */
  pointerDown(at: Pixel, shift = false): boolean {
    const mode = this.mode;
    if (mode.kind === 'placing') {
      const point = this.pointAt(at, shift);
      if (!point) return true;
      const points = [...mode.points, point];
      const clicks = CLICKS[TOOLS[mode.tool].type];
      if (points.length < clicks) {
        this.mode = { ...mode, points, cursor: point };
        this.events.repaint();
        return true;
      }
      const draft = this.draftOf(mode.tool, points);
      const tool = mode.tool;
      if (this.options.stayInDrawing)
        this.mode = { kind: 'placing', tool, points: [], cursor: null };
      else {
        this.tool = null;
        this.mode = { kind: 'idle' };
        this.events.toolDone();
      }
      if (draft) {
        if (draft.type === 'TEXT') this.events.requestText(draft);
        else this.events.create(draft);
      }
      this.events.repaint();
      return true;
    }
    const hit = this.hit(at);
    if (!hit) {
      this.select(null);
      return false;
    }
    this.select(hit.drawing.id);
    if (hit.drawing.locked || this.options.lockAll) return true;
    this.mode = {
      kind: 'dragging',
      drawing: hit.drawing,
      handle: hit.handle,
      origin: at,
      current: hit.drawing.points,
      moved: false,
    };
    return true;
  }

  pointerMove(at: Pixel, shift = false) {
    const mode = this.mode;
    const projection = this.projection;
    if (mode.kind === 'placing') {
      if (mode.points.length === 0) return;
      this.mode = { ...mode, cursor: this.pointAt(at, shift) };
      this.events.repaint();
      return;
    }
    if (mode.kind !== 'dragging' || !projection) return;
    const dx = at.x - mode.origin.x;
    const dy = at.y - mode.origin.y;
    if (!mode.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    const { drawing } = mode;
    let next: DrawingPoint[] | null;
    if (mode.handle === null) {
      next = [];
      for (const point of drawing.points) {
        const pixel = projection.pixel(point);
        const moved =
          pixel &&
          projection.point({ x: pixel.x + dx, y: pixel.y + dy }, false);
        if (!moved) return;
        next.push(moved);
      }
    } else {
      const point = projection.point(at, this.options.magnet);
      if (!point) return;
      next = [...mode.current];
      next[mode.handle] = point;
      // A position's stop and target share its right edge.
      if (
        (drawing.type === 'LONG_POSITION' ||
          drawing.type === 'SHORT_POSITION') &&
        mode.handle > 0
      ) {
        const other = mode.handle === 1 ? 2 : 1;
        next[other] = { ...next[other]!, time: point.time };
      }
      // A horizontal line keeps no time; a vertical one keeps no price.
      if (drawing.type === 'VERTICAL_LINE')
        next[0] = { ...point, price: drawing.points[0]!.price };
    }
    if (!positionValid(drawing.type, next)) return;
    this.mode = { ...mode, current: next, moved: true };
    this.events.repaint();
  }

  pointerUp() {
    const mode = this.mode;
    if (mode.kind !== 'dragging') return;
    this.mode = { kind: 'idle' };
    if (mode.moved) this.events.change(mode.drawing, mode.current);
    this.events.repaint();
  }

  /** Answers true when the key was the drawing's. */
  keyDown(key: string, ctrl: boolean, shift: boolean): boolean {
    if (key === 'Escape') {
      if (this.mode.kind === 'placing' && this.mode.points.length > 0) {
        this.mode = { ...this.mode, points: [], cursor: null };
      } else if (this.tool) {
        this.tool = null;
        this.mode = { kind: 'idle' };
        this.events.toolDone();
      } else if (this.selected) this.select(null);
      else return false;
      this.events.repaint();
      return true;
    }
    if ((key === 'Delete' || key === 'Backspace') && this.selected) {
      const drawing = this.drawings.find((each) => each.id === this.selected);
      if (!drawing || drawing.locked || this.options.lockAll) return false;
      this.events.remove(drawing);
      return true;
    }
    if (ctrl && (key === 'z' || key === 'Z')) {
      if (shift) this.events.redo();
      else this.events.undo();
      return true;
    }
    if (ctrl && (key === 'y' || key === 'Y')) {
      this.events.redo();
      return true;
    }
    return false;
  }
}
