import { Badge, type Tone } from '../../../components/ui/Badge';
import { useCopy } from '../../../hooks/use-copy';
import type { OrderStatus } from '../../../types/domain';

const TONE: Record<OrderStatus, Tone> = {
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'danger',
  EXPIRED: 'neutral',
};

/** The status of a subscription order, coloured as the gateway left it. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useCopy().adminOrders;
  return (
    <Badge tone={TONE[status]} withDot>
      {t[`status${status}`]}
    </Badge>
  );
}
