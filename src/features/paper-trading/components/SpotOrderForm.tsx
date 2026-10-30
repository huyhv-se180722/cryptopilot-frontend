import { useRef, useState, type FormEvent } from 'react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Checkbox } from '../../../components/ui/Checkbox';
import { DecimalInput } from '../../../components/ui/DecimalInput';
import { Input } from '../../../components/ui/Input';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type { Decimal, MarketPair, OrderSide } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { groupThousands } from '../../../utils/decimal-format';
import { toStep } from '../../../utils/decimal-math';
import { usePaperActions } from '../hooks/use-paper-orders';
import { spotRefusal } from '../model/paper-errors';
import {
  amountOf,
  checkSpotOrder,
  EMPTY_DRAFT,
  maxOrder,
  pickedPrice,
  shareInUse,
  shareOfFunds,
  totalOf,
  type Funds,
  type SpotFormType,
  type SpotOrderDraft,
  type SpotOrderField,
  type PickedPrice,
  type SpotOrderProblem,
} from '../model/spot-order';
import { ShareSlider } from './ShareSlider';

const newClientOrderId = () => 'web-' + crypto.randomUUID();

/**
 * One side of the Spot order panel of the demo exchange, for the order type
 * the panel picked: Limit (time in force, Post only for a LIMIT_MAKER, TP/SL
 * for an OTOCO), Market (by amount or by total, on both sides), and the Stop
 * Limit, Stop Market, Trailing Stop and OCO forms. A stop is sent as a stop
 * loss or a take profit by where it lies against the last price, as the
 * exchange's panel does. It checks tick, step, minimum value and balance
 * before sending (exact decimals, D-102) and keeps the idempotency key when
 * the same order is sent again. Demo funds only: nothing reaches an exchange.
 */
export function SpotOrderForm({
  pair,
  side,
  type,
  lastPrice,
  picked,
  funds,
  unavailable,
  reasonId,
}: {
  pair: MarketPair;
  side: OrderSide;
  type: SpotFormType;
  lastPrice: Decimal | null;
  picked: PickedPrice | null;
  /** Free balances, or null while the wallet is not known. */
  funds: Funds | null;
  /** Why the demo account cannot trade now (e.g. not connected), or null. */
  unavailable: string | null;
  /** The element that says it, for the button's description. */
  reasonId: string;
}) {
  const copy = useCopy();
  const p = copy.paper;
  const toast = useToast();
  const { place, placeList } = usePaperActions();
  const pairId = pair.pairId;
  const base = pair.baseAsset ?? pair.symbol;
  const quote = pair.quoteAsset ?? '';
  // Side and type come from the panel; the form keeps what was typed.
  const [entry, setDraft] = useState<SpotOrderDraft>(EMPTY_DRAFT);
  const draft: SpotOrderDraft = { ...entry, side, type };
  const [shown, setShown] = useState(false);
  // The backend's refusal of a field, in words.
  const [serverErrors, setServerErrors] = useState<
    Partial<Record<SpotOrderField, string>>
  >({});
  const [notice, setNotice] = useState<string | null>(null);
  // The share last set on the slider, kept until a field is typed in, so a
  // coarse step does not pull the thumb off where it was put.
  const [sharePicked, setSharePicked] = useState<number | null>(null);
  const sent = useRef<{ key: string; id: string } | null>(null);

  // Another side (one form on a phone) or type starts without the old checks.
  const [seen, setSeen] = useState({ side, type });
  if (seen.side !== side || seen.type !== type) {
    setSeen({ side, type });
    setSharePicked(null);
    setServerErrors({});
    setNotice(null);
    if (seen.type !== type)
      setDraft((current) => ({
        ...current,
        total:
          type === 'MARKET'
            ? ''
            : totalOf({ ...current, type }, current.amount, lastPrice),
      }));
  }

  // A price picked in the book becomes the limit price (once per pick); the
  // panel has turned a Market or Stop Market into a Limit for it.
  const [seenPick, setSeenPick] = useState(picked?.at ?? 0);
  if (picked && picked.at !== seenPick) {
    setSeenPick(picked.at);
    setSharePicked(null);
    const price = pickedPrice(picked.price, pair.tickSize);
    setDraft((current) => ({
      ...current,
      price,
      total: totalOf(
        { type, price, stop: current.stop },
        current.amount,
        lastPrice,
      ),
    }));
  }

  const available = funds ?? { quote: '0', base: '0' };
  const check = checkSpotOrder(draft, pair, available, lastPrice);
  const buy = side === 'BUY';
  const market = type === 'MARKET';
  const byTotal = market && draft.byTotal;
  const pending = place.pending || placeList.pending;
  const shareShown = sharePicked ?? shareInUse(draft, available, lastPrice);
  const max = funds ? maxOrder(draft, pair, funds, lastPrice) : null;

  const update = (next: Partial<SpotOrderDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setSharePicked(null);
    setServerErrors({});
    setNotice(null);
  };
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
    serverErrors[field] ?? problemText(shown ? check.errors[field] : undefined);

  const succeeded = (message: string, tone: 'success' | 'info' = 'success') => {
    sent.current = null;
    setShown(false);
    setSharePicked(null);
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
        listClientOrderId: sent.current.id,
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
    const fields: Partial<Record<SpotOrderField, string>> = {};
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
    // A symbol filter or open-order limit says which limit it broke.
    const limit = spotRefusal(copy, error, quote, pair.tickSize);
    if (limit) {
      const field = limit.field ? aliases[limit.field] : undefined;
      if (field) setServerErrors({ [field]: limit.text });
      else setNotice(limit.text);
      return;
    }
    for (const [name, messageId] of Object.entries(
      problem?.fieldErrors ?? {},
    )) {
      const field = aliases[name];
      if (field)
        fields[field] = messageId === 'MSG01' ? p.errRequired : p.errInvalid;
    }
    if (Object.keys(fields).length > 0) setServerErrors(fields);
    else setNotice(errorText(copy, error));
  }

  const share = (percent: number) => {
    update(shareOfFunds(draft, pair, available, percent, lastPrice));
    setSharePicked(percent);
  };

  const priceInput = (field: 'price' | 'stop' | 'stopLimit', label: string) => (
    <DecimalInput
      inline
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
      aria-label={buy ? p.sideBUY : p.sideSELL}
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-2.5"
    >
      {(type === 'STOP_LIMIT' || type === 'STOP_MARKET') &&
        priceInput('stop', formatCopy(p.fieldStop, { asset: quote }))}
      {type === 'TRAILING' && (
        <DecimalInput
          inline
          label={p.fieldTrailing}
          autoComplete="off"
          value={draft.trailing}
          error={fieldError('trailing')}
          onValueChange={(trailing) => update({ trailing })}
        />
      )}
      {type === 'TRAILING' &&
        priceInput('stop', formatCopy(p.fieldActivation, { asset: quote }))}

      {market ? (
        <Input
          inline
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
          inline
          label={formatCopy(p.fieldAmount, { asset: base })}
          autoComplete="off"
          value={draft.amount}
          error={fieldError('amount')}
          onValueChange={(amount) => {
            update({ amount, total: totalOf(draft, amount, lastPrice) });
          }}
        />
      )}

      <ShareSlider value={shareShown} disabled={!funds} onChange={share} />

      <DecimalInput
        inline
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

      {/* As on the exchange's Spot panel a Limit has TP/SL and no time in
          force: every order is sent GTC (the draft and the request still
          carry IOC, FOK and Post only, which the backend takes). */}
      {type === 'LIMIT' && (
        <Checkbox
          label={p.tpsl}
          checked={draft.tpsl}
          onChange={(event) => update({ tpsl: event.target.checked })}
        />
      )}
      {type === 'LIMIT' && draft.tpsl && (
        <>
          <DecimalInput
            inline
            label={formatCopy(p.fieldTakeProfit, { asset: quote })}
            autoComplete="off"
            value={draft.takeProfit}
            error={fieldError('takeProfit')}
            onValueChange={(takeProfit) => update({ takeProfit })}
          />
          <DecimalInput
            inline
            label={formatCopy(p.fieldStopLoss, { asset: quote })}
            autoComplete="off"
            value={draft.stopLoss}
            error={fieldError('stopLoss')}
            onValueChange={(stopLoss) => update({ stopLoss })}
          />
          <p className="text-[10px] text-muted-dim">{p.tpslNote}</p>
        </>
      )}

      {notice && <FormNotice tone="error">{notice}</FormNotice>}

      <div className="flex flex-col gap-1">
        <p className="flex items-baseline justify-between gap-2 text-[11px] text-muted-dim">
          {p.available}
          <span className="text-fg-2">
            {funds ? (
              <NumericText
                value={
                  buy
                    ? // Two digits, rounded down: never more than is free.
                      groupThousands(toStep(funds.quote, '0.01', 'down'))
                    : groupThousands(
                        toStep(
                          funds.base,
                          pair.stepSize ?? '0.00000001',
                          'down',
                        ),
                      )
                }
                suffix={' ' + (buy ? quote : base)}
              />
            ) : (
              copy.market.noValue
            )}
          </span>
        </p>
        <p className="flex items-baseline justify-between gap-2 text-[11px] text-muted-dim">
          {buy ? p.maxBuy : p.maxSell}
          <span className="text-fg-2">
            {max ? (
              <NumericText
                value={groupThousands(max)}
                suffix={' ' + (buy ? base : quote)}
              />
            ) : (
              copy.market.noValue
            )}
          </span>
        </p>
      </div>

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
    </form>
  );
}
