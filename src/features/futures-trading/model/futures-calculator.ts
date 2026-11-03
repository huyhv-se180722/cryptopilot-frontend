import type {
  FuturesCalculatorTab,
  MarginType,
  PositionDirection,
} from '../../../types/futures';
import { isPlainDecimal, isPositive } from '../../../utils/decimal-math';

/** The most parts the open price tab averages (the server's limit). */
export const MAX_LOTS = 20;

export const TABS: readonly FuturesCalculatorTab[] = [
  'pnl',
  'target',
  'liquidation',
  'maxOpen',
  'openPrice',
];

export interface Lot {
  price: string;
  quantity: string;
}

export interface Inputs {
  side: PositionDirection;
  marginType: MarginType;
  leverage: string;
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  roe: string;
  walletBalance: string;
  lots: Lot[];
}

export type Field =
  | 'leverage'
  | 'entryPrice'
  | 'exitPrice'
  | 'quantity'
  | 'roe'
  | 'walletBalance'
  | 'lots';

/** What each tab asks for; the open price tab its parts instead. */
export const FIELDS: Record<FuturesCalculatorTab, readonly Field[]> = {
  pnl: ['leverage', 'entryPrice', 'exitPrice', 'quantity'],
  target: ['leverage', 'entryPrice', 'roe'],
  liquidation: ['leverage', 'entryPrice', 'quantity', 'walletBalance'],
  maxOpen: ['leverage', 'entryPrice', 'walletBalance'],
  openPrice: ['lots'],
};

const positive = (value: string) => isPlainDecimal(value) && isPositive(value);
/** A signed decimal: the target return may be a loss. */
const signed = (value: string) =>
  isPlainDecimal(value.replace(/^-/, '')) && !/^-?0*(\.0*)?$/.test(value);

/** The fields of a tab the form refuses before asking (the server checks the rest). */
export function checkInputs(
  tab: FuturesCalculatorTab,
  inputs: Inputs,
  maxLeverage: number,
): Partial<Record<Field, 'required' | 'invalid'>> {
  const errors: Partial<Record<Field, 'required' | 'invalid'>> = {};
  const need = (field: Exclude<Field, 'lots'>, ok: (v: string) => boolean) => {
    const value = inputs[field].trim();
    if (value === '') {
      // An isolated position's margin defaults to its initial margin.
      const optional =
        field === 'walletBalance' &&
        tab === 'liquidation' &&
        inputs.marginType === 'ISOLATED';
      if (!optional) errors[field] = 'required';
    } else if (!ok(value)) errors[field] = 'invalid';
  };
  for (const field of FIELDS[tab]) {
    if (field === 'lots') {
      const filled = inputs.lots.filter(
        (lot) => lot.price.trim() !== '' || lot.quantity.trim() !== '',
      );
      if (filled.length === 0) errors.lots = 'required';
      else if (
        filled.some((lot) => !positive(lot.price) || !positive(lot.quantity))
      )
        errors.lots = 'invalid';
    } else if (field === 'leverage')
      need('leverage', (v) => {
        const n = Number(v);
        return /^\d+$/.test(v) && n >= 1 && n <= maxLeverage;
      });
    else if (field === 'roe') need('roe', signed);
    else need(field, positive);
  }
  return errors;
}

/** The body of a tab's request, with the backend's field names. */
export function requestOf(
  tab: FuturesCalculatorTab,
  symbol: string,
  inputs: Inputs,
): Record<string, unknown> {
  if (tab === 'openPrice')
    return {
      symbol,
      lots: inputs.lots
        .filter((lot) => lot.price.trim() !== '' || lot.quantity.trim() !== '')
        .map((lot) => ({ price: lot.price, quantity: lot.quantity })),
    };
  const body: Record<string, unknown> = {
    symbol,
    side: inputs.side,
    leverage: Number(inputs.leverage),
  };
  for (const field of FIELDS[tab])
    if (field !== 'leverage' && field !== 'lots' && inputs[field].trim() !== '')
      body[field] = inputs[field].trim();
  if (tab === 'liquidation') body.marginType = inputs.marginType;
  return body;
}
