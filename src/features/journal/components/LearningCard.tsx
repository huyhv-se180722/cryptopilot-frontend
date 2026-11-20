import { AlertTriangle } from 'lucide-react';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { messageText } from '../../../i18n/messages';
import type { Decimal, JournalLearning } from '../../../types/domain';
import { trimDecimal } from '../../../utils/decimal-format';
import { formatInstantLocal } from '../../../utils/instant-format';
import {
  planAmount,
  planPrice,
  planRatio,
} from '../../trading-plan/components/plan-format';
import { Fact } from './TradeFacts';

/**
 * What a simulated trade teaches (SCR-21, BR-70, D-111): the plan
 * against the fill, the setup score at both moments with the MSG55
 * warning, and the path of the price while open, in R. Values come as
 * the server records them; a dash is one it did not record.
 */
export function LearningCard({
  learning,
  symbol,
  entryPrice,
}: {
  learning: JournalLearning;
  symbol: string;
  entryPrice: Decimal;
}) {
  const copy = useCopy();
  const j = copy.journal;
  const none = copy.market.noValue;
  const r = (value: Decimal | null, signed = true) =>
    value === null ? (
      none
    ) : (
      <NumericText value={planRatio(value)} signed={signed} suffix=" R" />
    );
  const price = (value: Decimal | null) =>
    value === null ? none : planPrice(value);
  const score = (value: Decimal | null) =>
    value === null ? none : trimDecimal(value, 0);
  const indicators = learning.indicators;
  return (
    <>
      <p className="mb-2 text-[11px] text-muted-dim">{j.learningHint}</p>
      {learning.setupScoreDropWarned && (
        <p
          role="status"
          className="mb-3 flex items-start gap-2 rounded-lg border border-warning-line bg-warning-soft px-3 py-2 text-xs text-fg-2"
        >
          <AlertTriangle
            size={14}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-warning"
          />
          {messageText(copy, 'MSG55', [], {
            pair: symbol,
            scoreAtFill: score(learning.setupScoreAtFill),
            scoreAtPlan: score(learning.setupScoreAtPlan),
          })}
        </p>
      )}
      <dl className="m-0">
        <Fact label={j.plannedEntry}>{price(learning.plannedEntryPrice)}</Fact>
        <Fact label={j.columnEntry}>{planPrice(entryPrice)}</Fact>
        <Fact label={j.entryDeviation} hint={j.entryDeviationHint}>
          {r(learning.entryDeviationR, false)}
        </Fact>
        <Fact label={j.entryLiquidity}>
          {learning.entryLiquidity
            ? j[`liquidity${learning.entryLiquidity}`]
            : none}
        </Fact>
        <Fact label={j.plannedRisk}>
          {learning.riskAmount === null
            ? none
            : planAmount(learning.riskAmount) + ' USDT'}
        </Fact>
        <Fact label={j.analysisTimeframe}>
          {learning.analysisTimeframe ?? none}
        </Fact>
        <Fact
          label={j.setupScore}
          hint={learning.setupScorePreset ?? undefined}
        >
          {formatCopy(j.setupScoreAt, {
            plan: score(learning.setupScoreAtPlan),
            fill: score(learning.setupScoreAtFill),
          })}
        </Fact>
        <Fact label={j.rMultiple}>{r(learning.rMultiple)}</Fact>
        <Fact label={j.maeR}>{r(learning.maeR, false)}</Fact>
        <Fact label={j.mfeR}>{r(learning.mfeR, false)}</Fact>
        <Fact label={j.maxAdversePrice}>{price(learning.maxAdversePrice)}</Fact>
        <Fact label={j.maxFavorablePrice}>
          {price(learning.maxFavorablePrice)}
        </Fact>
      </dl>
      {indicators && (
        <>
          <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-dim">
            {formatCopy(j.indicatorsTitle, {
              timeframe: indicators.timeframe ?? none,
              time:
                indicators.openTime === null
                  ? none
                  : formatInstantLocal(indicators.openTime),
            })}
          </h3>
          <dl className="m-0">
            <Fact label={j.macdLine}>{indicators.macdLine ?? none}</Fact>
            <Fact label={j.macdSignal}>{indicators.macdSignal ?? none}</Fact>
            <Fact label={j.macdHistogram}>
              {indicators.macdHistogram ?? none}
            </Fact>
          </dl>
        </>
      )}
    </>
  );
}
