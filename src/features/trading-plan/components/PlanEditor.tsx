import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Info, Loader2, Play, Save } from 'lucide-react';
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
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { Copy } from '../../../i18n/locales/en';
import { errorText, fieldErrorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import {
  DEVIATION_CONFIRM,
  DEVIATION_REFUSED,
  decodeDeviation,
} from '../../../services/api/trading-plan-dto';
import type {
  MarketPair,
  MarketType,
  PlanEntryType,
  TradingPlan,
} from '../../../types/domain';
import { compare } from '../../../utils/decimal-math';
import { pairLabel } from '../../../utils/pair-label';
import type { ChartPriceLine } from '../../chart/components/AnalysisChart';
import {
  usePlanCalculation,
  useSavePlan,
  useTraderProfile,
} from '../hooks/use-plan-editor';
import { DeviationConfirmDialog, DeviationRefusal } from './DeviationDialogs';
import { Panel, PlanSnapshotRows, PlanWarningsPanel } from './PlanDetailPanels';
import { planAmount, planPrice } from './plan-format';
import { priceLines } from './plan-lines';
import {
  EMPTY_PLAN_DRAFT,
  ENTRY_DEVIATION_BLOCK_R,
  NOTE_MAX,
  TIMEFRAMES,
  draftOfPlan,
  drawablePrice,
  serverFieldError,
  timeframeOfStyle,
  toInputs,
  type PlanDraft,
  type PlanField,
  type PlanFieldError,
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
const ENTRY_TYPES: readonly PlanEntryType[] = ['LIMIT', 'MARKET', 'STOP'];

function errorMessage(
  copy: Copy,
  error: PlanFieldError,
  label: string,
  direction: TradingPlan['direction'],
): string {
  const p = copy.plan;
  switch (error.kind) {
    case 'required':
      return fieldErrorText(copy, 'MSG01', label);
    case 'number':
      return formatCopy(p.errNumber, { field: label });
    case 'positive':
      return formatCopy(p.errPositive, { field: label });
    case 'range':
      return messageText(copy, 'MSG15', [], {
        field: label,
        min: error.min,
        max: error.max,
      });
    case 'leverage':
      return formatCopy(p.errLeverage, { field: label });
    case 'leverageBracket':
      return p.errLeverageBracket;
    case 'rule':
      return messageText(copy, 'MSG16', [], {
        direction: p[`directionName${direction}`],
        rule: p[`rule_${error.rule}`],
      });
    case 'future':
      return p.errFuture;
    case 'tooLong':
      return formatCopy(p.errTooLong, { field: label, max: error.max });
  }
}

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
      /** The pairs a new plan can be on, per market (by the id of the list). */
      pairs: Readonly<Record<MarketType, readonly MarketPair[]>>;
      /** The market to start on. */
      market: MarketType;
      /** The pair to start on, e.g. the analysis screen's. */
      pairId: string | null;
    };

/**
 * SCR-17 (SRS 3.5.1): a new plan (UC-16) or a DRAFT (UC-17, BR-32). The
 * inputs on the left, under the chart of the pair with the entry, stop loss
 * and take profit as typed; on the right the risk panel recalculated by the
 * server as the Trader types (BR-23…BR-27) with the expected fees (TP-0),
 * the warnings with their severity (MSG17), and Save as Draft (MSG14) or
 * Save and Activate (MSG19; refused with MSG18 or MSG27, nothing saved).
 * Entries are LIMIT, MARKET (the current price) or STOP (a breakout, TP-A);
 * the capital is the profile's (TP-D). A new plan picks its market and its
 * pair from the market list by id (FEQ-01); a DRAFT's pair is fixed. The
 * page draws the chart, given the pair and the lines.
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
  const [draft, setDraft] = useState<PlanDraft>(() =>
    plan
      ? draftOfPlan(plan)
      : target.mode === 'create'
        ? { ...EMPTY_PLAN_DRAFT, market: target.market }
        : EMPTY_PLAN_DRAFT,
  );
  const createPairs =
    target.mode === 'create' ? target.pairs[draft.market] : [];
  const [chosenPairId, setChosenPairId] = useState(() =>
    target.mode === 'create'
      ? (createPairs.find((each) => each.pairId === target.pairId)?.pairId ??
        createPairs[0]?.pairId ??
        '')
      : '',
  );
  const pairId = plan ? plan.pairId : chosenPairId;
  const pair =
    target.mode === 'edit'
      ? target.pair
      : createPairs.find((each) => each.pairId === chosenPairId);
  const [touched, setTouched] = useState<ReadonlySet<PlanField>>(new Set());
  const [now] = useState(() => Date.now());
  const profile = useTraderProfile();
  // The style's timeframe until the Trader picks one (TP-A).
  const styleTimeframe = profile.data
    ? timeframeOfStyle(profile.data.tradingStyle)
    : null;
  const timeframe = draft.timeframe || styleTimeframe || '1h';
  const checked = useMemo(
    () => toInputs(draft, now, styleTimeframe),
    [draft, now, styleTimeframe],
  );
  const calculation = usePlanCalculation(
    pairId,
    checked.ok && pairId ? checked.inputs : null,
  );
  const save = useSavePlan(plan?.id ?? null, pairId);
  const [activating, setActivating] = useState(false);
  // No double submit: `save.pending` only shows on the next render.
  const busy = useRef(false);

  const change = (patch: Partial<PlanDraft>, field?: PlanField) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (field) setTouched((current) => new Set(current).add(field));
    save.reset();
  };

  function changeMarket(market: MarketType) {
    if (target.mode !== 'create' || market === draft.market) return;
    change({
      market,
      // Spot is long only (BR-21); leverage is Futures only.
      ...(market === 'spot' ? { direction: 'LONG', leverage: '' } : {}),
    });
    setChosenPairId(target.pairs[market][0]?.pairId ?? '');
  }

  // Client errors once a field was changed (all of them after a save);
  // then the server's field errors of the last calculation or save.
  const saveProblem = problemOf(
    save.state.status === 'error' ? save.state.error : null,
  );
  const serverFields = calculation.fieldErrors;
  const saveFields = saveProblem?.fieldErrors ?? {};
  const serverError = (field: PlanField): PlanFieldError | undefined => {
    if (saveFields[field])
      return serverFieldError(field, saveFields[field], draft, activating);
    if (serverFields[field])
      return serverFieldError(field, serverFields[field], draft);
    return undefined;
  };
  const errorOf = (field: PlanField, label: string) => {
    const client = checked.ok ? undefined : checked.errors[field];
    const error =
      client && touched.has(field)
        ? client
        : !client
          ? serverError(field)
          : undefined;
    return error
      ? errorMessage(copy, error, label, draft.direction)
      : undefined;
  };

  async function submit(activate: boolean, confirmDeviation = false) {
    if (!checked.ok || !pairId) {
      setTouched(new Set(FIELDS));
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setActivating(activate);
    // MSG51 confirmed: the same body again, with the confirmation (TP-C).
    const result = await save
      .run(checked.inputs, activate, confirmDeviation)
      .finally(() => {
        busy.current = false;
      });
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
  const market = draft.entryType === 'MARKET';
  const stop = draft.entryType === 'STOP';
  const result = calculation.data;
  const blocked = result?.blocksActivation ?? plan?.blocksActivation ?? false;
  // The chart reads the candles of the plan's own market.
  const charted = pair && pair.market === draft.market ? pair : null;
  const lines = priceLines(
    {
      entry: !market
        ? drawablePrice(draft.entryPrice)
        : (result?.entryPrice ?? null),
      stopLoss: drawablePrice(draft.stopLoss),
      takeProfit: drawablePrice(draft.takeProfit),
      liquidation: futures
        ? (result?.snapshot.estimatedLiquidationPrice ?? null)
        : null,
      invalidation: !market ? drawablePrice(draft.invalidationPrice) : null,
      fill: null,
    },
    {
      entry: p.colEntry,
      stopLoss: p.colStopLoss,
      takeProfit: p.colTakeProfit,
      liquidation: p.lineLiquidation,
      invalidation: p.invalidationPrice,
      fill: p.lineFill,
    },
  );
  const panelProblem = calculation.fieldErrors.quantity
    ? p.riskQuantity
    : calculation.fieldErrors.notional
      ? p.riskNotional
      : null;
  const calcFailed =
    calculation.isError && Object.keys(calculation.fieldErrors).length === 0;
  const saveArgs = saveProblem?.messageArgs ?? [];
  const saveDeviation = decodeDeviation(saveProblem);
  const askDeviation =
    saveProblem?.code === DEVIATION_CONFIRM ? saveDeviation : null;
  const refusedDeviation =
    saveProblem?.code === DEVIATION_REFUSED ? saveDeviation : null;
  const noteId = 'plan-note';
  const noteError = errorOf('note', p.note);
  // TP-D: the profile's capital, or the one the last calculation used.
  const capital = profile.data?.defaultCapital ?? result?.capital ?? null;
  const capitalError = errorOf('capital', p.capital);
  // MARKET: show the expected fill only when the slippage moves it (TP-0).
  const expectedFill =
    result?.expectedFillPrice &&
    compare(result.expectedFillPrice, result.entryPrice) !== 0
      ? result.expectedFillPrice
      : null;

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
                {createPairs.map((each) => (
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
          <div>
            {target.mode === 'create' ? (
              <fieldset>
                <legend className={fieldLabelClass}>{p.marketField}</legend>
                <SegmentedControl
                  label={p.marketField}
                  value={draft.market}
                  onChange={changeMarket}
                  options={(['spot', 'futures'] as const).map((value) => ({
                    value,
                    label: copy.market[value],
                  }))}
                />
              </fieldset>
            ) : (
              <>
                <span className={fieldLabelClass}>{p.marketField}</span>
                <p className="text-sm font-medium text-fg">
                  {futures ? copy.market.futures : copy.market.spot}
                </p>
              </>
            )}
          </div>
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
        </Section>

        <Section title={p.sectionEntry}>
          <fieldset className="sm:col-span-2">
            <legend className={fieldLabelClass}>{p.entryType}</legend>
            <SegmentedControl
              label={p.entryType}
              value={draft.entryType}
              onChange={(entryType) => change({ entryType })}
              options={ENTRY_TYPES.map((value) => ({
                value,
                label: p[`entry${value}`],
              }))}
            />
            {stop && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-dim">
                <Info
                  size={12}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0"
                />
                {p.stopEntryHint}
              </p>
            )}
          </fieldset>
          {!market ? (
            <Input
              label={stop ? p.stopPrice : p.entryPrice}
              inputMode="decimal"
              autoComplete="off"
              value={draft.entryPrice}
              onChange={(event) =>
                change({ entryPrice: event.target.value }, 'entryPrice')
              }
              error={errorOf('entryPrice', stop ? p.stopPrice : p.entryPrice)}
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
              {expectedFill && (
                <p className="text-xs text-fg-2">
                  {p.expectedFill}{' '}
                  <NumericText value={planPrice(expectedFill)} />
                </p>
              )}
              <span className={fieldHintClass}>{p.marketEntryNote}</span>
            </div>
          )}
          {!market && (
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
          )}
          <Input
            label={p.maxDeviationField}
            inputMode="decimal"
            autoComplete="off"
            value={draft.maxEntryDeviation}
            onChange={(event) =>
              change(
                { maxEntryDeviation: event.target.value },
                'maxEntryDeviationR',
              )
            }
            error={errorOf('maxEntryDeviationR', p.maxDeviation)}
            hint={formatCopy(p.maxDeviationHint, {
              max: ENTRY_DEVIATION_BLOCK_R,
            })}
          />
          <div>
            <Select
              label={p.timeframeField}
              value={timeframe}
              onChange={(event) =>
                change(
                  { timeframe: event.target.value as PlanDraft['timeframe'] },
                  'analysisTimeframe',
                )
              }
              error={errorOf('analysisTimeframe', p.timeframeField)}
            >
              {TIMEFRAMES.map((each) => (
                <option key={each} value={each}>
                  {each}
                </option>
              ))}
            </Select>
            <span className={fieldHintClass}>{p.timeframeHint}</span>
          </div>
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

        <Section title={p.sectionSizing}>
          <div>
            <span className={fieldLabelClass}>{p.capital}</span>
            <p className="text-sm text-fg">
              {capital ? (
                <NumericText value={planAmount(capital)} />
              ) : (
                copy.market.noValue
              )}
            </p>
            <span className={capitalError ? fieldErrorClass : fieldHintClass}>
              {capitalError ? p.capitalMissing : p.capitalHint}{' '}
              <Link to="/profile">{p.capitalLink}</Link>
            </span>
          </div>
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
          feeShareOfRisk={(result ?? plan)?.snapshot.feeShareOfRisk ?? null}
        />
        {refusedDeviation && (
          <DeviationRefusal
            deviation={refusedDeviation}
            messageArgs={saveArgs}
          />
        )}
        {saveProblem &&
          !askDeviation &&
          !refusedDeviation &&
          Object.keys(saveProblem.fieldErrors).length === 0 && (
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
        <DeviationConfirmDialog
          deviation={askDeviation}
          messageArgs={saveArgs}
          pending={save.pending}
          onConfirm={() => void submit(true, true)}
          onBack={save.reset}
        />
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
