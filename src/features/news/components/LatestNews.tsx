import { Link } from 'react-router-dom';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { useLatestNews } from '../hooks/use-news';
import { NewsCover } from './NewsCover';
import { newsAge, newsArticlePath } from './news-format';

/** Articles the side list shows. */
const SHOWN = 6;

/**
 * The newest articles beside the one being read (D-125), as a news site
 * lists them: a small cover, the headline, the source and its age, each
 * opening its page. The article being read is left out.
 */
export function LatestNews({ currentId }: { currentId: string }) {
  const copy = useCopy();
  const n = copy.news;
  // One more than shown, so leaving the current article out still fills it.
  const latest = useLatestNews(SHOWN + 1);
  const articles = (latest.data?.items ?? [])
    .filter((article) => article.id !== currentId)
    .slice(0, SHOWN);

  return (
    <section
      aria-labelledby="latest-news-title"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <h2
        id="latest-news-title"
        className="mb-3 text-[10px] font-semibold tracking-widest text-muted-x uppercase"
      >
        {n.latestTitle}
      </h2>
      {latest.isPending ? (
        <div className="grid gap-3">
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p className="text-xs text-muted">{n.latestEmpty}</p>
      ) : (
        <ul className="grid gap-3">
          {articles.map((article) => (
            <li key={article.id}>
              <Link
                to={newsArticlePath(article.id)}
                className="group flex gap-3 no-underline"
              >
                <NewsCover
                  article={article}
                  className="h-14 w-20 shrink-0 rounded-md"
                />
                <span className="min-w-0">
                  <span className="line-clamp-2 text-xs leading-snug font-semibold text-fg group-hover:text-primary">
                    {article.title}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-dim">
                    {article.source} · {newsAge(copy, article.publishedAt)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
