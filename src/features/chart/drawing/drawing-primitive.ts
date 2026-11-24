import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts';
import type { PaintItem } from './controller';
import { paintFigure } from './renderer';

/**
 * The layer the drawings are painted on, attached to the candlestick
 * series so it shares its price scale, above the candles. What to paint is
 * asked each frame, so the figures follow every pan and zoom.
 */
export class DrawingPrimitive implements ISeriesPrimitive<Time> {
  private requestUpdate: (() => void) | null = null;
  private readonly view: IPrimitivePaneView;

  constructor(items: () => readonly PaintItem[], accent: () => string) {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target) =>
        target.useMediaCoordinateSpace(({ context }) => {
          const color = accent();
          for (const item of items())
            paintFigure(context, item.figure, {
              handles: item.handles,
              accent: color,
            });
        }),
    };
    this.view = { zOrder: () => 'top', renderer: () => renderer };
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.requestUpdate = param.requestUpdate;
  }

  detached() {
    this.requestUpdate = null;
  }

  /** Asks the chart to paint again. */
  update() {
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }
}
