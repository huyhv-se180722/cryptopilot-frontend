import { useId, useState } from 'react';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
import { useCopy } from '../../../hooks/use-copy';
import { useMediaQuery } from '../../../hooks/use-media-query';
import type { Decimal, MarketPair, OrderSide } from '../../../types/domain';
import {
  hasLimitPrice,
  type Funds,
  type PickedPrice,
  type SpotFormType,
} from '../model/spot-order';
import { SpotOrderForm } from './SpotOrderForm';

const STOP_FORMS = ['STOP_LIMIT', 'STOP_MARKET', 'TRAILING', 'OCO'] as const;
type StopForm = (typeof STOP_FORMS)[number];
const isStopForm = (type: SpotFormType): type is StopForm =>
  (STOP_FORMS as readonly string[]).includes(type);

/**
 * The Spot order panel as the exchange's: one choice of order type (Limit,
 * Market, Stop with its form) over a Buy form and a Sell form side by side,
 * each with its own price, amount and balance. A phone has room for one,
 * picked by Buy / Sell, which keeps what was typed. It says once why it
 * cannot trade while the demo account is not available.
 */
export function SpotOrderTicket({
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
  const p = useCopy().paper;
  const wide = useMediaQuery('(min-width: 768px)');
  const [type, setType] = useState<SpotFormType>('LIMIT');
  const [stopForm, setStopForm] = useState<StopForm>('STOP_LIMIT');
  const [side, setSide] = useState<OrderSide>('BUY');
  const reasonId = useId();

  // A price picked in the book needs a limit price to go into.
  const [seenPick, setSeenPick] = useState(picked?.at ?? 0);
  if (picked && picked.at !== seenPick) {
    setSeenPick(picked.at);
    if (!hasLimitPrice(type)) setType('LIMIT');
  }

  const form = (formSide: OrderSide) => (
    <SpotOrderForm
      pair={pair}
      side={formSide}
      type={type}
      lastPrice={lastPrice}
      picked={picked}
      funds={funds}
      unavailable={unavailable}
      reasonId={reasonId}
    />
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {!wide && (
          <SegmentedControl
            label={p.sideLabel}
            value={side}
            onChange={setSide}
            options={[
              { value: 'BUY', label: p.sideBUY },
              { value: 'SELL', label: p.sideSELL },
            ]}
          />
        )}
        <SegmentedControl
          label={p.orderTypeLabel}
          value={isStopForm(type) ? 'STOP' : type}
          onChange={(next) => setType(next === 'STOP' ? stopForm : next)}
          options={[
            { value: 'LIMIT', label: p.typeLIMIT },
            { value: 'MARKET', label: p.typeMARKET },
            { value: 'STOP', label: p.formSTOP },
          ]}
        />
        {isStopForm(type) && (
          <Select
            inline
            label={p.stopFormLabel}
            value={type}
            onChange={(event) => {
              const next = event.target.value as StopForm;
              setStopForm(next);
              setType(next);
            }}
          >
            {STOP_FORMS.map((each) => (
              <option key={each} value={each}>
                {p[`form${each}`]}
              </option>
            ))}
          </Select>
        )}
      </div>

      {wide ? (
        <div className="grid grid-cols-2 gap-6">
          {form('BUY')}
          {form('SELL')}
        </div>
      ) : (
        form(side)
      )}

      {unavailable && (
        <p id={reasonId} className="text-[11px] text-warning">
          {unavailable}
        </p>
      )}
      <p className="text-[10px] text-muted-dim">
        {type === 'STOP_LIMIT' || type === 'STOP_MARKET'
          ? p.stopNote + ' '
          : ''}
        {type === 'TRAILING' ? p.trailingNote + ' ' : ''}
        {type === 'MARKET' || type === 'STOP_MARKET'
          ? p.estimateNote + ' '
          : ''}
        {p.feeNote}
      </p>
    </div>
  );
}
