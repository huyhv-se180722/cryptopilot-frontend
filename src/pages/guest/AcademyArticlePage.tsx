import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookX,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lightbulb,
} from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { buttonClassName } from '../../components/ui/button-styles';
import { Skeleton } from '../../components/ui/Skeleton';
import { AcademyLocale } from '../../features/academy/components/AcademyLocale';
import { ArticleCard } from '../../features/academy/components/ArticleCard';
import { LessonCover } from '../../features/academy/components/LessonCover';
import { LessonMark } from '../../features/academy/components/LessonMark';
import { MarkdownView } from '../../features/academy/components/MarkdownView';
import { useAcademyArticle } from '../../features/academy/hooks/use-academy';
import { outline, parseMarkdown } from '../../features/academy/markdown';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import type { AcademyArticle, AcademyArticleLink } from '../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../utils/instant-format';

/**
 * A lesson of the Academy (T-114): its summary, a table of contents, the
 * body, "mark as learned" for a Trader, the screen of the app it leads to,
 * the lesson before and after it and related lessons of its topic. Guests
 * read it.
 */
export function AcademyArticlePage() {
  return (
    <AcademyLocale>
      <ArticleScreen />
    </AcademyLocale>
  );
}

function ArticleScreen() {
  const { slug = '' } = useParams();
  const copy = useCopy();
  const article = useAcademyArticle(slug);

  const back = (
    <Link
      to="/academy"
      className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted no-underline hover:text-fg-2"
    >
      <ArrowLeft size={13} aria-hidden="true" />
      {copy.academy.backToAcademy}
    </Link>
  );

  if (article.isPending)
    return (
      <div className="mx-auto w-full max-w-5xl">
        {back}
        <Skeleton className="h-10 w-2/3 rounded-xl" />
        <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
      </div>
    );
  if (article.isError) {
    const notFound =
      (article.error as { status?: number } | null)?.status === 404;
    return (
      <div className="mx-auto w-full max-w-5xl">
        {back}
        {notFound ? (
          <EmptyState icon={BookX} title={copy.academy.notFound} />
        ) : (
          <ErrorState
            message={errorText(copy, article.error)}
            onRetry={() => void article.refetch()}
          />
        )}
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-5xl">
      {back}
      <Lesson article={article.data} />
    </div>
  );
}

function Lesson({ article }: { article: AcademyArticle }) {
  const copy = useCopy();
  const a = copy.academy;
  const blocks = useMemo(() => parseMarkdown(article.body), [article.body]);
  const contents = outline(blocks);

  return (
    <article>
      <LessonCover
        topicSlug={article.topicSlug}
        imageUrl={article.coverImageUrl}
        iconSize={96}
        className="mb-8 rounded-3xl shadow-lg"
      >
        <header className="flex min-h-72 flex-col justify-end p-6 text-white sm:p-8">
          <Link
            to={'/academy?topic=' + encodeURIComponent(article.topicSlug)}
            className="w-fit rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold tracking-wider text-white uppercase no-underline backdrop-blur hover:bg-white/30"
          >
            {article.topicName}
          </Link>
          <h1 className="mt-3 max-w-2xl text-2xl leading-tight font-bold text-white sm:text-3xl">
            {article.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-white">
            <span className="rounded-full bg-black/25 px-2.5 py-1">
              {a.levels[article.level]}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1">
              <Clock size={12} aria-hidden="true" />
              {formatCopy(a.readingTime, { minutes: article.readingMinutes })}
            </span>
            <time
              dateTime={article.updatedAt}
              title={formatInstantUtc(article.updatedAt)}
              className="rounded-full bg-black/25 px-2.5 py-1"
            >
              {formatCopy(a.updated, {
                date: formatInstantLocal(article.updatedAt).slice(0, 10),
              })}
            </time>
          </div>
          {article.coverCredit && (
            <p className="mt-4 text-[11px] text-white/60">
              {formatCopy(a.photoCredit, { credit: article.coverCredit })}
            </p>
          )}
        </header>
      </LessonCover>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <aside
            aria-label={a.summaryTitle}
            className="rounded-2xl border border-primary-line bg-primary-soft p-4"
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
              <Lightbulb size={14} aria-hidden="true" />
              {a.summaryTitle}
            </p>
            <p className="mt-1.5 text-sm leading-6 text-fg">
              {article.summary}
            </p>
          </aside>

          <MarkdownView blocks={blocks} />

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <LessonMark slug={article.slug} />
            {article.appLink && (
              <Link
                to={article.appLink}
                className={buttonClassName('secondary')}
              >
                {a.tryInApp}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>

          <Neighbours previous={article.previous} next={article.next} />
        </div>

        {contents.length > 0 && (
          <nav aria-label={a.contents} className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-[11px] font-semibold tracking-wider text-muted-x uppercase">
                {a.contents}
              </p>
              <ol className="mt-2 grid gap-1.5 border-l border-line pl-3 text-xs">
                {contents.map((entry) => (
                  <li key={entry.id}>
                    <a
                      href={'#' + entry.id}
                      className="text-muted-dim no-underline hover:text-fg"
                    >
                      {entry.text}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
        )}
      </div>

      {article.related.length > 0 && (
        <section aria-labelledby="academy-related" className="mt-10">
          <h2 id="academy-related" className="text-base font-semibold text-fg">
            {a.related}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {article.related.map((item) => (
              <li key={item.slug}>
                <ArticleCard article={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Neighbours({
  previous,
  next,
}: {
  previous: AcademyArticleLink | null;
  next: AcademyArticleLink | null;
}) {
  const copy = useCopy();
  if (!previous && !next) return null;
  const card =
    'flex flex-col rounded-2xl border border-line bg-surface p-3 no-underline hover:bg-raised-hover';
  return (
    <nav className="mt-8 grid gap-3 sm:grid-cols-2">
      {previous ? (
        <Link to={'/academy/' + previous.slug} className={card} rel="prev">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-x uppercase">
            <ChevronLeft size={12} aria-hidden="true" />
            {copy.academy.previous}
          </span>
          <span className="mt-1 text-sm font-medium text-fg">
            {previous.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          to={'/academy/' + next.slug}
          className={card + ' text-right sm:items-end'}
          rel="next"
        >
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-x uppercase">
            {copy.academy.next}
            <ChevronRight size={12} aria-hidden="true" />
          </span>
          <span className="mt-1 text-sm font-medium text-fg">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
