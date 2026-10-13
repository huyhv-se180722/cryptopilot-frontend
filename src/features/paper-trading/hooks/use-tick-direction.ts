import { useState } from 'react';
import { compareDecimal } from '../../../utils/decimal-format';

export type Direction = 'up' | 'down' | null;

/** The last price and whether it moved up or down on the latest tick. */
export function useTickDirection(price: string | null): Direction {
  const [state, setState] = useState<{ price: string | null; dir: Direction }>({
    price,
    dir: null,
  });
  if (state.price !== price) {
    const order =
      state.price !== null && price !== null
        ? compareDecimal(price, state.price)
        : 0;
    setState({
      price,
      dir: order > 0 ? 'up' : order < 0 ? 'down' : state.dir,
    });
  }
  return state.dir;
}
