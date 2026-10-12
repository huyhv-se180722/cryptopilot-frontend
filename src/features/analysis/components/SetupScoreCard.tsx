import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { useFeature } from '../../../hooks/use-entitlement';
import { formatCopy } from '../../../i18n/copy';
import { messageText } from '../../../i18n/messages';
import type { SetupScore } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { toFixedDecimal } from '../../../utils/decimal-format';

const COMPONENTS = [
  'trend',
  'momentum',
  'volume',
  'level',
  'derivatives',
] as const;
const LABELS = {
  trend: 'componentTrend',
  momentum: 'componentMomentum',
  volume: 'componentVolume',
  level: 'componentLevel',
  derivatives: 'componentDerivatives',
} as const;
const SIDE_TONE = {
  LONG: 'border-positive-line text-positive',
  SHORT: 'border-negative-line text-negative',
  NEUTRAL: 'border-line text-muted',
} as const;

/**
 * SCR-10 / SCR-11 setup score card (SRS 3.3.2, 3.3.3, BR-13, D-53): the
 * 0–100 score read with the Trader's preset, the preset name, version and
 * timeframe, and the MSG42 disclaimer (BR-60). Futures adds the
 * derivatives component and shows the dominant side beside the score, not
 * as part of it. Component scores are for PRO and PREMIUM; on FREE they
 * are locked with MSG29 (CR-08). A null is "Insufficient data", never 0.
 */
export function SetupScoreCard({ setup }: { setup: SetupScore }) {
  const copy = useCopy();
  const a = copy.analysis;
  const access = useFeature('SCORE_COMPONENTS');
  const score = setup.score;
  return (
    <section
      aria-labelledby="setup-score-title"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <h2
        id="setup-score-title"
        className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase"
      >
        {a.scoreTitle}
      </h2>
      {score === null ? (
        <p className="mb-2 text-sm font-medium text-muted">{a.insufficient}</p>
      ) : (
        <>
          <p className="mb-2 flex items-end gap-1.5">
            <span className="font-mono text-3xl font-bold tracking-tight text-fg tabular-nums">
              {score}
            </span>
            <span className="mb-1 text-xs text-muted-x">{a.scoreOutOf}</span>
            {setup.dominantSide && (
              <span
                className={classNames(
                  'mb-1 ml-auto rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
                  SIDE_TONE[setup.dominantSide],
                )}
              >
                <span className="sr-only">{a.dominantSide}: </span>
                {a[`dominant${setup.dominantSide}`]}
              </span>
            )}
          </p>
          <div
            role="meter"
            aria-label={a.scoreTitle}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={score}
            className="mb-2 h-1 overflow-hidden rounded-full bg-raised"
          >
            <div
              className="h-1 rounded-full bg-primary"
              style={{ width: `${score}%` }}
            />
          </div>
        </>
      )}
      <p className="mb-3 text-[11px] text-muted-dim">
        {formatCopy(a.presetLine, {
          preset: a[`preset${setup.preset}`],
          version: setup.presetVersion,
          timeframe: setup.timeframe,
        })}
      </p>
      <h3 className="mb-1.5 text-[11px] font-medium text-muted">
        {a.componentsTitle}
      </h3>
      {access === 'locked' ? (
        <div className="rounded-lg border border-dashed border-line p-3 text-[11px] text-muted">
          <p className="mb-2 flex items-start gap-1.5">
            <Lock size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
            {messageText(copy, 'MSG29', [], { plan: 'PRO' })}
          </p>
          <Link to="/subscription" className="font-medium">
            {a.viewPlans}
          </Link>
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          {COMPONENTS.filter(
            (name) => setup.components[name] !== undefined,
          ).map((name) => {
            const value = setup.components[name] ?? null;
            return (
              <div key={name} className="flex items-center justify-between">
                <dt className="text-[11px] text-muted-dim">
                  {a[LABELS[name]]}
                </dt>
                <dd className="font-mono text-[11px] font-semibold text-fg-2 tabular-nums">
                  {value === null ? (
                    // A dash keeps the two-column grid on one line per component.
                    <span title={a.insufficient}>
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">{a.insufficient}</span>
                    </span>
                  ) : (
                    toFixedDecimal(value, 0)
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <p className="mt-3 border-t border-line pt-2 text-[10px] leading-relaxed text-muted-dim">
        {messageText(copy, 'MSG42')}
      </p>
    </section>
  );
}
