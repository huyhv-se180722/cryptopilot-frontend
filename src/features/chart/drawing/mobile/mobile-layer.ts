import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type {
  Candle,
  ChartDrawing,
  DrawingPoint,
} from '../../../../types/domain';
import {
  DrawingController,
  type ControllerOptions,
  type Draft,
} from '../controller';
import { DrawingPrimitive } from '../drawing-primitive';
import type { FigureLabels, Pixel } from '../geometry';
import { chartProjection } from '../projection';
import { CLICKS, TOOLS, type ToolId } from '../tools';

/**
 * What the layer tells the app, posted over the WebView channel. The app
 * saves every change and sends the drawings back (D-149 (5)); the layer
 * itself never writes.
 */
export type LayerEvent =
  | { type: 'drawing.create'; draft: Draft }
  | { type: 'drawing.text'; draft: Draft }
  | { type: 'drawing.change'; id: string; points: readonly DrawingPoint[] }
  | { type: 'drawing.remove'; id: string }
  | { type: 'drawing.select'; id: string | null }
  | { type: 'drawing.toolDone' };

/** The candles on the page and how their times are drawn. */
export interface LayerBars {
  bars: readonly Pick<Candle, 'openTime' | 'open' | 'high' | 'low' | 'close'>[];
  barSeconds: number;
  /** Seconds the page adds to UTC (BR-08). */
  offset: number;
  /** Decimals of the pair's tick size. */
  places: number;
}

/** Pixels added around lines and handles: a finger is wider than a mouse. */
export const TOUCH_SLOP = 10;

/**
 * Pixels a finger travels before a press with a tool in hand becomes a drag
 * that draws from where it went down; less is a tap's jitter.
 */
export const DRAG_TO_DRAW = 12;

type Gesture =
  | { kind: 'dragging'; pointer: number }
  | {
      kind: 'placing';
      pointer: number;
      start: Pixel;
      /** The first anchor went down where the drag started. */
      fromStart: boolean;
    };

const ENGLISH_LABELS: FigureLabels = {
  target: 'Target {price} ({change})',
  stop: 'Stop {price} ({change})',
  ratio: 'R:R {ratio}',
  span: '{bars} bars, {time}',
  leftShoulder: 'Left shoulder',
  head: 'Head',
  rightShoulder: 'Right shoulder',
};

const NO_OPTIONS: ControllerOptions = {
  magnet: false,
  stayInDrawing: false,
  lockAll: false,
  hideAll: false,
};

const noop = () => undefined;

export function isTool(value: unknown): value is ToolId {
  return typeof value === 'string' && Object.hasOwn(TOOLS, value);
}

/**
 * The drawing layer of the mobile chart page (D-149, T-153): the web's
 * controller and painter on the page's candlestick series, driven by touch.
 *
 * With a tool in hand the chart stands still and the browser does not pan,
 * so no gesture is taken away mid-way. Each tap places one anchor where the
 * finger lifts (the crosshair and the preview follow the finger until then);
 * a drag that starts a drawing of two or more anchors places the first where
 * it went down and the next where it lifts, like a mouse drag. Without a
 * tool, a press on a drawing selects it and a drag moves it whole or by one
 * anchor; a press elsewhere pans the chart as before.
 * Until `setEditable(true)` the layer only paints.
 */
export class MobileDrawingLayer {
  private readonly controller = new DrawingController(TOUCH_SLOP);
  private readonly primitive: DrawingPrimitive;
  private bars: LayerBars | null = null;
  private labels: FigureLabels = ENGLISH_LABELS;
  private accent = '#2962FF';
  private editable = false;
  private gesture: Gesture | null = null;

  constructor(
    private readonly chart: IChartApi,
    private readonly series: ISeriesApi<'Candlestick'>,
    private readonly container: HTMLElement,
    post: (event: LayerEvent) => void,
  ) {
    this.primitive = new DrawingPrimitive(
      () => this.controller.paintItems(),
      () => this.accent,
    );
    series.attachPrimitive(this.primitive);
    this.controller.setEvents({
      create: (draft) => post({ type: 'drawing.create', draft }),
      requestText: (draft) => post({ type: 'drawing.text', draft }),
      change: (drawing, points) =>
        post({ type: 'drawing.change', id: drawing.id, points }),
      remove: (drawing) => post({ type: 'drawing.remove', id: drawing.id }),
      select: (id) => post({ type: 'drawing.select', id }),
      toolDone: () => {
        this.freeze(false);
        post({ type: 'drawing.toolDone' });
      },
      undo: noop,
      redo: noop,
      repaint: () => this.primitive.update(),
    });
    // Before the chart's own handlers, so a press that is the drawing's
    // freezes the chart before it starts to pan.
    container.addEventListener('pointerdown', this.down, true);
    container.addEventListener('pointermove', this.move, true);
    container.addEventListener('pointerup', this.up, true);
    container.addEventListener('pointercancel', this.cancelGesture, true);
    container.addEventListener('touchmove', this.holdTouch, {
      capture: true,
      passive: false,
    });
  }

  setBars(bars: LayerBars) {
    this.bars = bars;
    this.project();
  }

  setLabels(labels: FigureLabels) {
    this.labels = labels;
    this.project();
  }

  setAccent(color: string) {
    this.accent = color;
    this.primitive.update();
  }

  setDrawings(drawings: readonly ChartDrawing[]) {
    this.controller.setDrawings(drawings);
  }

  setOptions(options: Partial<ControllerOptions>) {
    this.controller.setOptions({ ...NO_OPTIONS, ...options });
  }

  /** A tool from the bar, or null to put it down; an unknown id is ignored. */
  setTool(tool: unknown) {
    if (!this.editable) return;
    const next = isTool(tool) ? tool : null;
    this.controller.setTool(next);
    this.freeze(next !== null);
    this.clearCrosshair();
  }

  select(id: string | null) {
    this.controller.select(id);
  }

  /** Whether touch places and moves drawings; off, the layer only paints. */
  setEditable(editable: boolean) {
    if (this.editable === editable) return;
    if (!editable) {
      this.controller.setTool(null);
      this.controller.select(null);
      this.gesture = null;
      this.freeze(false);
      this.clearCrosshair();
    }
    this.editable = editable;
  }

  /** Drops the anchors placed so far, then the tool, then the selection. */
  cancel() {
    this.controller.keyDown('Escape', false, false);
    if (this.controller.activeTool === null) this.freeze(false);
    this.clearCrosshair();
  }

  detach() {
    this.setEditable(false);
    this.container.removeEventListener('pointerdown', this.down, true);
    this.container.removeEventListener('pointermove', this.move, true);
    this.container.removeEventListener('pointerup', this.up, true);
    this.container.removeEventListener(
      'pointercancel',
      this.cancelGesture,
      true,
    );
    this.container.removeEventListener('touchmove', this.holdTouch, true);
    this.series.detachPrimitive(this.primitive);
    this.controller.setProjection(null);
  }

  private project() {
    const now = this.bars;
    if (!now) return;
    this.controller.setProjection(
      chartProjection({
        chart: this.chart,
        series: this.series,
        bars: now.bars as readonly Candle[],
        barSeconds: now.barSeconds,
        offset: now.offset,
        places: now.places,
        labels: this.labels,
      }),
    );
    this.primitive.update();
  }

  private freeze(frozen: boolean) {
    this.chart.applyOptions({
      handleScroll: frozen ? false : { vertTouchDrag: false },
      handleScale: !frozen,
    });
    // Read when a finger goes down: with a tool in hand, every press is ours.
    this.container.style.touchAction = frozen ? 'none' : '';
  }

  /** A drag already under way is moved by preventing the browser's pan. */
  private readonly holdTouch = (event: TouchEvent) => {
    if (this.gesture && event.cancelable) event.preventDefault();
  };

  /** The tool needs two anchors or more and none is placed yet. */
  private startsByDrag(): boolean {
    const tool = this.controller.activeTool;
    return (
      tool !== null && !this.controller.placing && CLICKS[TOOLS[tool].type] >= 2
    );
  }

  /**
   * The finger on the price pane; while a gesture is under way, a finger
   * past the pane is held at its edge so the drawing keeps following it.
   */
  private local(event: PointerEvent, hold: boolean): Pixel | null {
    const box = this.container.getBoundingClientRect();
    const at = { x: event.clientX - box.left, y: event.clientY - box.top };
    const height = this.chart.panes()[0]?.getHeight() ?? 0;
    const width = this.chart.timeScale().width();
    if (width <= 0 || height <= 0) return null;
    if (hold)
      return {
        x: Math.min(Math.max(at.x, 0), width),
        y: Math.min(Math.max(at.y, 0), height),
      };
    return at.x >= 0 && at.y >= 0 && at.x <= width && at.y <= height
      ? at
      : null;
  }

  /** The crosshair at the finger, so the axes show where the anchor lands. */
  private aim(at: Pixel) {
    const price = this.series.coordinateToPrice(at.y);
    const time = this.chart.timeScale().coordinateToTime(at.x);
    if (price === null || time === null) return;
    this.chart.setCrosshairPosition(price, time as Time, this.series);
  }

  private clearCrosshair() {
    this.chart.clearCrosshairPosition();
  }

  private readonly down = (event: PointerEvent) => {
    if (!this.editable || !event.isPrimary || this.gesture) return;
    const at = this.local(event, false);
    if (!at) return;
    if (this.controller.activeTool !== null) {
      this.gesture = {
        kind: 'placing',
        pointer: event.pointerId,
        start: at,
        fromStart: false,
      };
      this.controller.pointerMove(at);
      this.aim(at);
    } else if (this.controller.pointerDown(at)) {
      this.gesture = { kind: 'dragging', pointer: event.pointerId };
      this.freeze(true);
    } else return;
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly move = (event: PointerEvent) => {
    const gesture = this.gesture;
    if (!gesture || event.pointerId !== gesture.pointer) return;
    const at = this.local(event, true);
    if (!at) return;
    if (
      gesture.kind === 'placing' &&
      !gesture.fromStart &&
      Math.hypot(at.x - gesture.start.x, at.y - gesture.start.y) >=
        DRAG_TO_DRAW &&
      this.startsByDrag()
    ) {
      this.controller.pointerDown(gesture.start);
      gesture.fromStart = this.controller.placing;
    }
    this.controller.pointerMove(at);
    if (gesture.kind === 'placing') this.aim(at);
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly up = (event: PointerEvent) => {
    const gesture = this.gesture;
    if (!gesture || event.pointerId !== gesture.pointer) return;
    this.gesture = null;
    const at = this.local(event, true);
    if (gesture.kind === 'placing') {
      if (at) this.controller.pointerDown(at);
      this.controller.pointerUp();
      this.clearCrosshair();
      this.freeze(this.controller.activeTool !== null);
    } else {
      this.controller.pointerUp();
      this.freeze(false);
    }
    event.preventDefault();
    event.stopPropagation();
  };

  /** The system took the finger (a scroll, a call): nothing is placed. */
  private readonly cancelGesture = (event: PointerEvent) => {
    const gesture = this.gesture;
    if (!gesture || event.pointerId !== gesture.pointer) return;
    this.gesture = null;
    // A drag keeps where it got to; an anchor not yet lifted is not placed,
    // nor the first one of a drawing the drag had started.
    if (gesture.kind === 'placing' && gesture.fromStart)
      this.controller.keyDown('Escape', false, false);
    this.controller.pointerUp();
    this.clearCrosshair();
    this.freeze(this.controller.activeTool !== null);
  };
}
