import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import { formatPrice, groupThousands } from '../../../utils/decimal-format';
import { percentOf, toStep } from '../../../utils/decimal-math';
import { ShareSlider } from '../../paper-trading/components/ShareSlider';
import type { PickedPrice } from '../../paper-trading/components/SpotOrderForm';
import { useFuturesActions } from '../hooks/use-futures';
import { futuresErrorText } from '../model/futures-errors';
import {
  actionsOf,
  checkDraft,
  costAndMax,
  EMPTY_DRAFT,
  positionSize,
  toBrackets,
  type FuturesAction,
  type FuturesDraft,
  type FuturesField,
} from '../model/futures-form';

const newClientOrderId = () => 'web-' + crypto.randomUUID().slice(0, 30);
/** How long the form waits after a change before asking the server's risk check. */
const CHECK_DELAY_MS = 400;

/**
 * The order form of the paper Futures screen (plan 12.3, TR-15, TR-26):
 * Limit or Market; price, size in the base asset and a share of Max; TP/SL
 * with the opening order; Reduce-only (one-way) or the Open / Close tabs
 * (hedge); the time in force; two buttons, each with its own Cost and Max
 * (4.6, 4.8), and the estimated liquidation price and risk warnings of the
 * server's check of the order as typed. Demo funds only, no fees.
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
  const { place } = useFuturesActions();
  const [draft, setDraft] = useState<FuturesDraft>(EMPTY_DRAFT);
  const [closeTab, setCloseTab] = useState(false);
  const [share, setShare] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<FuturesField, string>>>(
    {},
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [check, setCheck] = useState<FuturesOrderWarnings | null>(null);
  const keys = useRef(new Map<string, string>());
  const base = pair.baseAsset ?? pair.symbol;
  const quote = pair.quoteAsset ?? 'USDT';
  const resolved = useMemo(
    () => (brackets ? toBrackets(brackets) : undefined),
    [brackets],
  );
  const actions = actionsOf(hedge, closeTab);
  const update = (change: Partial<FuturesDraft>) => {
    setDraft((current) => ({ ...current, ...change }));
    setNotice(null);
  };

  // A price picked in the book or the trades fills the limit price.
  const lastPick = useRef<number | null>(null);
  useEffect(() => {
    if (!picked || picked.at === lastPick.current) return;
    lastPick.current = picked.at;
    update({ type: 'LIMIT', price: picked.price });
  }, [picked]);

  const figures = actions.map((action) =>
    costAndMax(
      action,
      draft,
      pair,
      { last: lastPrice, mark: markPrice },
      config,
      account,
      resolved,
      positionSize(positions, pair.symbol, action.positionSide),
    ),
  );

  // The server's risk check of the order as typed, on the buy side's action
  // (one-way) or the open tab's long side: the estimated liquidation price
  // and the warnings (TR-26).
  const checked = actions[0];
  const { side: checkSide, positionSide: checkPositionSide } = checked;
  const checkClosing = checked.closing;
  // Only an order the form would send is checked; a stale result is not shown.
  const checkable =
    !unavailable &&
    Object.keys(checkDraft(draft)).length === 0 &&
    !checkClosing &&
    !draft.reduceOnly;
  const shownCheck = checkable ? check : null;
  useEffect(() => {
    if (!checkable) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      futuresTrading
        .orderWarnings(
          orderOf(
            {
              side: checkSide,
              positionSide: checkPositionSide,
              closing: checkClosing,
            },
            draft,
            pair.symbol,
          ),
          controller.signal,
        )
        .then(
          (result) => !controller.signal.aborted && setCheck(result),
          () => !controller.signal.aborted && setCheck(null),
        );
    }, CHECK_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    checkable,
    draft,
    checkSide,
    checkPositionSide,
    checkClosing,
    futuresTrading,
    pair.symbol,
  ]);

  const setShareOf = (percent: number) => {
    setShare(percent);
    const max = figures[0]?.max;
    if (max && pair.stepSize)
      update({
        size: toStep(percentOf(max, percent, 12), pair.stepSize, 'down'),
      });
  };

  async function submit(action: FuturesAction, event?: FormEvent) {
    event?.preventDefault();
    const problems = checkDraft(draft);
    const shown: Partial<Record<FuturesField, string>> = {};
    for (const [field, problem] of Object.entries(problems))
      shown[field as FuturesField] =
        problem === 'required' ? f.errRequired : f.errInvalid;
    setErrors(shown);
    if (Object.keys(shown).length > 0) return;
    const order = orderOf(action, draft, pair.symbol);
    // The same order sent again keeps its key, so a retry is not a second order.
    const fingerprint = JSON.stringify(order);
    const key = keys.current.get(fingerprint) ?? newClientOrderId();
    keys.current.set(fingerprint, key);
    const result = await place.run({ ...order, newClientOrderId: key });
    if (result.status === 'error') {
      setNotice(futuresErrorText(copy, result.error));
      return;
    }
    if (result.status !== 'success') return;
    keys.current.delete(fingerprint);
    toast.show({
      tone: 'success',
      message: formatCopy(f.placed, {
        side: labelOf(action, f),
        size: draft.size,
        asset: base,
        status: result.data.status,
      }),
    });
    update({ size: '', takeProfit: '', stopLoss: '' });
    setShare(0);
  }

  const market = draft.type === 'MARKET';
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
      }}
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
      <SegmentedControl
        label={f.orderTypeLabel}
        value={draft.type}
        onChange={(type) => update({ type })}
        options={[
          { value: 'LIMIT', label: f.typeLimit },
          { value: 'MARKET', label: f.typeMarket },
        ]}
      />
      <p className="flex justify-between text-[11px] text-muted">
        <span>{f.available}</span>
        <span className="text-fg-2">
          {account ? (
            <NumericText
              value={groupThousands(account.availableBalance)}
              suffix={' ' + quote}
            />
          ) : (
            copy.market.noValue
          )}
        </span>
      </p>
      {market ? (
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
      <DecimalInput
        inline
        label={formatCopy(f.size, { asset: base })}
        autoComplete="off"
        value={draft.size}
        error={errors.size}
        onValueChange={(size) => {
          setShare(0);
          update({ size });
        }}
      />
      <ShareSlider
        value={share}
        disabled={!figures[0]?.max}
        onChange={setShareOf}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {!closeTab && (
          <Checkbox
            label={f.tpsl}
            checked={draft.tpsl}
            onChange={(event) => update({ tpsl: event.target.checked })}
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
        {!market && (
          <Select
            inline
            label={f.tif}
            value={draft.timeInForce}
            className="ml-auto min-w-40 flex-1 sm:flex-none"
            onChange={(event) =>
              update({
                timeInForce: event.target.value as FuturesDraft['timeInForce'],
              })
            }
          >
            <option value="GTC">GTC</option>
            <option value="IOC">IOC</option>
            <option value="FOK">FOK</option>
            <option value="GTX">{f.postOnly}</option>
          </Select>
        )}
      </div>
      {draft.tpsl && !closeTab && !draft.reduceOnly && (
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

      {shownCheck && shownCheck.warnings.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label={f.warningsLabel}>
          {shownCheck.warnings.map((warning) => (
            <li
              key={warning.type}
              className={classNames(
                'rounded-md px-2 py-1 text-[11px]',
                warning.severity === 'BLOCKING'
                  ? 'bg-negative-soft text-negative'
                  : warning.severity === 'WARNING'
                    ? 'bg-warning-soft text-warning'
                    : 'bg-raised text-muted',
              )}
            >
              {warningText(f, warning.type, warning.message)}
            </li>
          ))}
        </ul>
      )}

      {notice && <FormNotice tone="error">{notice}</FormNotice>}
      {unavailable && <p className="text-[11px] text-warning">{unavailable}</p>}

      <div className="grid grid-cols-2 gap-2">
        {actions.map((action, index) => {
          const figure = figures[index];
          const long = action.side === 'BUY';
          return (
            <div key={action.side} className="flex flex-col gap-1">
              <button
                type="button"
                disabled={Boolean(unavailable) || place.pending}
                onClick={() => void submit(action)}
                className={classNames(
                  'inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11',
                  long
                    ? 'bg-positive hover:opacity-90'
                    : 'bg-negative hover:opacity-90',
                )}
              >
                {place.pending ? f.placing : labelOf(action, f)}
              </button>
              <Figure
                label={f.cost}
                value={figure?.cost ?? null}
                suffix={quote}
                none={copy.market.noValue}
              />
              <Figure
                label={f.max}
                value={figure?.max ?? null}
                suffix={base}
                none={copy.market.noValue}
              />
            </div>
          );
        })}
      </div>
      {shownCheck && (
        <p className="flex justify-between text-[11px] text-muted">
          <span>{f.liqEstimate}</span>
          <span className="text-fg-2">
            {!/^0(\.0+)?$/.test(shownCheck.liquidationPrice) ? (
              <NumericText
                value={formatPrice(shownCheck.liquidationPrice, pair.tickSize)}
              />
            ) : (
              copy.market.noValue
            )}
          </span>
        </p>
      )}
      <p className="text-[10px] text-muted-dim">{f.formNote}</p>
    </form>
  );
}

function Figure({
  label,
  value,
  suffix,
  none,
}: {
  label: string;
  value: string | null;
  suffix: string;
  none: string;
}) {
  return (
    <p className="flex justify-between text-[11px] text-muted">
      <span>{label}</span>
      <span className="text-fg-2">
        {value ? (
          <NumericText value={groupThousands(value)} suffix={' ' + suffix} />
        ) : (
          none
        )}
      </span>
    </p>
  );
}

type FuturesCopy = ReturnType<typeof useCopy>['futures'];

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

/** The request of the order the form shows, for one of its buttons. */
function orderOf(
  action: FuturesAction,
  draft: FuturesDraft,
  symbol: string,
): PlaceFuturesOrder {
  const order: PlaceFuturesOrder = {
    symbol,
    side: action.side,
    positionSide: action.positionSide,
    type: draft.type,
    quantity: draft.size,
  };
  if (draft.type === 'LIMIT') {
    order.price = draft.price;
    order.timeInForce = draft.timeInForce;
  }
  if (draft.reduceOnly && action.positionSide === 'BOTH')
    order.reduceOnly = true;
  if (draft.tpsl && !action.closing && !draft.reduceOnly) {
    if (draft.takeProfit) order.takeProfitPrice = draft.takeProfit;
    if (draft.stopLoss) order.stopLossPrice = draft.stopLoss;
    if (order.takeProfitPrice || order.stopLossPrice)
      order.tpSlWorkingType = draft.tpslMark ? 'MARK_PRICE' : 'CONTRACT_PRICE';
  }
  return order;
}
