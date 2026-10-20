import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Info, Loader2, Play, Save } from 'lucide-react';
import { Alert as Banner } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
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
import type {
  MarketPair,
  PlanDirection,
  TradingPlan,
} from '../../../types/domain';
import { pairLabel } from '../../../utils/pair-label';
import { usePlanCalculation, useSavePlan } from '../hooks/use-plan-editor';
import { Panel, PlanSnapshotRows, PlanWarningsPanel } from './PlanDetailPanels';
import { planPrice } from './plan-format';
import {
  NOTE_MAX,
  draftOfPlan,
  serverFieldError,
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
];

function errorMessage(
  copy: Copy,
  error: PlanFieldError,
  label: string,
  direction: PlanDirection,
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
    case 'order':
      return messageText(copy, 'MSG16', [], {
        direction: p[`directionName${direction}`],
        rule: p[`rule${direction}`],
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

/**
 * SCR-17 in edit mode (SRS 3.5.1, UC-17) for a DRAFT (BR-32): the inputs on
 * the left; on the right the risk panel recalculated by the server as the
 * Trader types (BR-23…BR-27), the warnings with their severity (MSG17), and
 * Save as Draft (MSG14) or Save and Activate (MSG19; refused with MSG18 or
 * MSG27, nothing saved). The pair is fixed, named from the market lists
 * by its id (FEQ-01) when they still give it.
 */
export function PlanEditor({
  plan,
  pair,
}: {
  plan: TradingPlan;
  /** The plan's pair from the market lists; undefined when not known. */
  pair: MarketPair | undefined;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const navigate = useNavigate();
  const { show } = useToast();
  const [draft, setDraft] = useState<PlanDraft>(() => draftOfPlan(plan));
  const [touched, setTouched] = useState<ReadonlySet<PlanField>>(new Set());
  const [now] = useState(() => Date.now());
  const checked = useMemo(() => toInputs(draft, now), [draft, now]);
  const calculation = usePlanCalculation(
    plan.pairId,
    checked.ok ? checked.inputs : null,
  );
  const save = useSavePlan(plan.id);

  const change = (patch: Partial<PlanDraft>, field?: PlanField) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (field) setTouched((current) => new Set(current).add(field));
    save.reset();
  };

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
      ? errorMessage(copy, error, label, draft.direction)
      : undefined;
  };

  async function submit(activate: boolean) {
    if (!checked.ok) {
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
    navigate(`/plans/${plan.id}`);
  }

  const futures = draft.market === 'futures';
  const result = calculation.data;
  const blocked = result?.blocksActivation ?? plan.blocksActivation;
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
        <Section title={p.sectionPair}>
          <div>
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
          </div>
          <div>
            <span className={fieldLabelClass}>{p.marketField}</span>
            <p className="text-sm font-medium text-fg">
              {futures ? copy.market.futures : copy.market.spot}
            </p>
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
          {futures && (
            <p className="flex items-start gap-1.5 text-[11px] text-warning sm:col-span-2">
              <Info size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
              {p.futuresPending}
            </p>
          )}
        </Section>

        <Section title={p.sectionEntry}>
          <fieldset className="sm:col-span-2">
            <legend className={fieldLabelClass}>{p.entryType}</legend>
            <SegmentedControl
              label={p.entryType}
              value={draft.entryType}
              onChange={(entryType) => change({ entryType }, 'entryPrice')}
              options={(['LIMIT', 'MARKET'] as const).map((value) => ({
                value,
                label: p[`entry${value}`],
              }))}
            />
          </fieldset>
          {draft.entryType === 'LIMIT' ? (
            <Input
              label={p.entryPrice}
              inputMode="decimal"
              autoComplete="off"
              value={draft.entryPrice}
              onChange={(event) =>
                change({ entryPrice: event.target.value }, 'entryPrice')
              }
              error={errorOf('entryPrice', p.entryPrice)}
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
          warnings={result?.warnings ?? plan.warnings}
          blocked={blocked}
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
          <Button type="submit" disabled={save.pending}>
            <Save size={14} aria-hidden="true" />
            {p.saveDraft}
          </Button>
          <Button
            variant="secondary"
            disabled={save.pending || blocked}
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
            to={`/plans/${plan.id}`}
            className={buttonClassName('ghost', 'md', 'no-underline')}
          >
            {p.discard}
          </Link>
        </div>
      </div>
    </form>
  );
}
