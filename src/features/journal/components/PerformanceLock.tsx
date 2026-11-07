import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { messageText } from '../../../i18n/messages';

/** A part of SCR-23 the plan does not open (CR-08), with its way to upgrade. */
export function PerformanceLock({
  title,
  tier = 'PRO',
}: {
  title: string;
  tier?: string;
}) {
  const copy = useCopy();
  return (
    <section
      aria-label={title}
      className="mb-4 rounded-xl border border-dashed border-line bg-surface p-4"
    >
      <h2 className="mb-2 text-sm font-semibold text-fg">{title}</h2>
      <p className="mb-2 flex items-start gap-1.5 text-xs text-muted">
        <Lock size={13} aria-hidden="true" className="mt-px shrink-0" />
        {messageText(copy, 'MSG29', [], { plan: tier })}
      </p>
      <Link to="/subscription" className="text-xs font-medium">
        {copy.performance.viewPlans}
      </Link>
    </section>
  );
}
