import { Link } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { useProfileData } from '../../profile/hooks/use-profile';

/**
 * The trading style and risk profile the assistant answers for (T-074),
 * read from the Trader's profile; a link to the profile to change them, or
 * to choose a style when none is set. Nothing while the profile loads or
 * when it cannot be read: the questions still work without it.
 */
export function StyleChip() {
  const t = useCopy().aiAssistant;
  const { state } = useProfileData();
  if (state.status !== 'success') return null;
  const { tradingStyle, riskProfile } = state.data.profile;
  const label =
    tradingStyle === null
      ? t.styleNotSet
      : formatCopy(t.styleChip, {
          style: t.tradingStyles[tradingStyle],
          risk: t.riskProfiles[riskProfile],
        });
  return (
    <Link
      to="/profile"
      title={t.styleNotSetHint}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-fg-2 hover:border-primary hover:text-primary"
    >
      <SlidersHorizontal size={12} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
