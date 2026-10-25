import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Badge, type Tone } from '../../../components/ui/Badge';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  AcademyArticleSummary,
  AcademyLevel,
} from '../../../types/domain';

const levelTone: Record<AcademyLevel, Tone> = {
  BEGINNER: 'success',
  INTERMEDIATE: 'info',
  ADVANCED: 'warning',
};

export function LevelBadge({ level }: { level: AcademyLevel }) {
  const copy = useCopy();
  return <Badge tone={levelTone[level]}>{copy.academy.levels[level]}</Badge>;
}

export function ReadingTime({ minutes }: { minutes: number }) {
  const copy = useCopy();
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-dim">
      <Clock size={12} aria-hidden="true" />
      {formatCopy(copy.academy.readingTime, { minutes })}
    </span>
  );
}

/** A lesson as a card: topic, title, summary, level and reading time. */
export function ArticleCard({ article }: { article: AcademyArticleSummary }) {
  return (
    <Link
      to={'/academy/' + article.slug}
      className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 no-underline transition-colors hover:border-line-strong hover:bg-raised-hover"
    >
      <span className="text-[11px] font-semibold tracking-wider text-muted-x uppercase">
        {article.topicName}
      </span>
      <h3 className="mt-1 text-sm font-semibold text-fg group-hover:text-primary">
        {article.title}
      </h3>
      <p className="mt-1.5 line-clamp-3 flex-1 text-xs leading-5 text-muted-dim">
        {article.summary}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <LevelBadge level={article.level} />
        <ReadingTime minutes={article.readingMinutes} />
      </div>
    </Link>
  );
}
