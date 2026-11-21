import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState } from '../../../components/feedback/States';
import { CoinLogo } from '../../../components/ui/CoinLogo';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import type {
  CandleTimeframe,
  MarketPair,
  MarketTicker,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import {
  compactDecimal,
  formatPrice,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import { signOf } from '../../../utils/decimal-sign';
import {
  chartOffsetSeconds,
  zoneLabel,
} from '../../chart/components/chart-time';
import { PairChart } from '../../market/components/PairChart';
import { usePairCandles } from '../../market/hooks/use-market-data';

type Shown = Extract<CandleTimeframe, '1h' | '4h' | '1d'>;
const TIMEFRAMES: readonly { value: Shown; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1D' },
];

/**
 * The chart of SCR-08 (T-139, A-68): the Spot pair picked in the rail
 * beside it, its live price, 24h change, high, low and volume from the
 * ticker the page already reads, and its closed candles in 1h, 4h or 1D
 * (one candle request per timeframe shown), in the Trader's local time
 * for the intraday ones; a link opens its analysis (SCR-10).
 */
export function MarketSnapshot({
  pair,
  ticker,
}: {
  /** Null until the page knows which pair to show. */
  pair: MarketPair | null;
  ticker: MarketTicker | undefined;
}) {
  const copy = useCopy();
  const d = copy.dashboard;
  const m = copy.market;
  const none = m.noValue;
  const [timeframe, setTimeframe] = useState<Shown>('1h');
  const candles = usePairCandles('spot', pair?.symbol ?? null, timeframe);
  const tick = pair?.tickSize ?? null;
  const change = ticker?.changePercent24h ?? null;
  const sign = change === null ? null : signOf(change);
  const price = (value: string | null | undefined) =>
    value ? <NumericText value={formatPrice(value, tick)} /> : none;
  const shownLabel =
    TIMEFRAMES.find((each) => each.value === timeframe)?.label ?? timeframe;

  return (
    <section
      aria-label={d.snapshotTitle}
      className="flex min-w-0 flex-col rounded-xl border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-4 py-3.5">
        {pair ? (
          <div className="flex items-center gap-2.5">
            <CoinLogo
              src={pair.logoUrl}
              symbol={pair.baseAsset ?? pair.symbol}
            />
            <div>
              <h2 className="text-base font-bold text-fg">
                {pair.baseAsset ?? pair.symbol}
                <span className="font-medium text-muted-dim">
                  /{pair.quoteAsset}
                </span>
                <span className="ml-1.5 text-[11px] font-medium text-muted-dim">
                  {m.spot}
                </span>
              </h2>
              <p className="text-[11px] text-muted-dim">{d.chartPickHint}</p>
            </div>
          </div>
        ) : (
          <Skeleton className="h-9 w-40" />
        )}
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xl font-semibold text-fg">
            {price(ticker?.lastPrice)}
          </span>
          {change !== null && (
            <span
              className={classNames(
                'rounded px-1.5 py-0.5 font-mono text-xs font-semibold',
                sign === 'negative'
                  ? 'bg-negative-soft'
                  : sign === 'positive'
                    ? 'bg-positive-soft'
                    : 'bg-raised',
              )}
            >
              <NumericText
                signed
                value={toFixedDecimal(change, 2)}
                suffix="%"
              />
            </span>
          )}
        </div>
        <dl className="m-0 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
          {[
            { label: d.chartHigh, value: price(ticker?.high24h) },
            { label: d.chartLow, value: price(ticker?.low24h) },
            {
              label: d.chartVolume,
              value: ticker?.quoteVolume24h
                ? compactDecimal(ticker.quoteVolume24h)
                : none,
            },
          ].map((each) => (
            <div key={each.label}>
              <dt className="text-muted-dim">{each.label}</dt>
              <dd className="m-0 mt-0.5 font-mono text-xs text-fg-2">
                {each.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="ml-auto flex items-center gap-4">
          <SegmentedControl
            label={d.chartTimeframes}
            value={timeframe}
            onChange={setTimeframe}
            options={TIMEFRAMES}
          />
          {pair && (
            <Link
              to={`/markets/spot/${pair.symbol}`}
              className="text-[12.5px] font-semibold no-underline"
            >
              {d.openAnalysis} →
            </Link>
          )}
        </div>
      </div>
      <div className="flex-1 p-3">
        {!pair || candles.isPending ? (
          <Skeleton className="h-72 w-full sm:h-80" />
        ) : candles.isError ? (
          <ErrorState
            variant="inline"
            message={errorText(copy, candles.error)}
            onRetry={() => void candles.refetch()}
          />
        ) : candles.data.length === 0 ? (
          <p className="flex h-72 items-center justify-center text-xs text-muted sm:h-80">
            {m.chartEmpty}
          </p>
        ) : (
          <PairChart
            candles={candles.data}
            tickSize={tick}
            timeframe={timeframe}
            className="h-72 w-full sm:h-80"
            label={formatCopy(d.chartLabel, {
              symbol: pair.symbol,
              timeframe: shownLabel,
            })}
          />
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-line px-4 py-2 text-[11px] text-muted-dim">
        <span>{formatCopy(d.chartCandles, { timeframe: shownLabel })}</span>
        <span>
          {formatCopy(copy.chart.timeZone, {
            zone: zoneLabel(chartOffsetSeconds(timeframe)),
          })}
        </span>
      </div>
    </section>
  );
}
