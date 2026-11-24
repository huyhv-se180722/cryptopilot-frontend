import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartDrawing, DrawingPoint } from '../../../types/domain';
import {
  DrawingController,
  lockAngle,
  positionValid,
  type ControllerEvents,
  type Projection,
} from './controller';
import { DrawingHistory } from './history';
import { DEFAULT_STYLE } from './tools';

const T0 = Date.UTC(2026, 10, 10);
const HOUR = 3_600_000;

/** One bar per hour, 10 px apart from T0; 1 px per price unit, 1,000 at the top. */
const projection: Projection = {
  context: {
    width: 800,
    height: 400,
    y: (price) => 1000 - price,
    price: (price) => price.toFixed(0),
    bars: (from, to) => (to - from) / 3600,
    labels: {
      target: '{price}',
      stop: '{price}',
      ratio: '{ratio}',
      span: '{bars}',
      leftShoulder: 'LS',
      head: 'H',
      rightShoulder: 'RS',
    },
  },
  pixel: (point) => ({
    x: ((Date.parse(point.time) - T0) / HOUR) * 10,
    y: 1000 - Number(point.price),
  }),
  point: (at, magnet) => ({
    time: new Date(T0 + Math.round(at.x / 10) * HOUR).toISOString(),
    price: String(
      magnet ? Math.round((1000 - at.y) / 10) * 10 : Math.round(1000 - at.y),
    ),
  }),
  later: (point, bars) => ({
    time: new Date(Date.parse(point.time) + bars * HOUR).toISOString(),
    price: point.price,
  }),
  scale: (price, factor) => String(Math.round(Number(price) * (1 + factor))),
};

const at = (hour: number, price: number) => ({ x: hour * 10, y: 1000 - price });
const point = (hour: number, price: number): DrawingPoint => ({
  time: new Date(T0 + hour * HOUR).toISOString(),
  price: String(price),
});

function drawing(
  id: string,
  overrides: Partial<ChartDrawing> = {},
): ChartDrawing {
  return {
    id,
    layoutId: 'layout',
    type: 'TREND_LINE',
    points: [point(10, 800), point(30, 700)],
    style: DEFAULT_STYLE,
    text: null,
    locked: false,
    hidden: false,
    version: 0,
    ...overrides,
  };
}

let events: { [K in keyof ControllerEvents]: ReturnType<typeof vi.fn> };
let controller: DrawingController;

beforeEach(() => {
  events = {
    create: vi.fn(),
    requestText: vi.fn(),
    change: vi.fn(),
    remove: vi.fn(),
    select: vi.fn(),
    toolDone: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    repaint: vi.fn(),
  };
  controller = new DrawingController();
  controller.setEvents(events as unknown as ControllerEvents);
  controller.setProjection(projection);
});

describe('placing a drawing', () => {
  it('places a trend line click by click with a preview, then puts the tool down', () => {
    controller.setTool('trendLine');
    expect(controller.pointerDown(at(10, 800))).toBe(true);
    controller.pointerMove(at(20, 750));
    expect(controller.paintItems()).toHaveLength(1);
    controller.pointerDown(at(30, 700));
    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TREND_LINE',
        points: [point(10, 800), point(30, 700)],
        locked: false,
      }),
    );
    expect(events.toolDone).toHaveBeenCalled();
    expect(controller.activeTool).toBeNull();
  });

  it('previews a pattern with each placed swing named, without labels piling up on one spot', () => {
    controller.setTool('headAndShoulders');
    controller.pointerDown(at(10, 820)); // anchor 0, unnamed
    controller.pointerDown(at(14, 880)); // anchor 1, left shoulder
    controller.pointerDown(at(18, 840)); // anchor 2, unnamed trough
    controller.pointerMove(at(22, 940)); // cursor on anchor 3, the head
    const figure = controller.paintItems()[0]!.figure;
    const texts = figure.shapes.filter((shape) => shape.kind === 'text');
    // Only the swings placed so far are named — the left shoulder and the
    // head under the cursor — never the fills, guides or unplaced anchors.
    expect(
      texts.map((shape) => (shape.kind === 'text' ? shape.text : '')),
    ).toEqual(['LS', 'H']);
    expect(figure.shapes.some((shape) => shape.kind === 'polygon')).toBe(false);
    // Each label sits on its own anchor; none collapse onto one point as the
    // unplaced anchors used to.
    const spots = texts.map((shape) =>
      shape.kind === 'text' ? `${shape.at.x},${shape.at.y}` : '',
    );
    expect(new Set(spots).size).toBe(texts.length);
    expect(figure.handles).toHaveLength(4);
  });

  it('keeps the tool in drawing mode and snaps with the magnet', () => {
    controller.setOptions({
      magnet: true,
      stayInDrawing: true,
      lockAll: false,
      hideAll: false,
    });
    controller.setTool('horizontalLine');
    controller.pointerDown(at(5, 803));
    controller.pointerDown(at(6, 897));
    expect(events.create).toHaveBeenCalledTimes(2);
    expect(events.create.mock.calls[0]![0].points[0].price).toBe('800');
    expect(events.create.mock.calls[1]![0].points[0].price).toBe('900');
    expect(controller.activeTool).toBe('horizontalLine');
  });

  it('places a position with one click, with its stop and target around the entry', () => {
    controller.setTool('longPosition');
    controller.pointerDown(at(10, 500));
    const draft = events.create.mock.calls[0]![0];
    expect(draft.points).toEqual([
      point(10, 500),
      point(30, 495),
      point(30, 510),
    ]);
    expect(positionValid('LONG_POSITION', draft.points)).toBe(true);
    controller.setTool('shortPosition');
    controller.pointerDown(at(10, 500));
    expect(
      events.create.mock.calls[1]![0].points.map((p: DrawingPoint) => p.price),
    ).toEqual(['500', '505', '490']);
  });

  it('asks for the text of a text drawing instead of creating it', () => {
    controller.setTool('text');
    controller.pointerDown(at(10, 500));
    expect(events.requestText).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TEXT' }),
    );
    expect(events.create).not.toHaveBeenCalled();
  });

  it('locks the second anchor to 45 degrees with Shift', () => {
    expect(lockAngle({ x: 0, y: 0 }, { x: 100, y: 8 })).toEqual({
      x: 100,
      y: 0,
    });
    expect(lockAngle({ x: 0, y: 0 }, { x: 3, y: 100 })).toEqual({
      x: 0,
      y: 100,
    });
    const diagonal = lockAngle({ x: 0, y: 0 }, { x: 100, y: 90 });
    expect(diagonal.x).toBeCloseTo(diagonal.y);
  });

  it('cancels the anchors with Esc, then the tool', () => {
    controller.setTool('trendLine');
    controller.pointerDown(at(10, 800));
    expect(controller.keyDown('Escape', false, false)).toBe(true);
    expect(controller.activeTool).toBe('trendLine');
    controller.keyDown('Escape', false, false);
    expect(controller.activeTool).toBeNull();
    expect(controller.keyDown('Escape', false, false)).toBe(false);
  });
});

describe('editing drawings', () => {
  it('selects a drawing and moves it whole, saving once on release', () => {
    controller.setDrawings([drawing('a')]);
    expect(controller.pointerDown(at(20, 750))).toBe(true);
    expect(events.select).toHaveBeenCalledWith('a');
    controller.pointerMove({ x: 210, y: 240 });
    controller.pointerMove({ x: 220, y: 230 });
    controller.pointerUp();
    expect(events.change).toHaveBeenCalledTimes(1);
    expect(events.change.mock.calls[0]![1]).toEqual([
      point(12, 820),
      point(32, 720),
    ]);
  });

  it('moves one anchor by its handle once selected', () => {
    controller.setDrawings([drawing('a')]);
    controller.pointerDown(at(20, 750));
    controller.pointerUp();
    controller.pointerDown(at(30, 700));
    controller.pointerMove(at(35, 650));
    controller.pointerUp();
    expect(events.change.mock.calls[0]![1]).toEqual([
      point(10, 800),
      point(35, 650),
    ]);
  });

  it('moves only the anchor pressed on a drawing not yet selected', () => {
    controller.setDrawings([drawing('a')]);
    expect(controller.pointerDown(at(30, 700))).toBe(true);
    expect(events.select).toHaveBeenCalledWith('a');
    controller.pointerMove(at(35, 650));
    controller.pointerUp();
    expect(events.change.mock.calls[0]![1]).toEqual([
      point(10, 800),
      point(35, 650),
    ]);
  });

  it('keeps a position valid while its stop is dragged', () => {
    const position = drawing('p', {
      type: 'LONG_POSITION',
      points: [point(10, 500), point(30, 480), point(30, 540)],
    });
    controller.setDrawings([position]);
    controller.select('p');
    controller.pointerDown(at(30, 480));
    controller.pointerMove(at(32, 520));
    controller.pointerUp();
    expect(events.change).not.toHaveBeenCalled();
    controller.pointerDown(at(30, 480));
    controller.pointerMove(at(34, 470));
    controller.pointerUp();
    expect(events.change.mock.calls[0]![1]).toEqual([
      point(10, 500),
      point(34, 470),
      point(34, 540),
    ]);
  });

  it('does not move a locked drawing, nor any while all are locked', () => {
    controller.setDrawings([
      drawing('a', { locked: true }),
      drawing('b', { points: [point(10, 600), point(30, 600)] }),
    ]);
    controller.pointerDown(at(20, 750));
    controller.pointerMove(at(25, 700));
    controller.pointerUp();
    expect(controller.cursorAt(at(20, 750))).toBe('pointer');
    controller.setOptions({
      magnet: false,
      stayInDrawing: false,
      lockAll: true,
      hideAll: false,
    });
    controller.pointerDown(at(20, 600));
    controller.pointerMove(at(25, 650));
    controller.pointerUp();
    expect(events.change).not.toHaveBeenCalled();
    expect(controller.keyDown('Delete', false, false)).toBe(false);
  });

  it('ignores hidden drawings and all drawings while hidden', () => {
    controller.setDrawings([drawing('a', { hidden: true })]);
    expect(controller.pointerDown(at(20, 750))).toBe(false);
    controller.setDrawings([drawing('a')]);
    controller.setOptions({
      magnet: false,
      stayInDrawing: false,
      lockAll: false,
      hideAll: true,
    });
    expect(controller.paintItems()).toHaveLength(0);
    expect(controller.hit(at(20, 750))).toBeNull();
  });

  it('removes the selected drawing with Delete and forwards undo and redo', () => {
    controller.setDrawings([drawing('a')]);
    controller.pointerDown(at(20, 750));
    controller.pointerUp();
    expect(controller.keyDown('Delete', false, false)).toBe(true);
    expect(events.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a' }),
    );
    controller.keyDown('z', true, false);
    controller.keyDown('Z', true, true);
    controller.keyDown('y', true, false);
    expect(events.undo).toHaveBeenCalledTimes(1);
    expect(events.redo).toHaveBeenCalledTimes(2);
    expect(controller.keyDown('x', false, false)).toBe(false);
  });

  it('deselects on a press beside every drawing, letting the chart pan', () => {
    controller.setDrawings([drawing('a')]);
    controller.pointerDown(at(20, 750));
    controller.pointerUp();
    expect(controller.pointerDown(at(70, 100))).toBe(false);
    expect(controller.selectedId).toBeNull();
    controller.setDrawings([]);
    expect(controller.cursorAt(at(20, 750))).toBeNull();
  });
});

describe('history', () => {
  it('undoes and redoes, renaming a drawing that came back under a new id', () => {
    const history = new DrawingHistory();
    const first = drawing('a');
    history.record({ kind: 'remove', drawing: first });
    history.record({ kind: 'update', id: 'a', before: first, after: first });
    expect(history.canUndo).toBe(true);
    const update = history.takeUndo()!;
    history.undone(update);
    const removal = history.takeUndo()!;
    const back = drawing('b');
    history.rename(first, back);
    history.undone({ ...removal, kind: 'remove', drawing: back } as never);
    expect(history.canUndo).toBe(false);
    expect(history.takeRedo()).toMatchObject({
      kind: 'remove',
      drawing: { id: 'b' },
    });
    expect(history.takeRedo()).toMatchObject({ kind: 'update', id: 'b' });
    history.record({ kind: 'create', drawing: back });
    history.clear();
    expect(history.canUndo || history.canRedo).toBe(false);
  });
});
