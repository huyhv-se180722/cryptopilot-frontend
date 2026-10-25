import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Lock, Play, Save } from 'lucide-react';
import { Alert as Banner } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
} from '../../../components/ui/field-styles';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { useFeature } from '../../../hooks/use-entitlement';
import { useToast } from '../../../hooks/use-toast';
import { errorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type {
  MarketPair,
  MarketType,
  PlanEntryType,
  PlanTimeframe,
  TradingPlan,
} from '../../../types/domain';
import { pairLabel } from '../../../utils/pair-label';
import type { ChartPriceLine } from '../../chart/components/AnalysisChart';
import { usePlanCalculation, useSavePlan } from '../hooks/use-plan-editor';
import { Panel, PlanSnapshotRows, PlanWarningsPanel } from './PlanDetailPanels';
import { planFieldErrorText } from './plan-errors';
import { planPrice, shownExpectedFill } from './plan-format';
import { priceLines } from './plan-lines';
import {
  EMPTY_PLAN_DRAFT,
  NOTE_MAX,
  PLAN_TIMEFRAMES,
  draftOfPlan,
  drawablePrice,
  pricedEntry,
  serverFieldError,
  toInputs,
  type PlanDraft,
  type PlanField,
} from './plan-form';

const FIELDS: readonly PlanField[] = [
  'direction',
  'entryPrice',
  'stopLoss',
  'takeProfit',
  'capital',
  'riskPercent',
  'leverage',
  'expiresAt',
  'note',
  'invalidationPrice',
  'maxEntryDeviationR',
  'analysisTimeframe',
];

/**
 * The entry types offered. STOP is accepted by the backend but not yet
 * triggered by its engine (TP-B), so a new plan cannot pick it; a STOP
 * draft saved before keeps it.
 */
const OFFERED_ENTRY_TYPES: readonly PlanEntryType[] = ['LIMIT', 'MARKET'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-line bg-surface p-4">
      <legend className="sr-only">{title}</legend>
      <p
        aria-hidden="true"
        className="mb-3 text-[10px] font-semibold tracking-widest text-muted-x uppercase"
      >
        {title}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** What the editor works on: a DRAFT, or a new plan on a pair of a list. */
export type PlanEditorTarget =
  | {
      mode: 'edit';
      plan: TradingPlan;
      /** The plan's pair from the market lists; undefined when not known. */
      pair: MarketPair | undefined;
    }
  | {
      mode: 'create';
      /** The pairs a new plan can be on, by market (by the id of the list). */
      pairs: Readonly<Record<MarketType, readonly MarketPair[]>>;
      /** The market to start on, e.g. the analysis screen's. */
      market: MarketType;
      /** The pair to start on, e.g. the analysis screen's. */
      pairId: string | null;
      /**
       * The analysis timeframe of the Trader's trading style (D-112); null
       * when the profile could not be read, the server then chooses it.
       */
      timeframe: PlanTimeframe | null;
    };

/**
 * SCR-17 (SRS 3.5.1): a new plan (UC-16) or a DRAFT (UC-17, BR-32). The
 * inputs on the left, under the chart of the pair with the entry, stop loss
 * and take profit as typed; on the right the risk panel recalculated by the
 * server as the Trader types (BR-23…BR-27), the warnings with their severity
 * (MSG17), and Save as Draft (MSG14) or Save and Activate (MSG19; refused
 * with MSG18 or MSG27, nothing saved). A new plan picks its pair from the
 * market list by id (FEQ-01); a DRAFT's pair is fixed. Plan validity
 * (D-111, D-112): a STOP entry for breakouts (on a STOP draft only until
 * the engine triggers it), an invalidation price for a waiting LIMIT or
 * STOP, the plan's own entry deviation limit and the
 * analysis timeframe, defaulted from the trading style. The page draws the
 * chart, given the pair and the lines.
 */
export function PlanEditor({
  target,
  chart,
}: {
  target: PlanEditorTarget;
  chart?: (pair: MarketPair, lines: readonly ChartPriceLine[]) => ReactNode;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const navigate = useNavigate();
  const { show } = useToast();
  const plan = target.mode === 'edit' ? target.plan : null;
  // SRS 3.5.1: Futures plans are PRO and PREMIUM only (MSG29).
  const futuresLocked = useFeature('FUTURES_ANALYSIS') === 'locked';
  const [upsell, setUpsell] = useState(false);
  const startMarket: MarketType =
    target.mode === 'create' &&
    target.market === 'futures' &&
    !futuresLocked &&
    target.pairs.futures.length > 0
      ? 'futures'
      : 'spot';
  const entryTypes: readonly PlanEntryType[] =
    plan?.entryType === 'STOP'
      ? [...OFFERED_ENTRY_TYPES, 'STOP']
      : OFFERED_ENTRY_TYPES;
  const [draft, setDraft] = useState<PlanDraft>(() =>
    plan
      ? draftOfPlan(plan)
      : {
          ...EMPTY_PLAN_DRAFT,
          market: startMarket,
          leverage: startMarket === 'futures' ? '1' : '',
          analysisTimeframe:
            target.mode === 'create' ? (target.timeframe ?? '') : '',
        },
  );
  const [chosenPairId, setChosenPairId] = useState(() =>
    target.mode === 'create'
      ? (target.pairs[startMarket].find((each) => each.pairId === target.pairId)
          ?.pairId ??
        target.pairs[startMarket][0]?.pairId ??
        '')
      : '',
  );
  const pairId = plan ? plan.pairId : chosenPairId;
  const choices =
    target.mode === 'create' ? target.pairs[draft.market] : undefined;
  const pair =
    target.mode === 'edit'
      ? target.pair
      : choices?.find((each) => each.pairId === chosenPairId);
  const [touched, setTouched] = useState<ReadonlySet<PlanField>>(new Set());
  const [now] = useState(() => Date.now());
  const checked = useMemo(() => toInputs(draft, now), [draft, now]);
  const calculation = usePlanCalculation(
    pairId,
    checked.ok && pairId ? checked.inputs : null,
  );
  const save = useSavePlan(plan?.id ?? null, pairId);

  const change = (patch: Partial<PlanDraft>, field?: PlanField) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (field) setTouched((current) => new Set(current).add(field));
    save.reset();
  };

  /**
   * A new plan's market: the same coin on the other market when it is
   * listed there, else its first pair; Spot is long only, Futures starts
   * at 1x. A locked Futures says why instead (MSG29).
   */
  function chooseMarket(market: MarketType) {
    if (target.mode !== 'create' || market === draft.market) return;
    if (market === 'futures' && futuresLocked) {
      setUpsell(true);
      return;
    }
    setUpsell(false);
    const list = target.pairs[market];
    const symbol = pair?.symbol;
    setChosenPairId(
      (list.find((each) => each.symbol === symbol) ?? list[0])?.pairId ?? '',
    );
    change(
      market === 'spot'
        ? { market, direction: 'LONG', leverage: '' }
        : { market, leverage: draft.leverage || '1' },
      'direction',
    );
  }

  // Client errors once a field was changed (all of them after a save);
  // then the server's field errors of the last calculation or save.
  const saveProblem = problemOf(
    save.state.status === 'error' ? save.state.error : null,
  );
  const serverFields = {
    ...calculation.fieldErrors,
    ...(saveProblem?.fieldErrors ?? {}),
  };
  const errorOf = (field: PlanField, label: string) => {
    const client = checked.ok ? undefined : checked.errors[field];
    const error =
      client && touched.has(field)
        ? client
        : !client && serverFields[field]
          ? serverFieldError(field, serverFields[field])
          : undefined;
    return error
      ? planFieldErrorText(copy, error, label, draft.direction)
      : undefined;
  };

  async function submit(activate: boolean) {
    if (!checked.ok || !pairId) {
      setTouched(new Set(FIELDS));
      return;
    }
    const result = await save.run(checked.inputs, activate);
    if (result.status !== 'success') return;
    show({
      tone: 'success',
      message: messageText(
        copy,
        result.data.status === 'DRAFT' ? 'MSG14' : 'MSG19',
      ),
    });
    navigate(`/plans/${result.data.id}`);
  }

  const futures = draft.market === 'futures';
  const priced = pricedEntry(draft.entryType);
  const stopEntry = draft.entryType === 'STOP';
  const result = calculation.data;
  const expectedFill = result
    ? shownExpectedFill(result.entryPrice, result.expectedFillPrice)
    : null;
  const blocked = result?.blocksActivation ?? plan?.blocksActivation ?? false;
  // The chart reads the candles of the plan's own market.
  const charted = pair && pair.market === draft.market ? pair : null;
  const lines = priceLines(
    {
      entry: priced
        ? drawablePrice(draft.entryPrice)
        : (result?.entryPrice ?? null),
      stopLoss: drawablePrice(draft.stopLoss),
      takeProfit: drawablePrice(draft.takeProfit),
      liquidation: futures
        ? (result?.snapshot.estimatedLiquidationPrice ?? null)
        : null,
      invalidation: priced ? drawablePrice(draft.invalidationPrice) : null,
    },
    {
      entry: stopEntry ? p.stopEntryPrice : p.colEntry,
      stopLoss: p.colStopLoss,
      takeProfit: p.colTakeProfit,
      liquidation: p.lineLiquidation,
      invalidation: p.invalidationPrice,
    },
  );
  const panelProblem = calculation.fieldErrors.quantity
    ? p.riskQuantity
    : calculation.fieldErrors.notional
      ? p.riskNotional
      : null;
  const calcFailed =
    calculation.isError && Object.keys(calculation.fieldErrors).length === 0;
  const noteId = 'plan-note';
  const noteError = errorOf('note', p.note);

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void submit(false);
      }}
      noValidate
      className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="flex min-w-0 flex-col gap-4">
        {charted && chart?.(charted, lines)}
        <Section title={p.sectionPair}>
          <div>
            {target.mode === 'create' ? (
              <Select
                label={p.pairField}
                value={chosenPairId}
                onChange={(event) => {
                  setChosenPairId(event.target.value);
                  save.reset();
                }}
              >
                {(choices ?? []).map((each) => (
                  <option key={each.pairId} value={each.pairId}>
                    {pairLabel(each.symbol)}
                  </option>
                ))}
              </Select>
            ) : (
              <>
                <span className={fieldLabelClass}>{p.pairField}</span>
                {pair ? (
                  <p className="text-sm font-medium text-fg">
                    {pairLabel(pair.symbol)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-x" title={p.pairUnknown}>
                    {copy.market.noValue}
                    <span className="sr-only"> {p.pairUnknown}</span>
                  </p>
                )}
              </>
            )}
          </div>
          {target.mode === 'create' ? (
            <fieldset>
              <legend className={fieldLabelClass}>{p.marketField}</legend>
              <SegmentedControl
                label={p.marketField}
                value={draft.market}
                onChange={chooseMarket}
                options={(['spot', 'futures'] as const)
                  .filter(
                    (market) =>
                      market === 'spot' || target.pairs.futures.length > 0,
                  )
                  .map((market) => ({
                    value: market,
                    label:
                      market === 'spot'
                        ? copy.market.spot
                        : copy.market.futures,
                    ...(market === 'futures' && futuresLocked
                      ? { icon: <Lock size={10} aria-hidden="true" /> }
                      : {}),
                  }))}
              />
            </fieldset>
          ) : (
            <div>
              <span className={fieldLabelClass}>{p.marketField}</span>
              <p className="text-sm font-medium text-fg">
                {futures ? copy.market.futures : copy.market.spot}
              </p>
            </div>
          )}
          {upsell && (
            <div className="sm:col-span-2">
              <Banner
                tone="info"
                title={messageText(copy, 'MSG29', [], { plan: 'PRO' })}
              >
                <Link to="/subscription" className="font-medium">
                  {p.upgrade}
                </Link>
              </Banner>
            </div>
          )}
          <div className="sm:col-span-2">
            {futures ? (
              <fieldset>
                <legend className={fieldLabelClass}>{p.directionField}</legend>
                <SegmentedControl
                  label={p.directionField}
                  value={draft.direction}
                  onChange={(direction) => change({ direction }, 'direction')}
                  options={(['LONG', 'SHORT'] as const).map((value) => ({
                    value,
                    label: p[`direction${value}`],
                    tone: value === 'LONG' ? 'positive' : 'negative',
                  }))}
                />
              </fieldset>
            ) : (
              <>
                <span className={fieldLabelClass}>{p.directionField}</span>
                <p className="text-sm font-medium text-positive">
                  {p.directionLONG}
                </p>
                <span className={fieldHintClass}>{p.spotLongOnly}</span>
              </>
            )}
          </div>
          <div className="sm:col-span-2">
            <Select
              label={p.timeframeField}
              value={draft.analysisTimeframe}
              onChange={(event) =>
                change(
                  {
                    analysisTimeframe: event.target
                      .value as PlanDraft['analysisTimeframe'],
                  },
                  'analysisTimeframe',
                )
              }
              error={errorOf('analysisTimeframe', p.timeframeField)}
              aria-describedby="plan-timeframe-hint"
            >
              {draft.analysisTimeframe === '' && (
                <option value="">{p.timeframeStyle}</option>
              )}
              {PLAN_TIMEFRAMES.map((timeframe) => (
                <option key={timeframe} value={timeframe}>
                  {timeframe}
                </option>
              ))}
            </Select>
            <span id="plan-timeframe-hint" className={fieldHintClass}>
              {p.timeframeHint}
            </span>
          </div>
        </Section>

        <Section title={p.sectionEntry}>
          <fieldset className="sm:col-span-2">
            <legend className={fieldLabelClass}>{p.entryType}</legend>
            <SegmentedControl
              label={p.entryType}
              value={draft.entryType}
              onChange={(entryType) => change({ entryType }, 'entryPrice')}
              options={entryTypes.map((value) => ({
                value,
                label: p[`entry${value}`],
              }))}
            />
            {stopEntry && (
              <span className={fieldHintClass}>{p.stopEntryHint}</span>
            )}
          </fieldset>
          {priced ? (
            <Input
              label={stopEntry ? p.stopEntryPrice : p.entryPrice}
              inputMode="decimal"
              autoComplete="off"
              value={draft.entryPrice}
              onChange={(event) =>
                change({ entryPrice: event.target.value }, 'entryPrice')
              }
              error={errorOf(
                'entryPrice',
                stopEntry ? p.stopEntryPrice : p.entryPrice,
              )}
            />
          ) : (
            <div>
              <span className={fieldLabelClass}>{p.marketEntryPrice}</span>
              <p className="text-sm text-fg">
                {result ? (
                  <NumericText value={planPrice(result.entryPrice)} />
                ) : (
                  copy.market.noValue
                )}
              </p>
              <span className={fieldHintClass}>{p.marketEntryNote}</span>
              {expectedFill && (
                <p className="mt-2 text-xs text-fg-2">
                  <span className="mr-1.5 text-[11px] text-muted-dim">
                    {p.expectedFill}
                  </span>
                  <NumericText value={planPrice(expectedFill)} />
                  <span className={fieldHintClass}>{p.expectedFillNote}</span>
                </p>
              )}
            </div>
          )}
        </Section>

        <Section title={p.sectionExits}>
          <Input
            label={p.stopLoss}
            inputMode="decimal"
            autoComplete="off"
            value={draft.stopLoss}
            onChange={(event) =>
              change({ stopLoss: event.target.value }, 'stopLoss')
            }
            error={errorOf('stopLoss', p.stopLoss)}
          />
          <Input
            label={p.takeProfit}
            inputMode="decimal"
            autoComplete="off"
            value={draft.takeProfit}
            onChange={(event) =>
              change({ takeProfit: event.target.value }, 'takeProfit')
            }
            error={errorOf('takeProfit', p.takeProfit)}
          />
        </Section>

        <Section title={p.sectionValidity}>
          {priced ? (
            <Input
              label={p.invalidationField}
              inputMode="decimal"
              autoComplete="off"
              value={draft.invalidationPrice}
              onChange={(event) =>
                change(
                  { invalidationPrice: event.target.value },
                  'invalidationPrice',
                )
              }
              error={errorOf('invalidationPrice', p.invalidationPrice)}
              hint={p.invalidationHint}
            />
          ) : (
            <div>
              <span className={fieldLabelClass}>{p.invalidationPrice}</span>
              <p className="text-sm text-muted">{p.invalidationMarket}</p>
            </div>
          )}
          <Input
            label={p.maxDeviationField}
            inputMode="decimal"
            autoComplete="off"
            value={draft.maxEntryDeviationR}
            onChange={(event) =>
              change(
                { maxEntryDeviationR: event.target.value },
                'maxEntryDeviationR',
              )
            }
            error={errorOf('maxEntryDeviationR', p.maxDeviation)}
            hint={p.maxDeviationHint}
          />
        </Section>

        <Section title={p.sectionSizing}>
          <Input
            label={p.capital}
            inputMode="decimal"
            autoComplete="off"
            value={draft.capital}
            onChange={(event) =>
              change({ capital: event.target.value }, 'capital')
            }
            error={errorOf('capital', p.capital)}
            hint={p.capitalHint}
          />
          <Input
            label={`${p.riskPercent} (%)`}
            inputMode="decimal"
            autoComplete="off"
            value={draft.riskPercent}
            onChange={(event) =>
              change({ riskPercent: event.target.value }, 'riskPercent')
            }
            error={errorOf('riskPercent', p.riskPercent)}
            hint={p.riskHint}
          />
          {futures && (
            <Input
              label={p.leverage}
              inputMode="numeric"
              autoComplete="off"
              value={draft.leverage}
              onChange={(event) =>
                change({ leverage: event.target.value }, 'leverage')
              }
              error={errorOf('leverage', p.leverage)}
              hint={p.leverageHint}
            />
          )}
          {futures && (
            <div>
              <span className={fieldLabelClass}>{p.marginMode}</span>
              <p className="text-sm font-medium text-fg">{p.isolated}</p>
              <span className={fieldHintClass}>{p.isolatedHint}</span>
            </div>
          )}
        </Section>

        <Section title={p.sectionExpiry}>
          <Input
            label={p.expiryField}
            type="datetime-local"
            value={draft.expiry}
            onChange={(event) =>
              change({ expiry: event.target.value }, 'expiresAt')
            }
            error={errorOf('expiresAt', p.expiryField)}
            hint={p.expiryHint}
          />
          <div className="sm:col-span-2">
            <label htmlFor={noteId} className={fieldLabelClass}>
              {p.note}
            </label>
            <textarea
              id={noteId}
              rows={3}
              maxLength={NOTE_MAX + 100}
              value={draft.note}
              onChange={(event) => change({ note: event.target.value }, 'note')}
              className={fieldControlClass}
              aria-invalid={noteError ? true : undefined}
              aria-describedby={noteId + '-help'}
            />
            <span
              id={noteId + '-help'}
              className={noteError ? fieldErrorClass : fieldHintClass}
            >
              {noteError ?? p.noteHint}
            </span>
          </div>
        </Section>
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <Panel
          id="plan-risk-title"
          title={p.riskTitle}
          aside={
            calculation.updating && result ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-dim">
                <Loader2
                  size={10}
                  aria-hidden="true"
                  className="animate-spin"
                />
                {p.riskUpdating}
              </span>
            ) : null
          }
        >
          <div aria-live="polite" aria-busy={calculation.updating}>
            {result ? (
              <div className={calculation.updating ? 'opacity-60' : undefined}>
                <PlanSnapshotRows snapshot={result.snapshot} single />
              </div>
            ) : calculation.isFetching ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              !calcFailed && <p className="text-xs text-muted">{p.riskIdle}</p>
            )}
            {panelProblem && (
              <p className="mt-3 text-[11px] text-negative">{panelProblem}</p>
            )}
            {!checked.ok && result && (
              <p className="mt-3 text-[11px] text-muted-dim">{p.riskStale}</p>
            )}
            {calcFailed && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-negative">
                {problemOf(calculation.error)?.code ===
                'MARKET_PRICE_UNAVAILABLE'
                  ? p.priceUnavailable
                  : errorText(copy, calculation.error)}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void calculation.refetch()}
                >
                  {p.retry}
                </Button>
              </div>
            )}
          </div>
          <p className="mt-3 border-t border-line pt-2 text-[10px] leading-relaxed text-muted-dim">
            {messageText(copy, 'MSG42')}
          </p>
        </Panel>
        <PlanWarningsPanel
          warnings={result?.warnings ?? plan?.warnings ?? []}
          blocked={blocked}
          feeShareOfRisk={
            (result?.snapshot ?? plan?.snapshot)?.feeShareOfRisk ?? null
          }
        />
        {saveProblem && Object.keys(saveProblem.fieldErrors).length === 0 && (
          <Banner
            tone="danger"
            title={errorText(
              copy,
              save.state.status === 'error' ? save.state.error : null,
            )}
          >
            {saveProblem.code === 'PLAN_LIMIT_REACHED' && (
              <Link to="/subscription" className="font-medium">
                {p.upgrade}
              </Link>
            )}
            {saveProblem.code === 'TRADING_BLOCKING_WARNING' && p.blockedHint}
          </Banner>
        )}
        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={save.pending || !pairId}>
            <Save size={14} aria-hidden="true" />
            {p.saveDraft}
          </Button>
          <Button
            variant="secondary"
            disabled={save.pending || blocked || !pairId}
            aria-describedby={blocked ? 'plan-activate-blocked' : undefined}
            onClick={() => void submit(true)}
          >
            <Play size={14} aria-hidden="true" />
            {p.saveActivate}
          </Button>
          {blocked && (
            <p id="plan-activate-blocked" className="text-[11px] text-negative">
              {messageText(copy, 'MSG18')}
            </p>
          )}
          <Link
            to={plan ? `/plans/${plan.id}` : '/plans'}
            className={buttonClassName('ghost', 'md', 'no-underline')}
          >
            {p.discard}
          </Link>
        </div>
      </div>
    </form>
  );
}
