import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useCopy } from '../../../hooks/use-copy';
import { useServices } from '../../../hooks/use-services';
import { errorText } from '../../../i18n/messages';
import { DashboardCard, PendingBlock } from './DashboardCard';

/** The latest articles the block lists. */
const LATEST = 5;

/**
 * Latest news (SCR-08, opens SCR-28): the five newest articles of the
 * feed, the AI's headline once summarized (D-123), each opening its page
 * in the app (D-125).
 */
export function NewsBlock() {
  const copy = useCopy();
  const d = copy.dashboard;
  const { news } = useServices();
  const query = useQuery({
    queryKey: ['news', 'latest', null, LATEST],
    queryFn: ({ signal }) => news.feed({ page: 1, pageSize: LATEST }, signal),
  });
  return (
    <DashboardCard
      title={d.newsTitle}
      link={{ to: '/news', label: d.openPage }}
    >
      {query.isError ? (
        <PendingBlock message={errorText(copy, query.error)} />
      ) : query.data?.items.length ? (
        <ul>
          {query.data.items.map((article) => (
            <li
              key={article.id}
              className="border-b border-line px-4 py-3 text-xs last:border-b-0"
            >
              <Link to={'/news/' + encodeURIComponent(article.id)}>
                {article.title}
              </Link>
              <span className="mt-0.5 block text-[11px] text-muted-dim">
                {article.source}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <PendingBlock
          message={query.isPending ? copy.common.loading : copy.messages.MSG41}
        />
      )}
    </DashboardCard>
  );
}
