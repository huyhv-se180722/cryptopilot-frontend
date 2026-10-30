import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Checkbox } from '../../../components/ui/Checkbox';
import { DecimalInput } from '../../../components/ui/DecimalInput';
import { Input } from '../../../components/ui/Input';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
import { useCopy } from '../../../hooks/use-copy';
import { useServices } from '../../../hooks/use-services';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { Decimal, MarketPair } from '../../../types/domain';
import type {
  FuturesAccount,
  FuturesLeverageBracket,
  FuturesOrderWarnings,
  FuturesPosition,
  FuturesSymbolConfig,
  PlaceFuturesOrder,
} from '../../../types/futures';
import { classNames } from '../../../utils/class-names';
import {
  formatPrice,
  groupThousands,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import { percentOf, toStep } from '../../../utils/decimal-math';
import { ShareSlider } from '../../paper-trading/components/ShareSlider';
import type { PickedPrice } from '../../paper-trading/components/SpotOrderForm';
import { useFuturesActions } from '../hooks/use-futures';
import { futuresErrorText } from '../model/futures-errors';
import {
  actionsOf,
  algoOrderOf,
  checkDraft,
  costAndMax,
  costPriceOf,
  EMPTY_DRAFT,
  inUnit,
  isConditionalForm,
  orderOf,
  positionSize,
  quantityOf,
  toBrackets,
  type FuturesAction,
  type FuturesDraft,
  type FuturesField,
  type FuturesFormType,
  type Prices,
} from '../model/futures-form';

const newKey = () => 'web-' + crypto.randomUUID().slice(0, 30);
/** How long the form waits after a change before asking the server's risk check. */
const CHECK_DELAY_MS = 400;
const isZero = (value: string) => /^0(\.0+)?$/.test(value);

type FuturesCopy = ReturnType<typeof useCopy>['futures'];

/**
 * The order panel of the paper Futures screen, laid out as the exchange's
 * (plan 12.3, TR-15, TR-20, TR-26): Limit, Market and Conditional (Stop
 * Limit, Stop Market, Trailing Stop) with the trigger on the last or the
 * mark price; the size in the base asset or as an order value in USDT, with
 * a share of Max; TP/SL with an opening order; Reduce-only (one-way) or
 * Open / Close (hedge); the time in force. Each button shows its own
 * estimated liquidation price (the server's risk check), Cost and Max (4.6,
 * 4.8); the check's warnings follow. Demo funds only, no fees.
 */
export function FuturesOrderForm({
  pair,
  lastPrice,
  markPrice,
  picked,
  config,
  account,
  positions,
  brackets,
  hedge,
  unavailable,
}: {
  pair: MarketPair;
  lastPrice: Decimal | null;
  markPrice: Decimal | null;
  picked: PickedPrice | null;
  config: FuturesSymbolConfig | undefined;
  account: FuturesAccount | undefined;
  positions: readonly FuturesPosition[] | undefined;
  brackets: readonly FuturesLeverageBracket[] | undefined;
  hedge: boolean;
  unavailable: string | null;
}) {
  const copy = useCopy();
  const f = copy.futures;
  const toast = useToast();
  const { futuresTrading } = useServices();
  const { place, placeAlgo } = useFuturesActions();
  const [draft, setDraft] = useState<FuturesDraft>(EMPTY_DRAFT);
  const [closeTab, setCloseTab] = useState(false);
  const [share, setShare] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<FuturesField, string>>>(
    {},
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [checks, setChecks] = useState<
    [FuturesOrderWarnings | null, FuturesOrderWarnings | null]
  >([null, null]);
  const keys = useRef(new Map<string, string>());
  const base = pair.baseAsset ?? pair.symbol;
  const quote = pair.quoteAsset ?? 'USDT';
  const unit = draft.sizeUnit === 'BASE' ? base : quote;
  const prices: Prices = useMemo(
    () => ({ last: lastPrice, mark: markPrice }),
    [lastPrice, markPrice],
  );
  const resolved = useMemo(
    () => (brackets ? toBrackets(brackets) : undefined),
    [brackets],
  );
  const actions = actionsOf(hedge, closeTab);
  const conditional = isConditionalForm(draft.type);
  const update = (change: Partial<FuturesDraft>) => {
    setDraft((current) => ({ ...current, ...change }));
    setNotice(null);
  };

  // A price picked in the book or the trades fills the limit price.
  const lastPick = useRef<number | null>(null);
  useEffect(() => {
    if (!picked || picked.at === lastPick.current) return;
    lastPick.current = picked.at;
    setDraft((current) => ({
      ...current,
      type: current.type === 'MARKET' ? 'LIMIT' : current.type,
      price: picked.price,
    }));
  }, [picked]);

  const quantity = quantityOf(draft, pair, prices);
  const figures = actions.map((action) =>
    costAndMax(
      action,
      draft,
      pair,
      prices,
      config,
      account,
      resolved,
      positionSize(positions, pair.symbol, action.positionSide),
    ),
  );

  // The server's risk check of each button's order as typed: the estimated
  // liquidation price under it and the warnings (TR-26). A conditional
  // order is checked as the order its trigger places.
  const checkable =
    !unavailable &&
    Object.keys(checkDraft(draft)).length === 0 &&
    quantity !== null &&
    !closeTab &&
    !draft.reduceOnly;
  const shown = checkable ? checks : [null, null];
  const [first, second] = actions;
  const firstSide = first.side;
  const firstPosition = first.positionSide;
  const secondSide = second.side;
  const secondPosition = second.positionSide;
  useEffect(() => {
    if (!checkable || !quantity) return;
    const controller = new AbortController();
    const request = (
      side: FuturesAction['side'],
      positionSide: FuturesAction['positionSide'],
    ) =>
      futuresTrading
        .orderWarnings(
          checkedOrder(
            { side, positionSide, closing: false },
            draft,
            pair.symbol,
            quantity,
          ),
          controller.signal,
        )
        .catch(() => null);
    const timer = setTimeout(() => {
      void Promise.all([
        request(firstSide, firstPosition),
        request(secondSide, secondPosition),
      ]).then((results) => {
        if (!controller.signal.aborted) setChecks([results[0], results[1]]);
      });
    }, CHECK_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    checkable,
    quantity,
    draft,
    firstSide,
    firstPosition,
    secondSide,
    secondPosition,
    futuresTrading,
    pair.symbol,
  ]);

  const maxShown = (index: number) => {
    const max = figures[index]?.max;
    return max ? inUnit(max, draft, prices) : null;
  };
  const setShareOf = (percent: number) => {
    setShare(percent);
    const max = maxShown(0);
    if (!max) return;
    const value = percentOf(max, percent, 12);
    update({
      size:
        draft.sizeUnit === 'BASE' && pair.stepSize
          ? toStep(value, pair.stepSize, 'down')
          : toFixedDecimal(value, 2),
    });
  };

  async function submit(action: FuturesAction) {
    const problems = checkDraft(draft);
    const shownErrors: Partial<Record<FuturesField, string>> = {};
    for (const [field, problem] of Object.entries(problems))
      shownErrors[field as FuturesField] =
        problem === 'required' ? f.errRequired : f.errInvalid;
    if (!problems.size && !quantity) shownErrors.size = f.errTooSmall;
    setErrors(shownErrors);
    if (Object.keys(shownErrors).length > 0 || !quantity) return;
    const request = conditional
      ? algoOrderOf(action, draft, pair.symbol, quantity, prices)
      : orderOf(action, draft, pair.symbol, quantity);
    // The same order sent again keeps its key, so a retry is not a second order.
    const fingerprint = JSON.stringify(request);
    const key = keys.current.get(fingerprint) ?? newKey();
    keys.current.set(fingerprint, key);
    const result = conditional
      ? await placeAlgo.run({
          ...algoOrderOf(action, draft, pair.symbol, quantity, prices),
          clientAlgoId: key,
        })
      : await place.run({
          ...orderOf(action, draft, pair.symbol, quantity),
          newClientOrderId: key,
        });
    if (result.status === 'error') {
      setNotice(futuresErrorText(copy, result.error));
      return;
    }
    if (result.status !== 'success') return;
    keys.current.delete(fingerprint);
    toast.show({
      tone: 'success',
      message: formatCopy(conditional ? f.placedConditional : f.placedShort, {
        side: labelOf(action, f),
        size: groupThousands(quantity),
        asset: base,
      }),
    });
    update({ size: '', takeProfit: '', stopLoss: '' });
    setShare(0);
  }

  const pending = place.pending || placeAlgo.pending;
  const market = draft.type === 'MARKET' || draft.type === 'TRAILING';
  const tabValue = conditional ? 'CONDITIONAL' : draft.type;
  return (
    <form
      noValidate
      onSubmit={(event) => event.preventDefault()}
      className="flex flex-col gap-2.5"
    >
      {hedge && (
        <SegmentedControl
          label={f.openCloseLabel}
          value={closeTab ? 'close' : 'open'}
          onChange={(value) => setCloseTab(value === 'close')}
          options={[
            { value: 'open', label: f.tabOpen },
            { value: 'close', label: f.tabClose },
          ]}
        />
      )}
      <div
        role="tablist"
        aria-label={f.orderTypeLabel}
        className="flex items-center gap-4 border-b border-line text-xs"
      >
        {(['LIMIT', 'MARKET'] as const).map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={tabValue === type}
            onClick={() => update({ type })}
            className={tabClass(tabValue === type)}
          >
            {type === 'LIMIT' ? f.typeLimit : f.typeMarket}
          </button>
        ))}
        <label
          className={classNames(
            tabClass(conditional),
            'relative inline-flex items-center gap-0.5',
          )}
        >
          <select
            aria-label={f.typeConditional}
            value={conditional ? draft.type : ''}
            onChange={(event) =>
              update({ type: event.target.value as FuturesFormType })
            }
            className="cursor-pointer appearance-none bg-transparent pr-4 font-medium focus:outline-none"
          >
            <option value="" disabled hidden>
              {f.typeConditional}
            </option>
            <option value="STOP_LIMIT">{f.typeStopLimit}</option>
            <option value="STOP_MARKET">{f.typeStopMarket}</option>
            <option value="TRAILING">{f.typeTrailing}</option>
          </select>
          <ChevronDown
            size={12}
            aria-hidden="true"
            className="pointer-events-none absolute right-0"
          />
        </label>
      </div>

      <p className="flex justify-between text-[11px] text-muted">
        <span>{f.available}</span>
        <span className="text-fg-2">
          {account ? (
            <NumericText
              value={groupThousands(
                toFixedDecimal(account.availableBalance, 2),
              )}
              suffix={' ' + quote}
            />
          ) : (
            copy.market.noValue
          )}
        </span>
      </p>

      {(draft.type === 'STOP_LIMIT' || draft.type === 'STOP_MARKET') && (
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <DecimalInput
              inline
              label={formatCopy(f.stopPrice, { asset: quote })}
              autoComplete="off"
              value={draft.stopPrice}
              error={errors.stopPrice}
              onValueChange={(stopPrice) => update({ stopPrice })}
            />
          </div>
          <WatchedPrice
            value={draft.stopMark}
            onChange={(stopMark) => update({ stopMark })}
            f={f}
          />
        </div>
      )}
      {draft.type === 'TRAILING' && (
        <>
          <DecimalInput
            inline
            label={f.callbackRate}
            autoComplete="off"
            value={draft.callbackRate}
            error={errors.callbackRate}
            onValueChange={(callbackRate) => update({ callbackRate })}
          />
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <DecimalInput
                inline
                label={formatCopy(f.activationPrice, { asset: quote })}
                autoComplete="off"
                value={draft.activationPrice}
                error={errors.activationPrice}
                onValueChange={(activationPrice) => update({ activationPrice })}
              />
            </div>
            <WatchedPrice
              value={draft.stopMark}
              onChange={(stopMark) => update({ stopMark })}
              f={f}
            />
          </div>
        </>
      )}

      {market || draft.type === 'STOP_MARKET' ? (
        <Input
          inline
          label={formatCopy(f.price, { asset: quote })}
          value={f.marketPrice}
          readOnly
          aria-readonly="true"
        />
      ) : (
        <DecimalInput
          inline
          label={formatCopy(f.price, { asset: quote })}
          autoComplete="off"
          value={draft.price}
          error={errors.price}
          onValueChange={(price) => update({ price })}
        />
      )}

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <DecimalInput
            inline
            label={formatCopy(f.size, { asset: unit })}
            autoComplete="off"
            value={draft.size}
            error={errors.size}
            onValueChange={(size) => {
              setShare(0);
              update({ size });
            }}
          />
        </div>
        <Select
          inline
          label={f.sizeUnit}
          value={draft.sizeUnit}
          className="w-24"
          onChange={(event) => {
            setShare(0);
            update({
              sizeUnit: event.target.value as FuturesDraft['sizeUnit'],
              size: '',
            });
          }}
        >
          <option value="BASE">{base}</option>
          <option value="QUOTE">{quote}</option>
        </Select>
      </div>
      {draft.sizeUnit === 'QUOTE' && quantity && (
        <p className="-mt-1 text-[10px] text-muted-dim">
          ≈ <NumericText value={groupThousands(quantity)} suffix={' ' + base} />
        </p>
      )}
      <ShareSlider
        value={share}
        disabled={!maxShown(0)}
        onChange={setShareOf}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {!closeTab && !conditional && (
          <Checkbox
            label={f.tpsl}
            checked={draft.tpsl}
            onChange={(event) =>
              update({ tpsl: event.target.checked, reduceOnly: false })
            }
          />
        )}
        {!hedge && (
          <Checkbox
            label={f.reduceOnly}
            checked={draft.reduceOnly}
            onChange={(event) =>
              update({ reduceOnly: event.target.checked, tpsl: false })
            }
          />
        )}
        {(draft.type === 'LIMIT' || draft.type === 'STOP_LIMIT') && (
          <Select
            inline
            label={f.tif}
            value={draft.timeInForce}
            className="ml-auto min-w-28 flex-1 sm:flex-none"
            onChange={(event) =>
              update({
                timeInForce: event.target.value as FuturesDraft['timeInForce'],
              })
            }
          >
            <option value="GTC">GTC</option>
            <option value="IOC">IOC</option>
            <option value="FOK">FOK</option>
            {draft.type === 'LIMIT' && (
              <option value="GTX">{f.postOnly}</option>
            )}
          </Select>
        )}
      </div>
      {draft.tpsl && !closeTab && !conditional && !draft.reduceOnly && (
        <>
          <DecimalInput
            inline
            label={formatCopy(f.takeProfit, { asset: quote })}
            autoComplete="off"
            value={draft.takeProfit}
            error={errors.takeProfit}
            onValueChange={(takeProfit) => update({ takeProfit })}
          />
          <DecimalInput
            inline
            label={formatCopy(f.stopLoss, { asset: quote })}
            autoComplete="off"
            value={draft.stopLoss}
            error={errors.stopLoss}
            onValueChange={(stopLoss) => update({ stopLoss })}
          />
          <Checkbox
            label={f.tpslOnMark}
            checked={draft.tpslMark}
            onChange={(event) => update({ tpslMark: event.target.checked })}
          />
        </>
      )}

      {notice && <FormNotice tone="error">{notice}</FormNotice>}
      {unavailable && <p className="text-[11px] text-warning">{unavailable}</p>}

      <div className="grid grid-cols-2 gap-2">
        {actions.map((action, index) => {
          const figure = figures[index];
          const check = shown[index];
          const long = action.side === 'BUY';
          const max = maxShown(index);
          const align = long ? 'start' : 'end';
          return (
            <div key={action.side} className="flex flex-col gap-1">
              <button
                type="button"
                disabled={Boolean(unavailable) || pending}
                onClick={() => void submit(action)}
                className={classNames(
                  'inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11',
                  long
                    ? 'bg-positive hover:opacity-90'
                    : 'bg-negative hover:opacity-90',
                )}
              >
                {pending ? f.placing : labelOf(action, f)}
              </button>
              <Figure
                label={f.liqShort}
                value={
                  check && !isZero(check.liquidationPrice)
                    ? formatPrice(check.liquidationPrice, pair.tickSize)
                    : null
                }
                suffix={quote}
                align={align}
              />
              <Figure
                label={f.cost}
                value={figure?.cost ? toFixedDecimal(figure.cost, 2) : null}
                suffix={quote}
                align={align}
              />
              <Figure
                label={f.max}
                value={
                  max
                    ? draft.sizeUnit === 'BASE'
                      ? max
                      : toFixedDecimal(max, 2)
                    : null
                }
                suffix={unit}
                align={align}
              />
            </div>
          );
        })}
      </div>

      <Warnings checks={shown} f={f} />
      <p className="text-[10px] text-muted-dim">{f.formNote}</p>
    </form>
  );
}

const tabClass = (active: boolean) =>
  classNames(
    'relative -mb-px border-b-2 pb-1.5 font-medium',
    active
      ? 'border-primary text-fg'
      : 'border-transparent text-muted hover:text-fg-2',
  );

/** Last or Mark: the price a trigger watches. */
function WatchedPrice({
  value,
  onChange,
  f,
}: {
  value: boolean;
  onChange: (mark: boolean) => void;
  f: FuturesCopy;
}) {
  return (
    <Select
      inline
      label={f.triggerOn}
      value={value ? 'MARK' : 'LAST'}
      className="w-28"
      onChange={(event) => onChange(event.target.value === 'MARK')}
    >
      <option value="LAST">{f.lastPrice}</option>
      <option value="MARK">{f.markShort}</option>
    </Select>
  );
}

function Figure({
  label,
  value,
  suffix,
  align,
}: {
  label: string;
  value: string | null;
  suffix: string;
  align: 'start' | 'end';
}) {
  return (
    <p
      className={classNames(
        'flex gap-1 text-[11px] text-muted',
        align === 'end' ? 'justify-end' : 'justify-start',
      )}
    >
      <span>{label}</span>
      <span className="text-fg-2">
        {value ? (
          <NumericText value={groupThousands(value)} suffix={' ' + suffix} />
        ) : (
          '-- ' + suffix
        )}
      </span>
    </p>
  );
}

/** The warnings of both buttons' checks, once each; a side's own is named. */
function Warnings({
  checks,
  f,
}: {
  checks: readonly (FuturesOrderWarnings | null)[];
  f: FuturesCopy;
}) {
  const [long, short] = checks;
  const types = (check: FuturesOrderWarnings | null | undefined) =>
    new Set(check?.warnings.map((w) => w.type) ?? []);
  const longTypes = types(long);
  const shortTypes = types(short);
  const rows = [
    ...(long?.warnings ?? []).map((w) => ({
      ...w,
      side: shortTypes.has(w.type) ? null : f.buyLong,
    })),
    ...(short?.warnings ?? [])
      .filter((w) => !longTypes.has(w.type))
      .map((w) => ({ ...w, side: f.sellShort })),
  ];
  if (rows.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1" aria-label={f.warningsLabel}>
      {rows.map((warning) => (
        <li
          key={warning.type + (warning.side ?? '')}
          className={classNames(
            'rounded-md px-2 py-1 text-[11px]',
            warning.severity === 'BLOCKING'
              ? 'bg-negative-soft text-negative'
              : warning.severity === 'WARNING'
                ? 'bg-warning-soft text-warning'
                : 'bg-raised text-muted',
          )}
        >
          {warning.side ? warning.side + ': ' : ''}
          {warningText(f, warning.type, warning.message)}
        </li>
      ))}
    </ul>
  );
}

function labelOf(action: FuturesAction, f: FuturesCopy) {
  if (action.closing)
    return action.positionSide === 'LONG' ? f.closeLong : f.closeShort;
  return action.side === 'BUY' ? f.buyLong : f.sellShort;
}

/** A warning in the reader's words; the server's text when it is a new one. */
function warningText(f: FuturesCopy, type: string, message: string) {
  const known: Record<string, string> = {
    INSUFFICIENT_MARGIN: f.warnInsufficientMargin,
    SL_BEYOND_LIQUIDATION: f.warnStopBeyondLiq,
    HIGH_LEVERAGE: f.warnHighLeverage,
    OVERSIZED_POSITION: f.warnOversized,
    LOW_RR: f.warnLowRr,
    HIGH_FUNDING_RATE: f.warnHighFunding,
    WIDE_STOP_LOSS: f.warnWideStop,
  };
  return known[type] ?? message;
}

/**
 * The order the risk check judges: the form's own for Limit and Market; for
 * a conditional one the order its trigger places (a Stop Market at its
 * trigger, a trailing stop at the market).
 */
function checkedOrder(
  action: FuturesAction,
  draft: FuturesDraft,
  symbol: string,
  quantity: string,
): PlaceFuturesOrder {
  if (!isConditionalForm(draft.type))
    return orderOf(action, draft, symbol, quantity);
  const price = costPriceOf(draft);
  return orderOf(
    action,
    {
      ...draft,
      type: price ? 'LIMIT' : 'MARKET',
      price: price ?? '',
      timeInForce: 'GTC',
      tpsl: false,
    },
    symbol,
    quantity,
  );
}
