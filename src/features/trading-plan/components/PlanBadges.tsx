import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Badge, type Tone } from '../../../components/ui/Badge';
import { useCopy } from '../../../hooks/use-copy';
import type {
  PlanDirection,
  PlanStatus,
  WarningSeverity,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';

const STATUS_TONE: Record<PlanStatus, Tone> = {
  DRAFT: 'neutral',
  ACTIVE: 'info',
  EXECUTED: 'success',
  CANCELLED: 'neutral',
  EXPIRED: 'warning',
};

/** BR-32 status with a text label, never colour alone. */
export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  const p = useCopy().plan;
  return (
    <Badge tone={STATUS_TONE[status]} withDot>
      {p[`status${status}`]}
    </Badge>
  );
}

const SEVERITY_TONE: Record<WarningSeverity, Tone> = {
  INFO: 'info',
  WARNING: 'warning',
  BLOCKING: 'danger',
};

export function SeverityBadge({ severity }: { severity: WarningSeverity }) {
  const p = useCopy().plan;
  return (
    <Badge tone={SEVERITY_TONE[severity]}>{p[`severity${severity}`]}</Badge>
  );
}

/** Long in green with an up arrow, short in red with a down arrow. */
export function DirectionText({ direction }: { direction: PlanDirection }) {
  const p = useCopy().plan;
  const Icon = direction === 'LONG' ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-0.5 text-xs font-semibold',
        direction === 'LONG' ? 'text-positive' : 'text-negative',
      )}
    >
      <Icon size={13} aria-hidden="true" />
      {p[`direction${direction}`]}
    </span>
  );
}
