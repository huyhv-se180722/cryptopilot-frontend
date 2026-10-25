import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useAuth } from '../../../hooks/use-auth';
import { useCopy } from '../../../hooks/use-copy';
import { errorText } from '../../../i18n/messages';
import {
  useAcademyProgress,
  useIsAcademyTrader,
  useLessonMark,
} from '../hooks/use-academy';

/**
 * "Mark as learned" on a lesson page (T-114). A Trader toggles it; a Guest
 * is invited to sign in; an Admin, who keeps no progress, sees nothing.
 */
export function LessonMark({ slug }: { slug: string }) {
  const copy = useCopy();
  const a = copy.academy;
  const signedIn = useAuth().session !== null;
  const trader = useIsAcademyTrader();
  const progress = useAcademyProgress();
  const mark = useLessonMark();

  if (!trader)
    return signedIn ? null : (
      <Link to="/login" className={buttonClassName('secondary')}>
        {a.signInToTrack}
      </Link>
    );

  const learned =
    progress.data?.completed.some((lesson) => lesson.slug === slug) ?? false;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant={learned ? 'secondary' : 'primary'}
        aria-pressed={learned}
        disabled={progress.isPending || mark.pending}
        onClick={() => void mark.run(slug, !learned)}
      >
        {learned ? (
          <CheckCircle2 size={15} aria-hidden="true" />
        ) : (
          <Circle size={15} aria-hidden="true" />
        )}
        {learned ? a.learned : a.markLearned}
      </Button>
      {learned && (
        <span className="text-xs text-muted-dim">{a.unmarkHint}</span>
      )}
      {mark.state.status === 'error' && (
        <span role="alert" className="text-xs text-negative">
          {errorText(copy, mark.state.error)}
        </span>
      )}
    </div>
  );
}
