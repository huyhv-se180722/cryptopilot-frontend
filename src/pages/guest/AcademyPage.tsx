import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { AcademyDisclaimer } from '../../features/academy/components/AcademyDisclaimer';
import { AcademyHero } from '../../features/academy/components/AcademyHero';
import { AcademyLocale } from '../../features/academy/components/AcademyLocale';
import { ArticleCard } from '../../features/academy/components/ArticleCard';
import {
  ACADEMY_PAGE_SIZE,
  useAcademyArticles,
  useAcademyProgress,
  useAcademyTerms,
  useAcademyTopics,
} from '../../features/academy/hooks/use-academy';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import type { AcademyLevel } from '../../types/domain';
import { classNames } from '../../utils/class-names';

const LEVELS: readonly AcademyLevel[] = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
];
/** The backend searches 2 to 100 characters; a shorter text is no search. */
const SEARCH_MIN = 2;
const SEARCH_DELAY_MS = 350;

const asLevel = (value: string | null): AcademyLevel | undefined =>
  LEVELS.find((level) => level === value);

/**
 * The Academy home (T-114), as Binance Academy or Bitcoin.com Learn: a hero
 * with the lesson search, the glossary and, for a Trader, how many lessons
 * they have read; then every lesson with its cover, filtered by a topic
 * select, the level and the search. The filters and the page are in the address,
 * so a reload or a shared link opens the same list. Guests read it.
 */
export function AcademyPage() {
  return (
    <AcademyLocale>
      <AcademyHome />
    </AcademyLocale>
  );
}

function AcademyHome() {
  const copy = useCopy();
  const a = copy.academy;
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic') ?? undefined;
  const level = asLevel(params.get('level'));
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [text, setText] = useState(q);

  const update = useCallback(
    (changes: Record<string, string | undefined>) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes))
            if (value) next.set(key, value);
            else next.delete(key);
          // A new filter starts again at the first page.
          if (!('page' in changes)) next.delete('page');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  useEffect(() => {
    const wanted = text.trim().length >= SEARCH_MIN ? text.trim() : '';
    if (wanted === q) return;
    const timer = setTimeout(() => update({ q: wanted }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, q, update]);

  const progress = useAcademyProgress();
  const learned = new Set(
    progress.data?.completed.map((lesson) => lesson.slug) ?? [],
  );
  const topics = useAcademyTopics();
  const terms = useAcademyTerms({});
  const articles = useAcademyArticles({
    ...(topic ? { topic } : {}),
    ...(level ? { level } : {}),
    ...(q ? { q } : {}),
    page,
    pageSize: ACADEMY_PAGE_SIZE,
  });
  const pages = articles.data
    ? Math.max(1, Math.ceil(articles.data.total / articles.data.pageSize))
    : 1;
  const lessonTotal = topics.data?.reduce((sum, t) => sum + t.articles, 0);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AcademyHero
        text={text}
        onText={setText}
        lessons={lessonTotal}
        topics={topics.data?.length}
        terms={terms.data}
        read={
          progress.data
            ? {
                done: progress.data.completed.length,
                total: progress.data.publishedTotal,
              }
            : undefined
        }
      />

      <section aria-labelledby="academy-lessons">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 id="academy-lessons" className="text-lg font-semibold text-fg">
            {a.lessonsTitle}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              label={a.topicLabel}
              inline
              value={topic ?? ''}
              onChange={(event) => update({ topic: event.target.value })}
              className="min-w-60"
            >
              <option value="">{a.allTopics}</option>
              {topics.data?.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name} ({item.articles})
                </option>
              ))}
            </Select>
            <div
              role="group"
              aria-label={a.levelLabel}
              className="inline-flex rounded-full border border-line bg-surface p-1"
            >
              {[undefined, ...LEVELS].map((item) => (
                <button
                  key={item ?? 'all'}
                  type="button"
                  aria-pressed={level === item}
                  onClick={() => update({ level: item })}
                  className={classNames(
                    'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    level === item
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-dim hover:text-fg',
                  )}
                >
                  {item ? a.levels[item] : a.allLevels}
                </button>
              ))}
            </div>
          </div>
        </div>

        {articles.isPending ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
        ) : articles.isError ? (
          <ErrorState
            message={errorText(copy, articles.error)}
            onRetry={() => void articles.refetch()}
          />
        ) : articles.data.items.length === 0 ? (
          <EmptyState icon={Search} title={a.noLessons} />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.data.items.map((article) => (
              <li key={article.slug}>
                <ArticleCard
                  article={article}
                  learned={learned.has(article.slug)}
                />
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav
            aria-label={a.lessonsTitle}
            className="mt-6 flex items-center justify-center gap-3"
          >
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
            >
              {a.previousPage}
            </Button>
            <span className="text-xs text-muted-dim">
              {formatCopy(a.pageOf, { page, pages })}
            </span>
            <Button
              variant="secondary"
              disabled={page >= pages}
              onClick={() => update({ page: String(page + 1) })}
            >
              {a.nextPage}
            </Button>
          </nav>
        )}
      </section>

      <AcademyDisclaimer />
    </div>
  );
}
