import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { MobileDrawingLayer, type LayerEvent } from './mobile-layer';

/**
 * The bundle the mobile app's chart page loads (`assets/chart/drawings.js`,
 * built with `npm run build:mobile-drawings`): the page calls
 * `CPDrawings.attach` once its chart exists.
 */
const api = {
  attach: (
    chart: IChartApi,
    series: ISeriesApi<'Candlestick'>,
    container: HTMLElement,
    post: (event: LayerEvent) => void,
  ) => new MobileDrawingLayer(chart, series, container, post),
};

declare global {
  interface Window {
    CPDrawings: typeof api;
  }
}

window.CPDrawings = api;
