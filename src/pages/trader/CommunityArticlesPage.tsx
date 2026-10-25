import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { CommunityFrame } from '../../features/community/components/CommunityFrame';
import { PostCard } from '../../features/community/components/PostCard';
import { usePostInteractions } from '../../features/community/components/use-post-interactions';
import {
  LIST_PAGE_SIZE,
  useArticlesPage,
} from '../../features/community/hooks/use-community';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import type { OfficialCategory } from '../../types/domain';
import { classNames } from '../../utils/class-names';

const CATEGORIES: readonly OfficialCategory[] = [
  'EDUCATION',
  'PLATFORM_UPDATE',
  'ANNOUNCEMENT',
];

/**
 * Articles (D-99): where CoinMarketCap Community lists its articles, the
 * CryptoPilot team's official posts, by category (UC-44, BR-61).
 */
export function CommunityArticlesPage() {
  const copy = useCopy();
  const c = copy.community;
  const actions = usePostInteractions();
  const [category, setCategory] = useState<OfficialCategory | undefined>();
  const [page, setPage] = useState(1);
  const articles = useArticlesPage(category, page);
  const posts = articles.data?.items ?? [];
  const options: readonly {
    id: OfficialCategory | undefined;
    label: string;
  }[] = [
    { id: undefined, label: c.articlesAll },
    ...CATEGORIES.map((id) => ({ id, label: c[`category${id}`] })),
  ];
  return (
    <CommunityFrame actions={actions}>
      {() => (
        <>
          <div className="mb-4">
            <h1 className="text-2xl font-bold tracking-tight text-fg">
              {c.articlesTitle}
            </h1>
            <p className="mt-1 text-xs text-muted-dim">{c.articlesSubtitle}</p>
          </div>
          <div role="tablist" className="mb-4 flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option.id ?? 'ALL'}
                type="button"
                role="tab"
                aria-selected={category === option.id}
                onClick={() => {
                  setCategory(option.id);
                  setPage(1);
                }}
                className={classNames(
                  'h-8 rounded-full border px-3.5 text-xs font-semibold transition-colors duration-150',
                  category === option.id
                    ? 'border-primary-line bg-primary-soft text-primary'
                    : 'border-line bg-surface text-muted-x hover:text-fg-2',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {articles.isPending ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((n) => (
                <Skeleton key={n} className="h-56 w-full rounded-2xl" />
              ))}
            </div>
          ) : articles.isError ? (
            <ErrorState
              message={errorText(copy, articles.error)}
              onRetry={() => void articles.refetch()}
            />
          ) : posts.length === 0 ? (
            <EmptyState icon={BookOpen} title={c.articlesEmpty} />
          ) : (
            <div className="grid items-start gap-4 md:grid-cols-2">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} actions={actions} />
              ))}
            </div>
          )}
          {articles.data && (
            <div className="pt-4">
              <Pagination
                page={page}
                total={articles.data.total}
                pageSize={LIST_PAGE_SIZE}
                onChange={(next) => {
                  setPage(next);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={articles.isFetching}
              />
            </div>
          )}
        </>
      )}
    </CommunityFrame>
  );
}
