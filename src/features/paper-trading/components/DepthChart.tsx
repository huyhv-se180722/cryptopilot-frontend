import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import {
  DEPTH_H,
  DEPTH_W,
  depthPath,
  type DepthRow as Row,
} from '../model/depth';
import { formatQuantity } from '../model/order-book';

/**
 * The depth chart of the order book (TR-F2): the running total of each side
 * against the price, bids rising to the left of the spread, asks to the
 * right, over the levels the book holds (the exchange's depth20). Drawn
 * once per book, no library.
 */
export function DepthChart({
  bids,
  asks,
  base,
  stepSize,
}: {
  bids: readonly Row[];
  asks: readonly Row[];
  base: string;
  stepSize: string | null;
}) {
  const p = useCopy().paper;
  const lowest = bids[bids.length - 1]?.price ?? asks[0]?.price;
  const highest = asks[asks.length - 1]?.price ?? bids[0]?.price;
  const low = Number(lowest ?? 0);
  const high = Number(highest ?? 0);
  const bidTotal = bids[bids.length - 1]?.cumulative ?? '0';
  const askTotal = asks[asks.length - 1]?.cumulative ?? '0';
  const max = Math.max(Number(bidTotal), Number(askTotal));
  return (
    <figure className="flex min-h-0 flex-1 flex-col gap-1">
      <svg
        role="img"
        aria-label={formatCopy(p.depthLabel, {
          bids: formatQuantity(bidTotal, stepSize),
          asks: formatQuantity(askTotal, stepSize),
          asset: base,
        })}
        viewBox={`0 0 ${DEPTH_W} ${DEPTH_H}`}
        preserveAspectRatio="none"
        className="min-h-40 w-full flex-1"
      >
        <path
          d={depthPath(bids, low, high, max)}
          className="fill-positive-soft stroke-positive"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={depthPath(asks, low, high, max)}
          className="fill-negative-soft stroke-negative"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="flex justify-between font-mono text-xs text-muted-dim">
        <span>{lowest ?? '—'}</span>
        <span>{highest ?? '—'}</span>
      </figcaption>
    </figure>
  );
}
