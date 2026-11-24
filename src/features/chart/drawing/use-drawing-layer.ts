import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { CrosshairMode, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { problemOf } from '../../../services/api/errors';
import type {
  Candle,
  ChartDrawing,
  ChartDrawingChange,
  ChartTimeframe,
} from '../../../types/domain';
import { token } from '../components/chart-theme';
import {
  DrawingController,
  type ControllerOptions,
  type Draft,
} from './controller';
import { DrawingPrimitive } from './drawing-primitive';
import type { Pixel } from './geometry';
import { DrawingHistory, changeOf, type HistoryEntry } from './history';
import { chartProjection } from './projection';
import { BAR_SECONDS } from './time-axis';
import type { ToolId } from './tools';
import { useChartDrawings } from './use-chart-drawings';
import { useChartLayouts } from './use-chart-layouts';

const OPTIONS_KEY = 'cp-drawing-options';
const NONE: readonly ChartDrawing[] = [];
const DEFAULT_OPTIONS: ControllerOptions = {
  magnet: false,
  stayInDrawing: false,
  lockAll: false,
  hideAll: false,
};

function readOptions(): ControllerOptions {
  try {
    const raw = window.localStorage.getItem(OPTIONS_KEY);
    const stored: unknown = raw ? JSON.parse(raw) : null;
    if (typeof stored !== 'object' || stored === null) return DEFAULT_OPTIONS;
    const values = stored as Record<string, unknown>;
    const flag = (name: keyof ControllerOptions) =>
      typeof values[name] === 'boolean'
        ? (values[name] as boolean)
        : DEFAULT_OPTIONS[name];
    return {
      magnet: flag('magnet'),
      stayInDrawing: flag('stayInDrawing'),
      lockAll: flag('lockAll'),
      hideAll: flag('hideAll'),
    };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

function writeOptions(options: ControllerOptions) {
  try {
    window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // Storage may be blocked; the options then last as long as the page.
  }
}

function draftOf(drawing: ChartDrawing): Draft {
  return { type: drawing.type, ...changeOf(drawing) };
}

function editing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.closest('dialog[open]') !== null
  );
}

interface Attachment {
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
  primitive: DrawingPrimitive;
  freeze: (frozen: boolean) => void;
  release: () => void;
}

/**
 * The drawing layer of one chart (D-149, T-120, T-121): it loads the
 * Trader's layouts on the pair and the drawings of the one shown, paints
 * them on the price pane, turns presses, drags and keys into drawings and
 * changes, saves each change, and keeps an undo history per layout. The
 * chart calls `attach` each time it is built.
 */
export function useDrawingLayer({
  pairId,
  bars,
  timeframe,
  offset,
  places,
}: {
  pairId: string | undefined;
  bars: readonly Candle[];
  timeframe: ChartTimeframe;
  offset: number;
  places: number;
}) {
  const copy = useCopy();
  const d = copy.drawing;
  const { show } = useToast();
  const layouts = useChartLayouts(pairId);
  const layoutId = layouts.active?.id;
  const data = useChartDrawings(layoutId, layouts.ensure);
  const drawings = layoutId ? data.query.data : NONE;
  const pair = pairId ?? '';
  // The undo history belongs to the layout shown.
  const scope = layoutId ?? '';
  const histories = useRef(new Map<string, DrawingHistory>());
  // Whether each copy's history can be undone or redone, so the buttons of
  // the copy shown follow its own history when the Trader comes back to it.
  const [stacks, setStacks] = useState<
    Readonly<Record<string, { canUndo: boolean; canRedo: boolean }>>
  >({});
  // The tool belongs to the pair it was picked on.
  const [picked, setPicked] = useState<{ pair: string; tool: ToolId | null }>({
    pair,
    tool: null,
  });
  // Another pair puts the tool picked down, so that coming back to the pair
  // does not show it pressed while the chart pans (state set while
  // rendering, as React advises for a prop that changed).
  const [seenPair, setSeenPair] = useState(pair);
  if (seenPair !== pair) {
    setSeenPair(pair);
    setPicked({ pair, tool: null });
  }
  const tool = picked.pair === pair ? picked.tool : null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [options, setOptions] = useState(readOptions);
  const [textDraft, setTextDraft] = useState<Draft | null>(null);
  const [controller] = useState(() => new DrawingController());
  const attachment = useRef<Attachment | null>(null);
  const latest = useRef({ bars, timeframe, offset, places, labels: d.labels });

  const historyOf = useCallback((key: string) => {
    let history = histories.current.get(key);
    if (!history) {
      history = new DrawingHistory();
      histories.current.set(key, history);
    }
    return history;
  }, []);

  const syncStacks = useCallback(
    (layout: string = scope) => {
      const history = historyOf(layout);
      setStacks((current) => ({
        ...current,
        [layout]: { canUndo: history.canUndo, canRedo: history.canRedo },
      }));
    },
    [historyOf, scope],
  );

  const fail = useCallback(
    (error: unknown) =>
      show({
        tone: 'error',
        message:
          problemOf(error)?.code === 'CHART_DRAWING_LIMIT_REACHED'
            ? d.limitReached
            : d.saveFailed,
      }),
    [d.limitReached, d.saveFailed, show],
  );

  const record = useCallback(
    (entry: HistoryEntry, layout: string = scope) => {
      historyOf(layout).record(entry);
      syncStacks(layout);
    },
    [historyOf, scope, syncStacks],
  );

  const save = useCallback(
    (id: string, before: ChartDrawingChange, after: ChartDrawingChange) => {
      record({ kind: 'update', id, before, after });
      data.update(id, after).catch(fail);
    },
    [data, fail, record],
  );

  const remove = useCallback(
    (drawing: ChartDrawing) => {
      record({ kind: 'remove', drawing });
      data.remove(drawing.id).catch(fail);
    },
    [data, fail, record],
  );

  const create = useCallback(
    (draft: Draft) =>
      data
        .create(draft)
        // The first drawing of a pair opens its layout: record it there.
        .then((drawing) =>
          record({ kind: 'create', drawing }, drawing.layoutId),
        )
        .catch(fail),
    [data, fail, record],
  );

  // Undo and redo run one after another: a step that brings a drawing back
  // renames it in the history before the next step reads the history.
  const replaying = useRef<Promise<void>>(Promise.resolve());
  const replay = useCallback(
    (direction: 'undo' | 'redo') => {
      const step = async () => {
        const history = historyOf(scope);
        const entry =
          direction === 'undo' ? history.takeUndo() : history.takeRedo();
        if (!entry) return;
        const done = (next: HistoryEntry) =>
          direction === 'undo' ? history.undone(next) : history.redone(next);
        try {
          const removing = (entry.kind === 'create') === (direction === 'undo');
          if (entry.kind === 'update') {
            await data.update(
              entry.id,
              direction === 'undo' ? entry.before : entry.after,
            );
            done(entry);
          } else if (removing) {
            await data.remove(entry.drawing.id);
            done(entry);
          } else {
            const back = await data.create(draftOf(entry.drawing));
            history.rename(entry.drawing, back);
            done({ ...entry, drawing: back });
          }
        } catch (error) {
          // Not saved: the step stays where it was, to be tried again.
          history.putBack(direction, entry);
          fail(error);
        }
        syncStacks();
      };
      const next = replaying.current.then(step);
      replaying.current = next.catch(() => undefined);
      return next;
    },
    [data, fail, historyOf, scope, syncStacks],
  );

  useLayoutEffect(() => {
    controller.setEvents({
      create: (draft) => void create(draft),
      requestText: setTextDraft,
      change: (drawing, points) => {
        const before = changeOf(drawing);
        save(drawing.id, before, { ...before, points });
      },
      remove,
      select: setSelectedId,
      toolDone: () => {
        setPicked({ pair, tool: null });
        attachment.current?.freeze(false);
      },
      undo: () => void replay('undo'),
      redo: () => void replay('redo'),
      repaint: () => attachment.current?.primitive.update(),
    });
  }, [controller, create, pair, remove, replay, save]);

  const project = useCallback(() => {
    const attached = attachment.current;
    if (!attached) return;
    const now = latest.current;
    controller.setProjection(
      chartProjection({
        chart: attached.chart,
        series: attached.series,
        bars: now.bars,
        barSeconds: BAR_SECONDS[now.timeframe],
        offset: now.offset,
        places: now.places,
        labels: now.labels,
      }),
    );
    attached.primitive.update();
  }, [controller]);

  useEffect(() => {
    latest.current = { bars, timeframe, offset, places, labels: d.labels };
    project();
  }, [bars, timeframe, offset, places, d.labels, project]);

  useEffect(() => {
    controller.setDrawings(drawings ?? []);
  }, [controller, drawings]);

  const { counted } = layouts;
  useEffect(() => {
    if (layoutId && drawings) counted(layoutId, drawings);
  }, [counted, drawings, layoutId]);

  useEffect(() => {
    controller.setOptions(options);
    writeOptions(options);
  }, [controller, options]);

  // Another pair: no tool in hand, nothing selected.
  useEffect(() => {
    controller.setTool(null);
    attachment.current?.freeze(false);
  }, [controller, pair]);

  /** Puts the layer on a freshly built chart; answers how to take it off. */
  const attach = useCallback(
    (
      chart: IChartApi,
      series: ISeriesApi<'Candlestick'>,
      container: HTMLElement,
    ): (() => void) => {
      const primitive = new DrawingPrimitive(
        () => controller.paintItems(),
        () => token('--cp-primary') || '#2962FF',
      );
      series.attachPrimitive(primitive);
      // While drawing, the crosshair stays on the pointer, where the anchor
      // lands; the library's Magnet pulls its price line onto the candle's
      // close. Charts without drawings keep the Magnet. The modes by value
      // (Normal 0, Magnet 1): the enum is not loaded in tests.
      chart.applyOptions({ crosshair: { mode: 0 as CrosshairMode.Normal } });
      const freeze = (frozen: boolean) =>
        chart.applyOptions({ handleScroll: !frozen, handleScale: !frozen });
      // Touch screens show the drawings but do not edit them (D-149 (7)).
      const viewOnly =
        window.matchMedia?.('(pointer: coarse)').matches ?? false;
      let pressed = false;
      let over = false;
      /**
       * The pointer on the price pane. While a drawing is being placed or
       * moved, a pointer gone past the pane (onto the price scale, a lower
       * panel or out of the chart) is held at its edge, so the drawing keeps
       * following it instead of stopping where it left.
       */
      const local = (event: PointerEvent, hold = false): Pixel | null => {
        const box = container.getBoundingClientRect();
        const at = { x: event.clientX - box.left, y: event.clientY - box.top };
        const height = chart.panes()[0]?.getHeight() ?? 0;
        const width = chart.timeScale().width();
        if (hold && width > 0 && height > 0)
          return {
            x: Math.min(Math.max(at.x, 0), width),
            y: Math.min(Math.max(at.y, 0), height),
          };
        return at.x >= 0 && at.y >= 0 && at.x <= width && at.y <= height
          ? at
          : null;
      };
      const down = (event: PointerEvent) => {
        if (event.button !== 0) return;
        const at = local(event);
        if (!at || !controller.pointerDown(at, event.shiftKey)) return;
        event.preventDefault();
        event.stopPropagation();
        freeze(true);
        pressed = true;
        container.setPointerCapture?.(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        const at = local(event);
        const held =
          at ?? (pressed || controller.placing ? local(event, true) : null);
        if (held) controller.pointerMove(held, event.shiftKey);
        container.style.cursor = at ? (controller.cursorAt(at) ?? '') : '';
      };
      const up = () => {
        if (!pressed) return;
        pressed = false;
        controller.pointerUp();
        freeze(controller.activeTool !== null);
      };
      const enter = () => {
        over = true;
      };
      const leave = () => {
        over = false;
      };
      const key = (event: KeyboardEvent) => {
        if (editing(event.target)) return;
        // The drawing keys act on this chart only while it is the one in use:
        // the pointer over it or the focus in it. Elsewhere on the page,
        // Backspace or Ctrl+Z belongs to what has the focus. Esc still puts
        // the tool down or the selection away from anywhere.
        const here =
          over ||
          (event.target instanceof Node && container.contains(event.target));
        const away =
          event.key === 'Escape' &&
          (controller.selectedId !== null || controller.activeTool !== null);
        if (!here && !away) return;
        if (
          controller.keyDown(
            event.key,
            event.ctrlKey || event.metaKey,
            event.shiftKey,
          )
        )
          event.preventDefault();
      };
      if (!viewOnly) {
        container.addEventListener('pointerdown', down, true);
        container.addEventListener('pointermove', move);
        container.addEventListener('pointerenter', enter);
        container.addEventListener('pointerleave', leave);
        window.addEventListener('pointerup', up);
        window.addEventListener('keydown', key);
      }
      attachment.current = {
        chart,
        series,
        primitive,
        freeze,
        release: () => {
          // A chart frozen for the tool in hand pans and zooms again, and its
          // crosshair goes back to the Magnet.
          freeze(false);
          chart.applyOptions({
            crosshair: { mode: 1 as CrosshairMode.Magnet },
          });
          container.removeEventListener('pointerdown', down, true);
          container.removeEventListener('pointermove', move);
          container.removeEventListener('pointerenter', enter);
          container.removeEventListener('pointerleave', leave);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('keydown', key);
          series.detachPrimitive(primitive);
        },
      };
      project();
      freeze(controller.activeTool !== null);
      return () => {
        attachment.current?.release();
        attachment.current = null;
        controller.setProjection(null);
      };
    },
    [controller, project],
  );

  const setTool = useCallback(
    (next: ToolId | null) => {
      controller.setTool(next);
      setPicked({ pair, tool: next });
      attachment.current?.freeze(next !== null);
    },
    [controller, pair],
  );

  const setOption = useCallback(
    (name: keyof ControllerOptions, value: boolean) =>
      setOptions((current) => ({ ...current, [name]: value })),
    [],
  );

  const selected = drawings?.find((each) => each.id === selectedId) ?? null;

  const updateSelected = useCallback(
    (change: Partial<ChartDrawingChange>) => {
      if (!selected) return;
      const before = changeOf(selected);
      save(selected.id, before, { ...before, ...change });
    },
    [save, selected],
  );

  const removeSelected = useCallback(() => {
    if (selected) remove(selected);
  }, [remove, selected]);

  const removeAll = useCallback(() => {
    historyOf(scope).clear();
    syncStacks();
    data.removeAll().catch(fail);
  }, [data, fail, historyOf, scope, syncStacks]);

  const hidden = (drawings ?? []).filter((each) => each.hidden);
  const showHidden = () => {
    for (const drawing of hidden) {
      const before = changeOf(drawing);
      save(drawing.id, before, { ...before, hidden: false });
    }
  };

  const submitText = (text: string) => {
    if (textDraft) void create({ ...textDraft, text });
    setTextDraft(null);
  };

  const shownStacks = stacks[scope];
  // A layout switch keeps the tools on while its drawings load. Only a list
  // never loaded is an error: a failed save reads the drawings again, and a
  // failed read then keeps the ones known rather than taking the tools away.
  const unread = (query: { status: string; data: unknown }) =>
    query.status === 'error' && query.data === undefined;
  const status =
    unread(layouts.query) || (layoutId !== undefined && unread(data.query))
      ? 'error'
      : layouts.query.data !== undefined
        ? 'success'
        : layouts.query.status;
  return {
    status,
    layouts,
    attach,
    count: drawings?.length ?? 0,
    tool,
    setTool,
    options,
    setOption,
    selected,
    updateSelected,
    removeSelected,
    removeAll,
    hiddenCount: hidden.length,
    showHidden,
    textDraft,
    submitText,
    cancelText: () => setTextDraft(null),
    undo: () => void replay('undo'),
    redo: () => void replay('redo'),
    canUndo: shownStacks?.canUndo ?? false,
    canRedo: shownStacks?.canRedo ?? false,
  };
}

export type DrawingLayer = ReturnType<typeof useDrawingLayer>;
