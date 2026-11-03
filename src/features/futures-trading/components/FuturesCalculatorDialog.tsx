import { useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Button } from '../../../components/ui/Button';
import { DecimalInput } from '../../../components/ui/DecimalInput';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
import { useCopy } from '../../../hooks/use-copy';
import { useServices } from '../../../hooks/use-services';
import { formatCopy } from '../../../i18n/copy';
import type {
  FuturesCalculation,
  FuturesCalculatorTab,
  MarginType,
  PositionDirection,
} from '../../../types/futures';
import {
  formatPrice,
  groupThousands,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import {
  checkInputs,
  FIELDS,
  MAX_LOTS,
  requestOf,
  TABS,
  type Field,
  type Inputs,
  type Lot,
} from '../model/futures-calculator';
import { futuresErrorText } from '../model/futures-errors';

/**
 * The exchange's Futures calculator (TR-44): PnL, target price,
 * liquidation price, max open and open price of a position on this pair,
 * worked out by the server with the pair's brackets. Nothing is placed.
 */
export function FuturesCalculatorDialog({
  symbol,
  tickSize,
  leverage,
  maxLeverage,
  walletBalance,
  lastPrice,
  onClose,
}: {
  symbol: string;
  tickSize: string | null;
  leverage: number;
  maxLeverage: number;
  /** The available balance, the wallet's default. */
  walletBalance: string | null;
  lastPrice: string | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  const f = copy.futures;
  const { futuresTrading } = useServices();
  const [tab, setTab] = useState<FuturesCalculatorTab>('pnl');
  const [inputs, setInputs] = useState<Inputs>({
    side: 'LONG',
    marginType: 'CROSSED',
    leverage: String(leverage),
    entryPrice: lastPrice ?? '',
    exitPrice: '',
    quantity: '',
    roe: '',
    walletBalance: walletBalance ? toFixedDecimal(walletBalance, 2) : '',
    lots: [
      { price: '', quantity: '' },
      { price: '', quantity: '' },
    ],
  });
  const [errors, setErrors] = useState<
    Partial<Record<Field, 'required' | 'invalid'>>
  >({});
  const [result, setResult] = useState<FuturesCalculation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const change = (next: Partial<Inputs>) => {
    setInputs((current) => ({ ...current, ...next }));
    setResult(null);
    setNotice(null);
  };
  const errorOf = (field: Field) =>
    errors[field] === 'required'
      ? f.errRequired
      : errors[field] === 'invalid'
        ? field === 'leverage'
          ? formatCopy(f.calcLeverageRange, { max: maxLeverage })
          : field === 'roe'
            ? f.calcRoeInvalid
            : f.errInvalid
        : undefined;

  const calculate = async () => {
    const found = checkInputs(tab, inputs, maxLeverage);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    try {
      setResult(
        await futuresTrading.calculate(tab, requestOf(tab, symbol, inputs)),
      );
    } catch (error) {
      setNotice(futuresErrorText(copy, error));
    } finally {
      setPending(false);
    }
  };

  const fields = FIELDS[tab];
  const input = (field: Exclude<Field, 'lots' | 'leverage'>, label: string) =>
    fields.includes(field) &&
    (field === 'roe' ? (
      // A target return may be a loss, so the field takes a minus sign.
      <Input
        inline
        label={label}
        autoComplete="off"
        inputMode="decimal"
        value={inputs.roe}
        error={errorOf('roe')}
        onChange={(event) => change({ roe: event.target.value.trim() })}
      />
    ) : (
      <DecimalInput
        inline
        label={label}
        autoComplete="off"
        value={inputs[field]}
        error={errorOf(field)}
        onValueChange={(value) => change({ [field]: value })}
      />
    ));

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={formatCopy(f.calcTitle, { symbol })}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {f.calcClose}
          </Button>
          <Button onClick={() => void calculate()} disabled={pending}>
            {f.calcRun}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <SegmentedControl
            label={f.calcTabsLabel}
            value={tab}
            onChange={(next) => {
              setTab(next);
              setErrors({});
              setResult(null);
              setNotice(null);
            }}
            options={TABS.map((value) => ({
              value,
              label: f[`calcTab_${value}`],
            }))}
          />
        </div>
        {tab !== 'openPrice' && (
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<PositionDirection>
              label={f.colSide}
              value={inputs.side}
              onChange={(side) => change({ side })}
              options={[
                { value: 'LONG', label: f.calcLong },
                { value: 'SHORT', label: f.calcShort },
              ]}
            />
            {tab === 'liquidation' && (
              <Select
                inline
                label={f.calcMarginMode}
                value={inputs.marginType}
                className="w-32"
                onChange={(event) =>
                  change({ marginType: event.target.value as MarginType })
                }
              >
                <option value="CROSSED">{f.cross}</option>
                <option value="ISOLATED">{f.isolated}</option>
              </Select>
            )}
          </div>
        )}
        {fields.includes('leverage') && (
          <DecimalInput
            inline
            label={formatCopy(f.calcLeverage, { max: maxLeverage })}
            autoComplete="off"
            value={inputs.leverage}
            error={errorOf('leverage')}
            onValueChange={(value) => change({ leverage: value })}
          />
        )}
        {input('entryPrice', formatCopy(f.calcEntry, { asset: 'USDT' }))}
        {input('exitPrice', formatCopy(f.calcExit, { asset: 'USDT' }))}
        {input('quantity', f.calcQuantity)}
        {input('roe', f.calcRoe)}
        {input(
          'walletBalance',
          tab === 'liquidation' && inputs.marginType === 'ISOLATED'
            ? f.calcIsolatedMargin
            : f.calcWallet,
        )}
        {tab === 'openPrice' && (
          <Lots
            lots={inputs.lots}
            error={errorOf('lots')}
            onChange={(lots) => change({ lots })}
            f={f}
          />
        )}
        {notice && <FormNotice tone="error">{notice}</FormNotice>}
        {result && (
          <Results
            tab={tab}
            result={result}
            tickSize={tickSize}
            f={f}
            none={copy.market.noValue}
          />
        )}
        <p className="text-[10px] text-muted-dim">{f.calcNote}</p>
      </div>
    </Dialog>
  );
}

type FuturesCopy = ReturnType<typeof useCopy>['futures'];

function Lots({
  lots,
  error,
  onChange,
  f,
}: {
  lots: Lot[];
  error: string | undefined;
  onChange: (lots: Lot[]) => void;
  f: FuturesCopy;
}) {
  const set = (index: number, change: Partial<Lot>) =>
    onChange(lots.map((lot, i) => (i === index ? { ...lot, ...change } : lot)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xs font-medium text-fg-2">
        {f.calcLots}
      </legend>
      {lots.map((lot, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <DecimalInput
              inline
              label={formatCopy(f.calcLotPrice, { n: index + 1 })}
              autoComplete="off"
              value={lot.price}
              onValueChange={(price) => set(index, { price })}
            />
          </div>
          <div className="min-w-0 flex-1">
            <DecimalInput
              inline
              label={formatCopy(f.calcLotQuantity, { n: index + 1 })}
              autoComplete="off"
              value={lot.quantity}
              onValueChange={(quantity) => set(index, { quantity })}
            />
          </div>
          <button
            type="button"
            aria-label={formatCopy(f.calcRemoveLot, { n: index + 1 })}
            disabled={lots.length <= 1}
            onClick={() => onChange(lots.filter((_, i) => i !== index))}
            className="mb-2 rounded p-1 text-muted hover:text-fg disabled:opacity-40"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
      {error && <p className="text-[11px] text-negative">{error}</p>}
      <div>
        <Button
          variant="ghost"
          size="sm"
          disabled={lots.length >= MAX_LOTS}
          onClick={() => onChange([...lots, { price: '', quantity: '' }])}
        >
          <Plus size={13} aria-hidden="true" />
          {f.calcAddLot}
        </Button>
      </div>
    </fieldset>
  );
}

function Results({
  tab,
  result,
  tickSize,
  f,
  none,
}: {
  tab: FuturesCalculatorTab;
  result: FuturesCalculation;
  tickSize: string | null;
  f: FuturesCopy;
  none: string;
}) {
  const zero = (value: string) => /^-?0*(\.0*)?$/.test(value);
  const usdt = (value: string | null, sign = false) =>
    value === null ? (
      none
    ) : (
      <NumericText
        signed={sign}
        value={groupThousands(toFixedDecimal(value, 2))}
        suffix=" USDT"
      />
    );
  const priceOf = (value: string | null) =>
    value === null || zero(value) ? (
      f.calcNoPrice
    ) : (
      <NumericText value={formatPrice(value, tickSize)} suffix=" USDT" />
    );
  const rows: [string, ReactNode][] = [];
  if (tab === 'pnl') {
    rows.push([f.calcInitialMargin, usdt(result.initialMargin)]);
    rows.push([f.calcPnl, usdt(result.pnl, true)]);
    rows.push([
      f.calcRoeResult,
      result.roe === null ? (
        none
      ) : (
        <NumericText signed value={toFixedDecimal(result.roe, 2)} suffix="%" />
      ),
    ]);
  }
  if (tab === 'target')
    rows.push([f.calcTargetPrice, priceOf(result.targetPrice)]);
  if (tab === 'liquidation') {
    rows.push([f.calcLiqPrice, priceOf(result.liquidationPrice)]);
    if (result.initialMargin !== null)
      rows.push([f.calcInitialMargin, usdt(result.initialMargin)]);
  }
  if (tab === 'maxOpen') {
    rows.push([
      f.calcMaxQuantity,
      result.maxQuantity === null ? (
        none
      ) : (
        <NumericText value={groupThousands(result.maxQuantity)} />
      ),
    ]);
    rows.push([f.calcMaxNotional, usdt(result.maxNotional)]);
  }
  if (tab === 'openPrice') {
    rows.push([f.calcOpenPrice, priceOf(result.openPrice)]);
    rows.push([
      f.calcTotalQuantity,
      result.quantity === null ? (
        none
      ) : (
        <NumericText value={groupThousands(result.quantity)} />
      ),
    ]);
  }
  if (result.maxPositionAtLeverage !== null)
    rows.push([f.maxPosition, usdt(result.maxPositionAtLeverage)]);
  return (
    <dl
      aria-label={f.calcResult}
      className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-lg border border-line bg-raised px-3 py-2.5 text-xs"
    >
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="text-right font-medium text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
