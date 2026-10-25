import { LayoutGrid } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { AcademyTopic } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { topicVisual } from '../topic-visuals';

/**
 * The topics of the Academy home (T-114), which are also the topic filter
 * of the lesson list: pressing one shows its lessons, pressing it again or
 * "All topics" shows every lesson.
 */
export function TopicFilter({
  topics,
  selected,
  total,
  onSelect,
}: {
  topics: readonly AcademyTopic[];
  selected: string | undefined;
  total: number;
  onSelect: (topic: string | undefined) => void;
}) {
  const a = useCopy().academy;
  const card =
    'group flex items-center gap-3 rounded-2xl border p-3 text-left transition-all';
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <button
        type="button"
        aria-pressed={selected === undefined}
        onClick={() => onSelect(undefined)}
        className={classNames(
          card,
          selected === undefined
            ? 'border-primary-line bg-primary-soft shadow-sm'
            : 'border-line bg-surface hover:-translate-y-0.5 hover:shadow-md',
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white">
          <LayoutGrid size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-fg">
            {a.allTopics}
          </span>
          <span className="block text-xs text-muted-dim">
            {formatCopy(a.topicLessons, { count: total })}
          </span>
        </span>
      </button>
      {topics.map((topic) => {
        const { icon: Icon, from, to } = topicVisual(topic.slug);
        const active = selected === topic.slug;
        return (
          <button
            key={topic.slug}
            type="button"
            aria-pressed={active}
            title={topic.description}
            onClick={() => onSelect(active ? undefined : topic.slug)}
            className={classNames(
              card,
              active
                ? 'border-primary-line bg-primary-soft shadow-sm'
                : 'border-line bg-surface hover:-translate-y-0.5 hover:shadow-md',
            )}
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            >
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-fg">
                {topic.name}
              </span>
              <span className="block text-xs text-muted-dim">
                {formatCopy(a.topicLessons, { count: topic.articles })}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
