import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Alert as Banner } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { useCopy } from '../../../hooks/use-copy';
import { useFeature } from '../../../hooks/use-entitlement';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText, fieldErrorText, messageText } from '../../../i18n/messages';
import type { Copy } from '../../../i18n/locales/en';
import { problemOf } from '../../../services/api/errors';
import type {
  Alert,
  AlertIndicator,
  MarketType,
  PlanFeature,
  WatchlistItem,
} from '../../../types/domain';
import { pairLabel } from '../../../utils/pair-label';
import { useSaveAlert } from '../hooks/use-alerts';
import {
  CONDITIONS,
  CROSSES,
  FUTURES_INDICATORS,
  INDICATORS,
  MAX_EXPIRY_DAYS,
  MODES,
  PENDING_INDICATORS,
  TIMEFRAMES,
  draftOf,
  newDraft,
  shapeOf,
  toLocalInput,
  toRule,
  type AlertDraft,
  type AlertField,
  type ClientError,
} from './alert-form';

export type AlertDialogTarget =
  /** New alert on one of the watched pairs (the pair id comes from the row). */
  | {
      mode: 'create';
      pairs: readonly WatchlistItem[];
      pairId?: string;
      /** Preferred market, e.g. the analysis screen's; used when listed. */
      market?: MarketType;
    }
  | { mode: 'edit'; alert: Alert; item?: WatchlistItem };

/** The lowest tier with alert features (D-58; display only). */
const UPSELL_PLAN = 'PRO';

function listedOn(item: WatchlistItem | undefined, market: MarketType) {
  if (!item) return true;
  return market === 'spot' ? item.spotListed : item.futuresListed;
}

/**
 * SCR-14 Create / Edit Alert (SRS 3.4.2, UC-13): PRICE or INDICATOR with
 * the fields the combination takes, trigger mode with cooldown (BR-19),
 * channels and an optional expiry within 90 days. On FREE, INDICATOR,
 * Futures and the e-mail / push channels show a lock and MSG29 (CR-08);
 * the server decides in the end. FUNDING_RATE waits for Q-30.
 */
export function AlertDialog({
  target,
  onClose,
}: {
  /** null = closed. */
  target: AlertDialogTarget | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  const a = copy.alerts;
  const formId = useId();
  const editing = target?.mode === 'edit';
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      title={editing ? a.dialogEdit : a.dialogCreate}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {a.cancel}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={target?.mode === 'create' && target.pairs.length === 0}
          >
            {a.save}
          </Button>
        </>
      }
    >
      {target && (
        <AlertForm
          key={target.mode === 'edit' ? target.alert.id : 'new'}
          id={formId}
          target={target}
          onSaved={onClose}
        />
      )}
    </Dialog>
  );
}

function clientText(copy: Copy, error: ClientError, label: string): string {
  const a = copy.alerts;
  switch (error.kind) {
    case 'required':
      return fieldErrorText(copy, 'MSG01', label);
    case 'number':
      return formatCopy(a.errNumber, { field: label });
    case 'positive':
      return formatCopy(a.errPositive, { field: label });
    case 'range':
      return formatCopy(a.errRange, {
        field: label,
        min: error.min,
        max: error.max,
      });
    case 'cooldown':
      return formatCopy(a.errCooldown, { field: label });
    case 'expiry':
      return a.errExpiry;
  }
}

/** A server field error (MSG01 / MSG15) worded with the field's own range. */
function serverError(
  draft: AlertDraft,
  field: AlertField,
  messageId: string,
): ClientError {
  if (messageId !== 'MSG15') return { kind: 'required' };
  if (field === 'expiresAt') return { kind: 'expiry' };
  if (field === 'cooldownMinutes') return { kind: 'cooldown' };
  if (field === 'threshold')
    return shapeOf(draft).indicator === 'RSI_14'
      ? { kind: 'range', min: '0', max: '100' }
      : { kind: 'positive' };
  return { kind: 'required' };
}

const FIELDS: readonly AlertField[] = [
  'market',
  'indicator',
  'timeframe',
  'condition',
  'threshold',
  'cooldownMinutes',
  'expiresAt',
];

function AlertForm({
  id,
  target,
  onSaved,
}: {
  id: string;
  target: AlertDialogTarget;
  onSaved: () => void;
}) {
  const copy = useCopy();
  const a = copy.alerts;
  const { show } = useToast();
  const save = useSaveAlert();
  const pairs = target.mode === 'create' ? target.pairs : [];
  const [pairId, setPairId] = useState(
    target.mode === 'create'
      ? (target.pairId ??
          pairs.find((p) => p.spotListed || p.futuresListed)?.pairId ??
          '')
      : target.alert.pairId,
  );
  const item =
    target.mode === 'edit'
      ? target.item
      : pairs.find((pair) => pair.pairId === pairId);
  const [draft, setDraft] = useState<AlertDraft>(() =>
    target.mode === 'edit'
      ? draftOf(target.alert)
      : newDraft(
          target.market && listedOn(item, target.market)
            ? target.market
            : listedOn(item, 'spot')
              ? 'spot'
              : 'futures',
        ),
  );
  const [errors, setErrors] = useState<
    Partial<Record<AlertField, ClientError>>
  >({});
  const [upsell, setUpsell] = useState(false);
  // The expiry bounds are those of the moment the form opened.
  const [now] = useState(() => Date.now());
  const access = {
    INDICATOR_ALERT: useFeature('INDICATOR_ALERT'),
    FUTURES_ANALYSIS: useFeature('FUTURES_ANALYSIS'),
    EXTERNAL_ALERT_CHANNELS: useFeature('EXTERNAL_ALERT_CHANNELS'),
  } satisfies Partial<Record<PlanFeature, unknown>>;
  const locked = (feature: keyof typeof access) => access[feature] === 'locked';
  const shape = shapeOf(draft);

  const change = (patch: Partial<AlertDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
    save.reset();
  };

  function chooseMarket(market: MarketType) {
    if (market === 'futures' && locked('FUTURES_ANALYSIS')) {
      setUpsell(true);
      return;
    }
    change(
      market === 'spot' && shape.futuresOnly
        ? { market, indicator: 'RSI_14' }
        : { market },
    );
  }

  function chooseIndicator(indicator: AlertIndicator) {
    const crosses = indicator === 'MACD_CROSS' || indicator === 'EMA_CROSS';
    change({
      indicator,
      ...(crosses && !CROSSES.includes(draft.condition)
        ? { condition: 'CROSS_ABOVE' as const }
        : {}),
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const checked = toRule(draft);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    const result = await save.run(
      target.mode === 'edit' ? { alert: target.alert } : { pairId },
      checked.rule,
    );
    if (result.status === 'success') {
      show({ tone: 'success', message: messageText(copy, 'MSG14') });
      onSaved();
      return;
    }
    if (result.status !== 'error') return;
    const fieldErrors = problemOf(result.error)?.fieldErrors ?? {};
    const mapped: Partial<Record<AlertField, ClientError>> = {};
    for (const field of FIELDS) {
      const messageId = fieldErrors[field];
      if (messageId) mapped[field] = serverError(draft, field, messageId);
    }
    setErrors(mapped);
  }

  const problem = problemOf(
    save.state.status === 'error' ? save.state.error : null,
  );
  const fieldsRefused = Object.keys(errors).length > 0;
  const lockIcon = <Lock size={10} aria-hidden="true" />;
  const errorOf = (field: AlertField, label: string) => {
    const error = errors[field];
    return error ? clientText(copy, error, label) : undefined;
  };
  const thresholdLabel =
    shape.indicator === null
      ? a.priceField
      : shape.indicator === 'RSI_14'
        ? a.rsiField
        : a.percentField;

  return (
    <form id={id} onSubmit={(event) => void submit(event)} noValidate>
      <div className="grid gap-4">
        {target.mode === 'create' && pairs.length === 0 ? (
          <p className="text-xs text-muted">{a.pairNone}</p>
        ) : target.mode === 'create' && target.pairId === undefined ? (
          <Select
            label={a.pairField}
            value={pairId}
            onChange={(event) => {
              setPairId(event.target.value);
              save.reset();
            }}
          >
            {pairs.map((pair) => (
              <option
                key={pair.pairId}
                value={pair.pairId}
                disabled={!pair.spotListed && !pair.futuresListed}
              >
                {pairLabel(pair.symbol)}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-sm font-semibold text-fg">
            {pairLabel(
              target.mode === 'edit'
                ? target.alert.symbol
                : (item?.symbol ?? ''),
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-fg-2">
              {a.marketField}
            </legend>
            <SegmentedControl
              label={a.marketField}
              value={draft.market}
              onChange={chooseMarket}
              options={(['spot', 'futures'] as const)
                .filter(
                  (market) => listedOn(item, market) || market === draft.market,
                )
                .map((market) => ({
                  value: market,
                  label:
                    market === 'spot' ? copy.market.spot : copy.market.futures,
                  ...(market === 'futures' && locked('FUTURES_ANALYSIS')
                    ? { icon: lockIcon }
                    : {}),
                }))}
            />
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-fg-2">
              {a.typeField}
            </legend>
            <SegmentedControl
              label={a.typeField}
              value={draft.type}
              onChange={(type) => {
                if (type === 'INDICATOR' && locked('INDICATOR_ALERT'))
                  setUpsell(true);
                else change({ type });
              }}
              options={[
                { value: 'PRICE', label: a.typePRICE },
                {
                  value: 'INDICATOR',
                  label: a.typeINDICATOR,
                  ...(locked('INDICATOR_ALERT') ? { icon: lockIcon } : {}),
                },
              ]}
            />
          </fieldset>
        </div>
        {errors.market && (
          <p className="-mt-2 text-[11px] text-negative">{a.notListed}</p>
        )}
        {!listedOn(item, draft.market) && (
          <p className="-mt-2 text-[11px] text-negative">{a.notListed}</p>
        )}

        {upsell && (
          <Banner
            tone="info"
            title={messageText(copy, 'MSG29', [], { plan: UPSELL_PLAN })}
          >
            <Link to="/subscription" className="font-medium">
              {a.upgrade}
            </Link>
          </Banner>
        )}

        {shape.indicator !== null && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={a.indicatorField}
              value={draft.indicator}
              error={errorOf('indicator', a.indicatorField)}
              onChange={(event) =>
                chooseIndicator(event.target.value as AlertIndicator)
              }
            >
              {INDICATORS.map((indicator) => (
                <option
                  key={indicator}
                  value={indicator}
                  disabled={
                    PENDING_INDICATORS.has(indicator) ||
                    (FUTURES_INDICATORS.has(indicator) &&
                      draft.market !== 'futures')
                  }
                >
                  {a[`indicator${indicator}`]}
                  {PENDING_INDICATORS.has(indicator)
                    ? ` (${a.fundingPending})`
                    : ''}
                </option>
              ))}
            </Select>
            {shape.timeframe && (
              <Select
                label={a.timeframeField}
                value={draft.timeframe}
                error={errorOf('timeframe', a.timeframeField)}
                onChange={(event) =>
                  change({
                    timeframe: event.target.value as AlertDraft['timeframe'],
                  })
                }
              >
                {TIMEFRAMES.map((timeframe) => (
                  <option key={timeframe} value={timeframe}>
                    {timeframe}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={a.conditionField}
            value={draft.condition}
            error={errorOf('condition', a.conditionField)}
            onChange={(event) =>
              change({
                condition: event.target.value as AlertDraft['condition'],
              })
            }
          >
            {(shape.crossesOnly ? CROSSES : CONDITIONS).map((condition) => (
              <option key={condition} value={condition}>
                {a[`condition${condition}`]}
              </option>
            ))}
          </Select>
          {shape.threshold && (
            <Input
              label={thresholdLabel}
              inputMode="decimal"
              autoComplete="off"
              value={draft.threshold}
              onChange={(event) => change({ threshold: event.target.value })}
              error={errorOf('threshold', thresholdLabel)}
              {...(shape.indicator === null ? { hint: a.priceHint } : {})}
            />
          )}
        </div>

        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-fg-2">
            {a.triggerField}
          </legend>
          <SegmentedControl
            label={a.triggerField}
            value={draft.triggerMode}
            onChange={(triggerMode) => change({ triggerMode })}
            options={MODES.map((mode) => ({
              value: mode,
              label: a[`mode${mode}`],
            }))}
          />
          <p className="mt-1 text-[11px] text-muted-dim">{a.modeHint}</p>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={a.expiryField}
            type="datetime-local"
            value={draft.expiry}
            min={toLocalInput(new Date(now).toISOString())}
            max={toLocalInput(
              new Date(now + MAX_EXPIRY_DAYS * 86_400_000).toISOString(),
            )}
            onChange={(event) => change({ expiry: event.target.value })}
            error={errorOf('expiresAt', a.expiryField)}
            hint={a.expiryHint}
          />
          {draft.triggerMode === 'EVERY_TIME' && (
            <Input
              label={a.cooldownField}
              inputMode="numeric"
              autoComplete="off"
              value={draft.cooldown}
              onChange={(event) => change({ cooldown: event.target.value })}
              error={errorOf('cooldownMinutes', a.cooldownField)}
            />
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-fg-2">
            {a.channelsField}
          </legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox label={a.inApp} title={a.inAppHint} checked disabled />
            {(['notifyEmail', 'notifyPush'] as const).map((channel) => {
              const off = locked('EXTERNAL_ALERT_CHANNELS');
              const name = channel === 'notifyEmail' ? a.email : a.push;
              return (
                <Checkbox
                  key={channel}
                  label={
                    off ? (
                      <span className="inline-flex items-center gap-1">
                        {name}
                        <Lock size={10} aria-hidden="true" />
                        <span className="text-muted-x">
                          {formatCopy(a.locked, { plan: UPSELL_PLAN })}
                        </span>
                      </span>
                    ) : (
                      name
                    )
                  }
                  checked={draft[channel] && !off}
                  disabled={off}
                  onChange={(event) =>
                    change({ [channel]: event.target.checked })
                  }
                />
              );
            })}
          </div>
        </fieldset>

        {draft.type === 'INDICATOR' && (
          <p className="text-[11px] text-muted-dim">
            {a.indicatorNotEvaluated}
          </p>
        )}

        {problem && !fieldsRefused && save.state.status === 'error' && (
          <Banner tone="danger" title={errorText(copy, save.state.error)}>
            {(problem.code === 'PLAN_LIMIT_REACHED' ||
              problem.code === 'PLAN_FEATURE_NOT_INCLUDED') && (
              <Link to="/subscription" className="font-medium">
                {a.upgrade}
              </Link>
            )}
          </Banner>
        )}
        {!problem && save.state.status === 'error' && (
          <Banner tone="danger" title={errorText(copy, save.state.error)} />
        )}
      </div>
    </form>
  );
}
