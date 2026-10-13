import { useId, useRef, useState, type FormEvent } from 'react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Checkbox } from '../../../components/ui/Checkbox';
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
  shareOfFunds,
  totalOf,
  type Funds,
  type SpotOrderDraft,
  type SpotOrderField,
  type SpotOrderProblem,
} from '../model/spot-order';

const SHARES = [25, 50, 75, 100] as const;

const EMPTY: SpotOrderDraft = {
  side: 'BUY',
  type: 'LIMIT',
  timeInForce: 'GTC',
  price: '',
  amount: '',
  total: '',
  byTotal: false,
};

/** A price picked in the order book or trades; `at` makes a repeat count. */
export interface PickedPrice {
  price: Decimal;
  at: number;
}

const newClientOrderId = () => 'web-' + crypto.randomUUID();

/**
 * Spot order form of the demo exchange (B Spot form, plan section 6.1):
 * Buy / Sell, Limit / Market, price, amount, a 25–100 % share of the free
 * balance, total, time in force, and for a Market buy the option to spend
 * a total. It checks tick, step, minimum value and balance before sending
 * (exact decimals, D-95), keeps the idempotency key when the same order
 * is sent again, and says why it cannot trade a pair without an id
 * (FEQ-01). Demo funds only: nothing reaches an exchange.
 */
export function SpotOrderForm({
  pair,
  pairId,
  lastPrice,
  picked,
  funds,
  unavailable,
}: {
  pair: MarketPair;
  pairId: string | null;
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
  const { place } = usePaperActions();
  const base = pair.baseAsset ?? pair.symbol;
  const quote = pair.quoteAsset ?? '';
  const [draft, setDraft] = useState<SpotOrderDraft>(EMPTY);
  const [shown, setShown] = useState(false);
  const [serverErrors, setServerErrors] = useState<
    Partial<Record<SpotOrderField, SpotOrderProblem>>
  >({});
  const [notice, setNotice] = useState<string | null>(null);
  const sent = useRef<{ key: string; id: string } | null>(null);
  const reasonId = useId();

  // A price picked in the book becomes a limit price (once per pick).
  const [seenPick, setSeenPick] = useState(picked?.at ?? 0);
  if (picked && picked.at !== seenPick) {
    setSeenPick(picked.at);
    setDraft((current) => ({
      ...current,
      type: 'LIMIT',
      price: picked.price,
      total: totalOf(
        { type: 'LIMIT', price: picked.price },
        current.amount,
        lastPrice,
      ),
    }));
  }

  const available = funds ?? { quote: '0', base: '0' };
  const check = checkSpotOrder(draft, pair, available, lastPrice);
  const buy = draft.side === 'BUY';
  const market = draft.type === 'MARKET';
  const byTotal = market && buy && draft.byTotal;

  const update = (next: Partial<SpotOrderDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
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
      default:
        return undefined;
    }
  };
  const fieldError = (field: SpotOrderField) =>
    problemText(
      serverErrors[field] ?? (shown ? check.errors[field] : undefined),
    );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setShown(true);
    if (unavailable || !pairId || !check.order) return;
    const order = { ...check.order, pairId, market: 'spot' as const };
    // The same order sent again (e.g. after a timeout) keeps its key, so the
    // backend returns the first one instead of placing a second (TR-06).
    const key = JSON.stringify(order);
    if (sent.current?.key !== key)
      sent.current = { key, id: newClientOrderId() };
    const result = await place.run({
      ...order,
      clientOrderId: sent.current.id,
    });
    if (result.status === 'success') {
      sent.current = null;
      setShown(false);
      setDraft((current) => ({ ...current, amount: '', total: '' }));
      toast.show({
        tone: 'success',
        message: formatCopy(p.placed, {
          side: buy ? p.sideBUY : p.sideSELL,
          status: p[`status${result.data.status}`].toLowerCase(),
        }),
      });
      return;
    }
    if (result.status !== 'error') return;
    const problem = problemOf(result.error);
    if (problem?.code === 'PAPER_INSUFFICIENT_BALANCE') {
      setNotice(p.insufficientServer);
      return;
    }
    const fields: Partial<Record<SpotOrderField, SpotOrderProblem>> = {};
    const aliases: Record<string, SpotOrderField> = {
      price: 'price',
      quantity: 'amount',
      quoteOrderQty: 'total',
    };
    for (const [name, messageId] of Object.entries(
      problem?.fieldErrors ?? {},
    )) {
      const field = aliases[name];
      if (field) fields[field] = messageId === 'MSG01' ? 'required' : 'invalid';
    }
    if (Object.keys(fields).length > 0) setServerErrors(fields);
    else setNotice(errorText(copy, result.error));
  }

  const share = (percent: number) =>
    update(shareOfFunds(draft, pair, available, percent, lastPrice));

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
          onChange={(side) =>
            update({ side, byTotal: side === 'BUY' && draft.byTotal })
          }
          options={[
            { value: 'BUY', label: p.sideBUY },
            { value: 'SELL', label: p.sideSELL },
          ]}
        />
        <SegmentedControl
          label={p.orderTypeLabel}
          value={draft.type}
          onChange={(type) =>
            update({
              type,
              total:
                type === 'MARKET'
                  ? ''
                  : totalOf(
                      { type, price: draft.price },
                      draft.amount,
                      lastPrice,
                    ),
            })
          }
          options={[
            { value: 'LIMIT', label: p.typeLIMIT },
            { value: 'MARKET', label: p.typeMARKET },
          ]}
        />
      </div>

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

      {market ? (
        <Input
          label={formatCopy(p.fieldPrice, { asset: quote })}
          value={p.marketPrice}
          readOnly
          aria-readonly="true"
        />
      ) : (
        <Input
          label={formatCopy(p.fieldPrice, { asset: quote })}
          inputMode="decimal"
          autoComplete="off"
          value={draft.price}
          error={fieldError('price')}
          onChange={(event) => {
            const price = event.target.value;
            update({
              price,
              total: totalOf({ type: 'LIMIT', price }, draft.amount, lastPrice),
            });
          }}
        />
      )}

      {!byTotal && (
        <Input
          label={formatCopy(p.fieldAmount, { asset: base })}
          inputMode="decimal"
          autoComplete="off"
          value={draft.amount}
          error={fieldError('amount')}
          onChange={(event) => {
            const amount = event.target.value;
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

      <Input
        label={formatCopy(p.fieldTotal, { asset: quote })}
        inputMode="decimal"
        autoComplete="off"
        value={draft.total}
        readOnly={market && !byTotal}
        error={fieldError('total')}
        onChange={(event) => {
          const total = event.target.value;
          update(
            byTotal
              ? { total }
              : { total, amount: amountOf(draft, total, pair, lastPrice) },
          );
        }}
      />

      {market && buy && (
        <Checkbox
          label={p.byTotal}
          checked={draft.byTotal}
          onChange={(event) =>
            update({ byTotal: event.target.checked, amount: '', total: '' })
          }
        />
      )}
      {!market && (
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
      {(unavailable || !pairId) && (
        <p id={reasonId} className="text-[11px] text-warning">
          {unavailable ?? p.needPairId}
        </p>
      )}

      <button
        type="submit"
        disabled={Boolean(unavailable) || !pairId || place.pending}
        aria-describedby={unavailable || !pairId ? reasonId : undefined}
        className={classNames(
          'inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11',
          buy ? 'bg-positive hover:opacity-90' : 'bg-negative hover:opacity-90',
        )}
      >
        {place.pending
          ? p.placing
          : formatCopy(buy ? p.submitBUY : p.submitSELL, { asset: base })}
      </button>
      <p className="text-[10px] text-muted-dim">
        {market ? p.estimateNote + ' ' : ''}
        {p.feeNote}
      </p>
    </form>
  );
}
