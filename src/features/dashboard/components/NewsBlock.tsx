import { useQuery } from '@tanstack/react-query';
import { useCopy } from '../../../hooks/use-copy';
import { useServices } from '../../../hooks/use-services';
import { errorText } from '../../../i18n/messages';
import { DashboardCard, PendingBlock } from './DashboardCard';

/**
 * Latest news (SCR-08, opens SCR-28). The news API is T-079/T-080: until
 * it exists the port answers NOT_CONFIGURED and the block says so instead
 * of showing invented articles.
 */
export function NewsBlock() {
  const copy = useCopy();
  const d = copy.dashboard;
  const { news } = useServices();
  const query = useQuery({
    queryKey: ['news', 'latest'],
    queryFn: ({ signal }) => news.list({ limit: 5, signal }),
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
              <a href={article.originalUrl} target="_blank" rel="noreferrer">
                {article.title}
              </a>
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
