import { Link } from 'react-router-dom';
import { ShieldCheck, Zap } from 'lucide-react';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';

const panel = 'rounded-2xl border border-line bg-surface p-4';
const heading =
  'mb-3 text-[10px] font-semibold tracking-widest text-muted-x uppercase';

export function RulesCard() {
  const c = useCopy().community;
  return (
    <section className={panel} aria-labelledby="community-rules">
      <h2
        id="community-rules"
        className={heading + ' flex items-center gap-1.5'}
      >
        <ShieldCheck size={12} aria-hidden="true" className="text-primary" />
        {c.rulesTitle}
      </h2>
      <p className="text-[11px] leading-relaxed text-muted-dim">
        {c.rulesBody}
      </p>
    </section>
  );
}

/** Figma "Join the conversation" card for Guests (D-99). */
export function JoinCard() {
  const c = useCopy().community;
  return (
    <section className="rounded-2xl border border-line-strong bg-linear-135 from-primary-soft to-accent-soft p-4">
      <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-fg">
        <Zap size={13} aria-hidden="true" className="text-accent" />
        {c.signInTitle}
      </h2>
      <p className="mb-4 text-[11px] leading-relaxed text-muted-dim">
        {c.signInBody}
      </p>
      <Link
        to="/register"
        state={{ from: '/community' }}
        className={buttonClassName('primary', 'md', 'w-full')}
      >
        {c.register}
      </Link>
      <Link
        to="/login"
        state={{ from: '/community' }}
        className={buttonClassName('ghost', 'md', 'mt-2 w-full')}
      >
        {c.signIn}
      </Link>
    </section>
  );
}
