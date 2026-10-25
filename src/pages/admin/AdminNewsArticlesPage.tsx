import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Newspaper } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { buttonClassName } from '../../components/ui/button-styles';
import { fieldControlClass } from '../../components/ui/field-styles';
import { NewsArticleTable } from '../../features/news-admin/components/NewsArticleTable';
import { SentimentCounts } from '../../features/news-admin/components/SentimentCounts';
import {
  ARTICLES_PAGE_SIZE,
  useAdminArticles,
  useArticleAction,
  useNewsSources,
  type ArticleAction,
} from '../../features/news-admin/hooks/use-news-admin';
import { newsAdminErrorText } from '../../features/news-admin/news-admin-errors';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import type { AdminNewsArticle, NewsArticleStatus } from '../../types/domain';
import { classNames } from '../../utils/class-names';

type Filter = NewsArticleStatus | 'ALL';
const STATUSES: readonly NewsArticleStatus[] = [
  'PENDING',
  'FAILED',
  'SUMMARIZED',
  'HIDDEN',
];

/**
 * The collected articles of the console (T-080b, D-124): every article,
 * hidden ones included, with what NSF-11 did with it, filtered by status
 * and source. Hide asks first, then takes the article out of the Traders'
 * feed (audited, BR-57); Show again puts it back; Summarize again waits
 * for the model and reports the answer or why it was refused. Above the
 * table, the 24-hour count of articles per sentiment (D-126). No SRS
 * screen: it extends SCR-41, and its layout follows SCR-36.
 */
export function AdminNewsArticlesPage() {
  const copy = useCopy();
  const n = copy.newsAdmin;
  const { show } = useToast();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sourceId, setSourceId] = useState('');
  const [page, setPage] = useState(1);
  const [hiding, setHiding] = useState<AdminNewsArticle | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const sources = useNewsSources();
  const list = useAdminArticles(
    filter === 'ALL' ? null : filter,
    sourceId || null,
    page,
  );
  const action = useArticleAction();
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE));
  // A change that empties the last page leaves the page past the end.
  if (list.data && !list.isPlaceholderData && page > pages) setPage(pages);

  async function run(kind: ArticleAction, article: AdminNewsArticle) {
    setBusy(article.id);
    const result = await action.run(kind, article.id);
    setBusy(null);
    if (result.status === 'error') {
      show({ tone: 'error', message: newsAdminErrorText(copy, result.error) });
      return;
    }
    if (result.status !== 'success') return;
    if (kind === 'hide') show({ tone: 'success', message: n.hidden });
    else if (kind === 'restore') show({ tone: 'success', message: n.restored });
    else if (result.data.summaryError)
      show({
        tone: 'info',
        message: formatCopy(n.summaryRefused, {
          reason: result.data.summaryError,
        }),
      });
    else show({ tone: 'success', message: n.summarized });
  }

  function onAction(kind: ArticleAction, article: AdminNewsArticle) {
    if (kind === 'hide') setHiding(article);
    else void run(kind, article);
  }

  const filtered = filter !== 'ALL' || sourceId !== '';
  const body = list.isPending ? (
    <div className="grid gap-2">
      {[0, 1, 2].map((k) => (
        <Skeleton key={k} className="h-14 w-full" />
      ))}
    </div>
  ) : list.isError ? (
    <ErrorState
      message={newsAdminErrorText(copy, list.error)}
      onRetry={() => void list.refetch()}
    />
  ) : list.data.items.length === 0 ? (
    <EmptyState
      icon={FileText}
      title={n.articlesEmpty}
      {...(filtered ? { description: n.articlesEmptyFiltered } : {})}
    />
  ) : (
    <>
      <NewsArticleTable
        articles={list.data.items}
        busy={busy}
        onAction={onAction}
      />
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-dim">
          <span>{formatCopy(n.pageOf, { page, pages })}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {n.previous}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {n.next}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <div className="w-full">
      <PageHeader
        size="sm"
        title={n.articlesTitle}
        description={n.articlesSubtitle}
        actions={
          <Link
            to="/admin/news-sources"
            className={buttonClassName('secondary', 'sm', 'no-underline')}
          >
            <Newspaper size={14} aria-hidden="true" />
            {n.sourcesLink}
          </Link>
        }
      />
      <SentimentCounts />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="overflow-x-auto">
          <SegmentedControl<Filter>
            label={n.statusFilter}
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: n.statusAll },
              ...STATUSES.map((s) => ({ value: s, label: n[`status${s}`] })),
            ]}
          />
        </div>
        <select
          aria-label={n.sourceFilter}
          value={sourceId}
          onChange={(e) => {
            setSourceId(e.target.value);
            setPage(1);
          }}
          className={classNames(fieldControlClass, 'h-9 w-48 py-0 text-xs')}
        >
          <option value="">{n.sourceAll}</option>
          {sources.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.sourceName}
            </option>
          ))}
        </select>
        {busy && action.pending && (
          <span className="text-[11px] text-muted-dim" role="status">
            {n.summarizing}
          </span>
        )}
      </div>
      {body}
      <Dialog
        open={hiding !== null}
        onOpenChange={(next) => !next && setHiding(null)}
        title={n.hideTitle}
        description={n.hideBody}
        size="sm"
        accent="negative"
        footer={
          <>
            <Button variant="secondary" onClick={() => setHiding(null)}>
              {n.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const article = hiding;
                setHiding(null);
                if (article) void run('hide', article);
              }}
            >
              {n.hide}
            </Button>
          </>
        }
      />
    </div>
  );
}
