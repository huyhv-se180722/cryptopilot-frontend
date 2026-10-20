import { useId, useRef, useState, type FormEvent } from 'react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Checkbox } from '../../../components/ui/Checkbox';
import { DecimalInput } from '../../../components/ui/DecimalInput';
import { Input } from '../../../components/ui/Input';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type { Decimal, MarketPair } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { groupThousands } from '../../../utils/decimal-format';
import { toStep } from '../../../utils/decimal-math';
import { usePaperActions } from '../hooks/use-paper-orders';
import {
  amountOf,
  checkSpotOrder,
  EMPTY_DRAFT,
  hasLimitPrice,
  shareOfFunds,
  totalOf,
  type Funds,
  type SpotFormType,
  type SpotOrderDraft,
  type SpotOrderField,
  type SpotOrderProblem,
} from '../model/spot-order';

const SHARES = [25, 50, 75, 100] as const;
const STOP_FORMS = ['STOP_LIMIT', 'STOP_MARKET', 'TRAILING', 'OCO'] as const;
type StopForm = (typeof STOP_FORMS)[number];
const isStopForm = (type: SpotFormType): type is StopForm =>
  (STOP_FORMS as readonly string[]).includes(type);

/** A price picked in the order book or trades; `at` makes a repeat count. */
export interface PickedPrice {
  price: Decimal;
  at: number;
}

const newClientOrderId = () => 'web-' + crypto.randomUUID();

/**
 * Spot order form of the demo exchange, as the exchange's Spot order panel
 * has it: Buy / Sell; Limit (time in force, Post only for a LIMIT_MAKER,
 * TP/SL for an OTOCO), Market (by amount or by total, on both sides), and
 * under Stop the Stop Limit, Stop Market, Trailing Stop and OCO forms. A
 * stop is sent as a stop loss or a take profit by where it lies against
 * the last price, as the exchange's panel does. It checks tick, step,
 * minimum value and balance before sending (exact decimals, D-95), keeps
 * the idempotency key when the same order is sent again, and says why it
 * cannot trade while the demo account is not available. Demo funds only:
 * nothing reaches an exchange.
 */
export function SpotOrderForm({
  pair,
  lastPrice,
  picked,
  funds,
  unavailable,
}: {
  pair: MarketPair;
  lastPrice: Decimal | null;
  picked: PickedPrice | null;
  /** Free balances, or null while the wallet is not known. */
  funds: Funds | null;
  /** Why the demo account cannot trade now (e.g. not connected), or null. */
  unavailable: string | null;
}) {
  const copy = useCopy();
  const p = copy.paper;
  const toast = useToast();
  const { place, placeList } = usePaperActions();
  const pairId = pair.pairId;
  const base = pair.baseAsset ?? pair.symbol;
  const quote = pair.quoteAsset ?? '';
  const [draft, setDraft] = useState<SpotOrderDraft>(EMPTY_DRAFT);
  const [stopForm, setStopForm] = useState<StopForm>('STOP_LIMIT');
  const [shown, setShown] = useState(false);
  const [serverErrors, setServerErrors] = useState<
    Partial<Record<SpotOrderField, SpotOrderProblem>>
  >({});
  const [notice, setNotice] = useState<string | null>(null);
  const sent = useRef<{ key: string; id: string } | null>(null);
  const reasonId = useId();

  // A price picked in the book becomes the limit price (once per pick).
  const [seenPick, setSeenPick] = useState(picked?.at ?? 0);
  if (picked && picked.at !== seenPick) {
    setSeenPick(picked.at);
    setDraft((current) => {
      const type = hasLimitPrice(current.type) ? current.type : 'LIMIT';
      return {
        ...current,
        type,
        price: picked.price,
        total: totalOf(
          { type, price: picked.price, stop: current.stop },
          current.amount,
          lastPrice,
        ),
      };
    });
  }

  const available = funds ?? { quote: '0', base: '0' };
  const check = checkSpotOrder(draft, pair, available, lastPrice);
  const buy = draft.side === 'BUY';
  const type = draft.type;
  const market = type === 'MARKET';
  const byTotal = market && draft.byTotal;
  const pending = place.pending || placeList.pending;

  const update = (next: Partial<SpotOrderDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setServerErrors({});
    setNotice(null);
  };
  const changeType = (next: SpotFormType) =>
    update({
      type: next,
      total:
        next === 'MARKET'
          ? ''
          : totalOf({ ...draft, type: next }, draft.amount, lastPrice),
    });

  const problemText = (problem: SpotOrderProblem | undefined) => {
    switch (problem) {
      case 'required':
        return p.errRequired;
      case 'invalid':
        return p.errInvalid;
      case 'belowStep':
        return formatCopy(p.errBelowStep, { step: pair.stepSize ?? '' });
      case 'minNotional':
        return formatCopy(p.errMinNotional, {
          min: pair.minNotional ?? '',
          asset: quote,
        });
      case 'insufficient':
        return p.errInsufficient;
      case 'atLastPrice':
        return p.errAtLastPrice;
      case 'noLastPrice':
        return p.errNoLastPrice;
      case 'trailingRange':
        return p.errTrailingRange;
      case 'priceOrder':
        return p.errPriceOrder;
      default:
        return undefined;
    }
  };
  const fieldError = (field: SpotOrderField) =>
    problemText(
      serverErrors[field] ?? (shown ? check.errors[field] : undefined),
    );

  const succeeded = (message: string, tone: 'success' | 'info' = 'success') => {
    sent.current = null;
    setShown(false);
    setDraft((current) => ({ ...current, amount: '', total: '' }));
    toast.show({ tone, message });
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setShown(true);
    if (unavailable || !check.request) return;
    const request = check.request;
    // The same order sent again (e.g. after a timeout) keeps its key, so the
    // backend returns the first one instead of placing a second (TR-06).
    const key = JSON.stringify(request);
    if (sent.current?.key !== key)
      sent.current = { key, id: newClientOrderId() };
    if (request.kind === 'list') {
      const result = await placeList.run({
        ...request.list,
        pairId,
        market: 'spot',
      });
      if (result.status === 'success')
        return succeeded(formatCopy(p.listPlaced, { type: result.data.type }));
      if (result.status === 'error') refused(result.error);
      return;
    }
    const result = await place.run({
      ...request.order,
      pairId,
      market: 'spot',
      clientOrderId: sent.current.id,
    });
    if (result.status === 'success')
      return succeeded(
        formatCopy(p.placed, {
          side: buy ? p.sideBUY : p.sideSELL,
          status: p[`status${result.data.status}`].toLowerCase(),
        }),
      );
    if (result.status === 'error') refused(result.error);
  }

  function refused(error: unknown) {
    const problem = problemOf(error);
    switch (problem?.code) {
      case 'PAPER_INSUFFICIENT_BALANCE':
        return setNotice(p.insufficientServer);
      case 'PAPER_ORDER_WOULD_TAKE':
        return setNotice(p.postOnlyRefused);
      case 'PAPER_ORDER_WOULD_TRIGGER':
        return setNotice(p.wouldTrigger);
    }
    const fields: Partial<Record<SpotOrderField, SpotOrderProblem>> = {};
    const aliases: Record<string, SpotOrderField> = {
      price: 'price',
      stopPrice: 'stop',
      trailingDelta: 'trailing',
      quantity: 'amount',
      quoteOrderQty: 'total',
      'oco.takeProfitPrice': type === 'OCO' ? 'price' : 'takeProfit',
      'oco.stopPrice': type === 'OCO' ? 'stop' : 'stopLoss',
      'oco.stopLimitPrice': 'stopLimit',
      'oco.quantity': 'amount',
      'working.price': 'price',
      'working.quantity': 'amount',
    };
    for (const [name, messageId] of Object.entries(
      problem?.fieldErrors ?? {},
    )) {
      const field = aliases[name];
      if (field) fields[field] = messageId === 'MSG01' ? 'required' : 'invalid';
    }
    if (Object.keys(fields).length > 0) setServerErrors(fields);
    else setNotice(errorText(copy, error));
  }

  const share = (percent: number) =>
    update(shareOfFunds(draft, pair, available, percent, lastPrice));

  const priceInput = (field: 'price' | 'stop' | 'stopLimit', label: string) => (
    <DecimalInput
      label={label}
      autoComplete="off"
      value={draft[field]}
      error={fieldError(field)}
      onValueChange={(value) => {
        const next = { ...draft, [field]: value };
        update({
          [field]: value,
          total: totalOf(next, draft.amount, lastPrice),
        });
      }}
    />
  );

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label={p.sideLabel}
          value={draft.side}
          onChange={(side) => update({ side })}
          options={[
            { value: 'BUY', label: p.sideBUY },
            { value: 'SELL', label: p.sideSELL },
          ]}
        />
        <SegmentedControl
          label={p.orderTypeLabel}
          value={isStopForm(type) ? 'STOP' : type}
          onChange={(next) => changeType(next === 'STOP' ? stopForm : next)}
          options={[
            { value: 'LIMIT', label: p.typeLIMIT },
            { value: 'MARKET', label: p.typeMARKET },
            { value: 'STOP', label: p.formSTOP },
          ]}
        />
      </div>

      {isStopForm(type) && (
        <Select
          label={p.stopFormLabel}
          value={type}
          onChange={(event) => {
            const next = event.target.value as StopForm;
            setStopForm(next);
            changeType(next);
          }}
        >
          {STOP_FORMS.map((form) => (
            <option key={form} value={form}>
              {p[`form${form}`]}
            </option>
          ))}
        </Select>
      )}

      <p className="flex items-baseline justify-between text-[11px] text-muted-dim">
        {p.available}
        <span className="text-fg-2">
          {funds ? (
            <NumericText
              value={
                buy
                  ? // Two digits, rounded down: never more than is free.
                    groupThousands(toStep(funds.quote, '0.01', 'down'))
                  : groupThousands(
                      toStep(funds.base, pair.stepSize ?? '0.00000001', 'down'),
                    )
              }
              suffix={' ' + (buy ? quote : base)}
            />
          ) : (
            copy.market.noValue
          )}
        </span>
      </p>

      {(type === 'STOP_LIMIT' || type === 'STOP_MARKET') &&
        priceInput('stop', formatCopy(p.fieldStop, { asset: quote }))}
      {type === 'TRAILING' && (
        <Input
          label={p.fieldTrailing}
          inputMode="decimal"
          autoComplete="off"
          value={draft.trailing}
          error={fieldError('trailing')}
          onChange={(event) => update({ trailing: event.target.value })}
        />
      )}
      {type === 'TRAILING' &&
        priceInput('stop', formatCopy(p.fieldActivation, { asset: quote }))}

      {market ? (
        <Input
          label={formatCopy(p.fieldPrice, { asset: quote })}
          value={p.marketPrice}
          readOnly
          aria-readonly="true"
        />
      ) : type === 'STOP_MARKET' ? null : (
        priceInput(
          'price',
          formatCopy(
            type === 'OCO'
              ? p.fieldTakeProfitPrice
              : type === 'LIMIT'
                ? p.fieldPrice
                : p.fieldLimit,
            { asset: quote },
          ),
        )
      )}

      {type === 'OCO' && (
        <>
          {priceInput('stop', formatCopy(p.fieldStop, { asset: quote }))}
          {priceInput(
            'stopLimit',
            formatCopy(p.fieldStopLimit, { asset: quote }),
          )}
        </>
      )}

      {!byTotal && (
        <DecimalInput
          label={formatCopy(p.fieldAmount, { asset: base })}
          autoComplete="off"
          value={draft.amount}
          error={fieldError('amount')}
          onValueChange={(amount) => {
            update({ amount, total: totalOf(draft, amount, lastPrice) });
          }}
        />
      )}

      <div
        role="group"
        aria-label={p.shareLabel}
        className="grid grid-cols-4 gap-1.5"
      >
        {SHARES.map((percent) => (
          <button
            key={percent}
            type="button"
            disabled={!funds}
            onClick={() => share(percent)}
            className="h-7 rounded-md border border-line text-[11px] font-medium text-muted hover:border-primary-line hover:text-primary disabled:opacity-50 pointer-coarse:h-9"
          >
            {formatCopy(p.sharePercent, { percent })}
          </button>
        ))}
      </div>

      <DecimalInput
        label={formatCopy(p.fieldTotal, { asset: quote })}
        autoComplete="off"
        value={draft.total}
        readOnly={market && !byTotal}
        error={fieldError('total')}
        onValueChange={(total) => {
          update(
            byTotal
              ? { total }
              : { total, amount: amountOf(draft, total, pair, lastPrice) },
          );
        }}
      />

      {market && (
        <Checkbox
          label={buy ? p.byTotal : p.byTotalSell}
          checked={draft.byTotal}
          onChange={(event) =>
            update({ byTotal: event.target.checked, amount: '', total: '' })
          }
        />
      )}

      {type === 'LIMIT' && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Checkbox
            label={p.postOnly}
            checked={draft.postOnly}
            onChange={(event) => update({ postOnly: event.target.checked })}
          />
          <Checkbox
            label={p.tpsl}
            checked={draft.tpsl}
            onChange={(event) => update({ tpsl: event.target.checked })}
          />
        </div>
      )}
      {type === 'LIMIT' && draft.tpsl && (
        <>
          <DecimalInput
            label={formatCopy(p.fieldTakeProfit, { asset: quote })}
            autoComplete="off"
            value={draft.takeProfit}
            error={fieldError('takeProfit')}
            onValueChange={(takeProfit) => update({ takeProfit })}
          />
          <DecimalInput
            label={formatCopy(p.fieldStopLoss, { asset: quote })}
            autoComplete="off"
            value={draft.stopLoss}
            error={fieldError('stopLoss')}
            onValueChange={(stopLoss) => update({ stopLoss })}
          />
          <p className="text-[10px] text-muted-dim">{p.tpslNote}</p>
        </>
      )}

      {((type === 'LIMIT' && !draft.postOnly) || type === 'STOP_LIMIT') && (
        <Select
          label={p.tifLabel}
          value={draft.timeInForce}
          onChange={(event) =>
            update({
              timeInForce: event.target.value as SpotOrderDraft['timeInForce'],
            })
          }
        >
          <option value="GTC">{p.tifGTC}</option>
          <option value="IOC">{p.tifIOC}</option>
          <option value="FOK">{p.tifFOK}</option>
        </Select>
      )}

      {notice && <FormNotice tone="error">{notice}</FormNotice>}
      {unavailable && (
        <p id={reasonId} className="text-[11px] text-warning">
          {unavailable}
        </p>
      )}

      <button
        type="submit"
        disabled={Boolean(unavailable) || pending}
        aria-describedby={unavailable ? reasonId : undefined}
        className={classNames(
          'inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11',
          buy ? 'bg-positive hover:opacity-90' : 'bg-negative hover:opacity-90',
        )}
      >
        {pending
          ? p.placing
          : formatCopy(buy ? p.submitBUY : p.submitSELL, { asset: base })}
      </button>
      <p className="text-[10px] text-muted-dim">
        {type === 'STOP_LIMIT' || type === 'STOP_MARKET'
          ? p.stopNote + ' '
          : ''}
        {type === 'TRAILING' ? p.trailingNote + ' ' : ''}
        {market || type === 'STOP_MARKET' ? p.estimateNote + ' ' : ''}
        {p.feeNote}
      </p>
    </form>
  );
}
