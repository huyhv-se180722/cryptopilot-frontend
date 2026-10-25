import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpenText,
  CheckCircle2,
  GraduationCap,
  Search,
} from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { buttonClassName } from '../../components/ui/button-styles';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { AcademyDisclaimer } from '../../features/academy/components/AcademyDisclaimer';
import { AcademyLocale } from '../../features/academy/components/AcademyLocale';
import { ArticleCard } from '../../features/academy/components/ArticleCard';
import {
  ACADEMY_PAGE_SIZE,
  useAcademyArticles,
  useAcademyPath,
  useAcademyProgress,
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
 * The Academy home (T-114), as Binance Academy or Bitcoin.com Learn: the
 * beginner path, the topics, every lesson filtered by topic, level and a
 * search, and the way to the glossary. The filters and the page are in the
 * address, so a reload or a shared link opens the same list. Guests read it.
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
  const path = useAcademyPath();
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

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader title={a.title} description={a.subtitle} />

      <section aria-labelledby="academy-path" className="mb-8">
        <h2
          id="academy-path"
          className="flex items-center gap-2 text-base font-semibold text-fg"
        >
          <GraduationCap size={18} aria-hidden="true" />
          {a.pathTitle}
        </h2>
        <p className="mt-0.5 text-xs text-muted-dim">{a.pathSubtitle}</p>
        {progress.data && (
          <div className="mt-2 max-w-md">
            <p className="text-xs font-medium text-fg-2">
              {formatCopy(a.pathProgress, {
                done: progress.data.pathCompleted,
                total: progress.data.pathTotal,
              })}
            </p>
            <div
              role="progressbar"
              aria-label={a.pathTitle}
              aria-valuemin={0}
              aria-valuemax={progress.data.pathTotal}
              aria-valuenow={progress.data.pathCompleted}
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-alt"
            >
              <div
                className="h-full rounded-full bg-positive"
                style={{
                  width:
                    String(
                      progress.data.pathTotal === 0
                        ? 0
                        : (100 * progress.data.pathCompleted) /
                            progress.data.pathTotal,
                    ) + '%',
                }}
              />
            </div>
          </div>
        )}
        {path.isPending ? (
          <Skeleton className="mt-3 h-24 w-full rounded-2xl" />
        ) : path.isError ? (
          <ErrorState
            message={errorText(copy, path.error)}
            onRetry={() => void path.refetch()}
          />
        ) : (
          <ol className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {path.data.map((step) => (
              <li key={step.slug} className="w-56 shrink-0">
                <Link
                  to={'/academy/' + step.slug}
                  className="flex h-full flex-col rounded-2xl border border-line bg-surface p-3 no-underline hover:border-primary-line hover:bg-primary-soft"
                >
                  <span className="flex items-center justify-between text-[11px] font-semibold text-primary">
                    {formatCopy(a.pathStep, { n: step.pathOrder ?? 0 })}
                    {learned.has(step.slug) && (
                      <CheckCircle2
                        size={14}
                        aria-label={a.learned}
                        className="text-positive"
                      />
                    )}
                  </span>
                  <span className="mt-1 text-sm font-medium text-fg">
                    {step.title}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="academy-topics" className="mb-8">
        <h2 id="academy-topics" className="text-base font-semibold text-fg">
          {a.topicsTitle}
        </h2>
        {topics.isPending ? (
          <Skeleton className="mt-3 h-20 w-full rounded-2xl" />
        ) : topics.isError ? (
          <ErrorState
            message={errorText(copy, topics.error)}
            onRetry={() => void topics.refetch()}
          />
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topics.data.map((item) => (
              <button
                key={item.slug}
                type="button"
                aria-pressed={topic === item.slug}
                onClick={() =>
                  update({ topic: topic === item.slug ? undefined : item.slug })
                }
                className={classNames(
                  'rounded-2xl border p-3 text-left transition-colors',
                  topic === item.slug
                    ? 'border-primary-line bg-primary-soft'
                    : 'border-line bg-surface hover:bg-raised-hover',
                )}
              >
                <span className="block text-sm font-semibold text-fg">
                  {item.name}
                </span>
                <span className="mt-0.5 block text-xs text-muted-dim">
                  {formatCopy(a.topicLessons, { count: item.articles })}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="academy-lessons">
        <h2 id="academy-lessons" className="text-base font-semibold text-fg">
          {a.lessonsTitle}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px_200px]">
          <Input
            label={a.searchLabel}
            type="search"
            placeholder={a.searchPlaceholder}
            value={text}
            maxLength={100}
            onChange={(event) => setText(event.target.value)}
          />
          <Select
            label={a.topicLabel}
            value={topic ?? ''}
            onChange={(event) => update({ topic: event.target.value })}
          >
            <option value="">{a.allTopics}</option>
            {topics.data?.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            label={a.levelLabel}
            value={level ?? ''}
            onChange={(event) => update({ level: event.target.value })}
          >
            <option value="">{a.allLevels}</option>
            {LEVELS.map((item) => (
              <option key={item} value={item}>
                {a.levels[item]}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-4">
          {articles.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((n) => (
                <Skeleton key={n} className="h-40 w-full rounded-2xl" />
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
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>

        {pages > 1 && (
          <nav
            aria-label={a.lessonsTitle}
            className="mt-4 flex items-center justify-center gap-3"
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

      <section className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-alt p-4">
        <div className="flex items-center gap-3">
          <BookOpenText size={22} aria-hidden="true" className="text-primary" />
          <div>
            <p className="text-sm font-semibold text-fg">{a.glossaryTeaser}</p>
            <p className="text-xs text-muted-dim">{a.glossarySubtitle}</p>
          </div>
        </div>
        <Link to="/academy/glossary" className={buttonClassName('secondary')}>
          {a.openGlossary}
        </Link>
      </section>

      <AcademyDisclaimer />
    </div>
  );
}
