import { Link } from 'react-router-dom';
import {
  Check,
  Newspaper,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Dialog } from '../../../components/ui/Dialog';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';

/** Guests read the community (D-99); News stays Trader-only. */
export type GatedFeature = 'news';

const icons: Record<GatedFeature, LucideIcon> = {
  news: Newspaper,
};

/**
 * Figma AccessGate: invites a guest to register for a Trader-only area
 * (SRS 3.1.3). Lists capabilities only — plan limits are backend data.
 */
export function AccessGate({
  feature,
  onClose,
}: {
  feature: GatedFeature | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  const content = feature
    ? {
        news: { title: copy.gate.newsTitle, body: copy.gate.newsBody },
      }[feature]
    : { title: '', body: '' };
  const Icon = feature ? icons[feature] : Users;
  const included = [
    copy.gate.featurePlans,
    copy.gate.featureWatchlist,
    copy.gate.featureJournal,
    copy.gate.featureCommunity,
  ];
  return (
    <Dialog
      open={feature !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={content.title}
      description={content.body}
      size="sm"
    >
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-linear-135 from-primary to-accent text-white shadow-glow-primary">
        <Icon size={22} aria-hidden="true" />
      </div>
      <div className="mb-6 rounded-2xl border border-line bg-raised px-4 py-3.5">
        <div className="mb-3 flex items-center gap-1.5">
          <Sparkles size={11} aria-hidden="true" className="text-accent" />
          <span className="text-[10px] font-semibold tracking-widest text-muted-x uppercase">
            {copy.gate.includes}
          </span>
        </div>
        <ul className="grid gap-1">
          {included.map((label) => (
            <li
              key={label}
              className="flex items-center gap-2.5 py-0.5 text-xs"
            >
              <span className="flex size-[18px] shrink-0 items-center justify-center rounded-md bg-positive-soft text-positive">
                <Check size={11} aria-hidden="true" />
              </span>
              <span className="text-fg-2">{label}</span>
            </li>
          ))}
        </ul>
      </div>
      <Link
        to="/register"
        onClick={onClose}
        className={buttonClassName('primary', 'lg', 'mb-3 w-full rounded-2xl')}
      >
        {copy.gate.register}
      </Link>
      <Link
        to="/login"
        onClick={onClose}
        className={buttonClassName('secondary', 'lg', 'w-full rounded-2xl')}
      >
        {copy.gate.login}
      </Link>
      <p className="mt-4 text-center text-[11px] text-muted-x">
        {copy.gate.footnote}
      </p>
    </Dialog>
  );
}
