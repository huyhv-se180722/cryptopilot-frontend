import { Link } from 'react-router-dom';
import { Check, GraduationCap } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  AcademyArticleSummary,
  AcademyProgress,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { LessonCover } from './LessonCover';
import { ReadingTime } from './ArticleCard';

/**
 * The beginner path of the Academy home (T-114): numbered steps in order,
 * each with a small cover; a Trader sees the learned steps checked and how
 * far along the path they are.
 */
export function BeginnerPath({
  steps,
  progress,
}: {
  steps: readonly AcademyArticleSummary[];
  progress: AcademyProgress | undefined;
}) {
  const a = useCopy().academy;
  const learned = new Set(progress?.completed.map((lesson) => lesson.slug));
  const share =
    progress && progress.pathTotal > 0
      ? (100 * progress.pathCompleted) / progress.pathTotal
      : 0;
  return (
    <section aria-labelledby="academy-path" className="mb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="academy-path"
            className="flex items-center gap-2 text-lg font-semibold text-fg"
          >
            <GraduationCap
              size={20}
              aria-hidden="true"
              className="text-primary"
            />
            {a.pathTitle}
          </h2>
          <p className="mt-0.5 text-sm text-muted-dim">{a.pathSubtitle}</p>
        </div>
        {progress && (
          <div className="w-full max-w-xs">
            <p className="text-xs font-medium text-fg-2">
              {formatCopy(a.pathProgress, {
                done: progress.pathCompleted,
                total: progress.pathTotal,
              })}
            </p>
            <div
              role="progressbar"
              aria-label={a.pathTitle}
              aria-valuemin={0}
              aria-valuemax={progress.pathTotal}
              aria-valuenow={progress.pathCompleted}
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-alt"
            >
              <div
                className="h-full rounded-full bg-positive transition-all"
                style={{ width: String(share) + '%' }}
              />
            </div>
          </div>
        )}
      </div>
      <ol className="mt-4 flex snap-x gap-4 overflow-x-auto pb-3">
        {steps.map((step) => {
          const done = learned.has(step.slug);
          return (
            <li key={step.slug} className="w-60 shrink-0 snap-start">
              <Link
                to={'/academy/' + step.slug}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <LessonCover
                  slug={step.slug}
                  topicSlug={step.topicSlug}
                  iconSize={32}
                  className="h-20"
                >
                  <span
                    className={classNames(
                      'm-3 inline-flex size-8 items-center justify-center rounded-full text-sm font-bold shadow',
                      done
                        ? 'bg-positive text-white'
                        : 'bg-white text-slate-900',
                    )}
                  >
                    {done ? (
                      <Check size={16} aria-label={a.learned} />
                    ) : (
                      step.pathOrder
                    )}
                  </span>
                </LessonCover>
                <div className="flex flex-1 flex-col p-3">
                  <span className="text-[11px] font-semibold text-primary">
                    {formatCopy(a.pathStep, { n: step.pathOrder ?? 0 })}
                  </span>
                  <span className="mt-0.5 flex-1 text-sm leading-snug font-medium text-fg group-hover:text-primary">
                    {step.title}
                  </span>
                  <span className="mt-2">
                    <ReadingTime minutes={step.readingMinutes} />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
