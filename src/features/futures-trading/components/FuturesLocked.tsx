import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { messageText } from '../../../i18n/messages';

/** Without the Futures feature a Futures view shows MSG29 (Q-T10). */
export function FuturesLocked({ headingLevel = 1 }: { headingLevel?: 1 | 2 }) {
  const copy = useCopy();
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section
      aria-labelledby="futures-trade-locked"
      className="mx-auto mt-6 max-w-md rounded-xl border border-line bg-surface p-6 text-center"
    >
      <Lock size={20} aria-hidden="true" className="mx-auto mb-3 text-muted" />
      <Heading
        id="futures-trade-locked"
        className="mb-2 text-base font-semibold text-fg"
      >
        {copy.futures.lockedTitle}
      </Heading>
      <p className="mb-4 text-sm text-muted">
        {messageText(copy, 'MSG29', [], { plan: 'PRO' })}
      </p>
      <Link
        to="/subscription"
        className={buttonClassName('primary', 'md', 'no-underline')}
      >
        {copy.analysis.viewPlans}
      </Link>
    </section>
  );
}
