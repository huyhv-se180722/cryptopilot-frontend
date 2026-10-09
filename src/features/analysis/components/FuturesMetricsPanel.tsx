import { useMemo, useState, type ReactNode } from 'react';
import { ErrorState } from '../../../components/feedback/States';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import type { FuturesMetrics } from '../../../types/domain';
import {
  compactDecimal,
  groupThousands,
  shiftDecimal,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import { formatInstantUtc } from '../../../utils/instant-format';
import {
  MetricChart,
  type MetricLine,
} from '../../chart/components/MetricChart';
import {
  METRIC_RANGES,
  useFuturesMetrics,
  type MetricRange,
} from '../hooks/use-futures-metrics';

type Metric = 'openInterest' | 'longShortRatio';
type RangeValue = `${MetricRange}`;

/** Lines of the selected metric; values stay decimal strings until drawn. */
function linesOf(metrics: FuturesMetrics, metric: Metric): MetricLine[] {
  if (metric === 'longShortRatio')
    return [
      {
        id: 'ratio',
        colorToken: '--cp-primary',
        scale: 'right',
        format: 'ratio',
        points: metrics.longShortRatio.map((point) => ({
          time: point.time,
          value: point.longShortRatio,
        })),
      },
    ];
  return [
    {
      id: 'contracts',
      colorToken: '--cp-primary',
      scale: 'left',
      format: 'amount',
      points: metrics.openInterest.map((point) => ({
        time: point.time,
        value: point.openInterest,
      })),
    },
    {
      id: 'value',
      colorToken: '--cp-accent',
      scale: 'right',
      format: 'amount',
      points: metrics.openInterest.flatMap((point) =>
        point.openInterestValue === null
          ? []
          : [{ time: point.time, value: point.openInterestValue }],
      ),
    },
  ];
}

function LegendItem({
  label,
  swatch,
  children,
}: {
  label: string;
  swatch?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {swatch && (
        <span aria-hidden="true" className={`h-0.5 w-3 rounded ${swatch}`} />
      )}
      <dt className="text-muted-dim">{label}</dt>
      <dd className="text-fg">{children}</dd>
    </div>
  );
}

/**
 * SCR-11 open interest (contracts and value) and global long/short
 * account ratio charts over the last 1, 3 or 7 days of the data the
 * system retains (SRS 3.3.3, BR-10). When less than the selected period
 * is stored, the panel states the available period; points are sparse.
 */
export function FuturesMetricsPanel({
  symbol,
  baseAsset,
}: {
  symbol: string;
  baseAsset: string;
}) {
  const copy = useCopy();
  const a = copy.analysis;
  const [metric, setMetric] = useState<Metric>('openInterest');
  const [days, setDays] = useState<MetricRange>(1);
  const query = useFuturesMetrics(symbol, days);
  const metrics = query.data;
  const lines = useMemo(
    () => (metrics ? linesOf(metrics, metric) : []),
    [metrics, metric],
  );
  const availableFrom = metrics?.availableFrom[metric] ?? null;
  const partial =
    metrics !== undefined &&
    availableFrom !== null &&
    Date.parse(availableFrom) > Date.parse(metrics.from);
  const latestOi = metrics?.openInterest.at(-1);
  const latestLs = metrics?.longShortRatio.at(-1);
  const latest = metric === 'openInterest' ? latestOi : latestLs;
  const empty = lines.every((line) => line.points.length === 0);
  const percent = (fraction: string) =>
    toFixedDecimal(shiftDecimal(fraction, 2), 2);

  return (
    <section
      aria-labelledby="futures-metrics-title"
      className="rounded-xl border border-line bg-surface p-3 sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2
          id="futures-metrics-title"
          className="mr-auto text-[10px] font-semibold tracking-widest text-muted-x uppercase"
        >
          {a.metricsTitle}
        </h2>
        <SegmentedControl
          label={a.metricLabel}
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'openInterest', label: a.metricOpenInterest },
            { value: 'longShortRatio', label: a.metricLongShort },
          ]}
        />
        <SegmentedControl<RangeValue>
          label={a.rangeLabel}
          value={`${days}`}
          onChange={(value) => setDays(Number(value) as MetricRange)}
          options={METRIC_RANGES.map((range) => ({
            value: `${range}`,
            label: a[`range${range}`],
          }))}
        />
      </div>
      {query.isPending ? (
        <Skeleton className="h-[250px] w-full" />
      ) : query.isError ? (
        <ErrorState
          message={errorText(copy, query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : empty ? (
        <p className="flex h-[220px] items-center justify-center text-xs text-muted">
          {a.metricsEmpty}
        </p>
      ) : (
        <>
          <dl className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {metric === 'openInterest' && latestOi && (
              <>
                <LegendItem
                  label={formatCopy(a.oiContracts, { asset: baseAsset })}
                  swatch="bg-primary"
                >
                  <NumericText
                    value={groupThousands(
                      toFixedDecimal(latestOi.openInterest, 3),
                    )}
                  />
                </LegendItem>
                <LegendItem label={a.oiValue} swatch="bg-accent">
                  {latestOi.openInterestValue ? (
                    <NumericText
                      value={compactDecimal(latestOi.openInterestValue)}
                    />
                  ) : (
                    copy.market.noValue
                  )}
                </LegendItem>
              </>
            )}
            {metric === 'longShortRatio' && latestLs && (
              <>
                <LegendItem label={a.lsRatio} swatch="bg-primary">
                  <NumericText
                    value={toFixedDecimal(latestLs.longShortRatio, 4)}
                  />
                </LegendItem>
                <LegendItem label={a.lsLongs}>
                  <NumericText
                    className="text-positive"
                    value={percent(latestLs.longAccountRatio)}
                    suffix="%"
                  />
                </LegendItem>
                <LegendItem label={a.lsShorts}>
                  <NumericText
                    className="text-negative"
                    value={percent(latestLs.shortAccountRatio)}
                    suffix="%"
                  />
                </LegendItem>
              </>
            )}
          </dl>
          <MetricChart
            label={formatCopy(a.metricsChartLabel, {
              symbol,
              metric:
                metric === 'openInterest'
                  ? a.metricOpenInterest
                  : a.metricLongShort,
              days,
            })}
            lines={lines}
          />
        </>
      )}
      {(partial || latest) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-dim">
          {partial && availableFrom && (
            <p role="note" className="text-warning">
              {formatCopy(a.metricsPartial, {
                from: formatInstantUtc(availableFrom),
              })}
            </p>
          )}
          {latest && (
            <p className="ml-auto">
              {formatCopy(a.metricsUpdated, {
                time: formatInstantUtc(latest.time),
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
