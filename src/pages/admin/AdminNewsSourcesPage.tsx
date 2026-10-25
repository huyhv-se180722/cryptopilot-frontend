import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Newspaper, Plus } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { buttonClassName } from '../../components/ui/button-styles';
import { CrawlLogDialog } from '../../features/news-admin/components/CrawlLogDialog';
import { CrawlNowDialog } from '../../features/news-admin/components/CrawlNowDialog';
import { NewsSourceDialog } from '../../features/news-admin/components/NewsSourceDialog';
import { NewsSourceTable } from '../../features/news-admin/components/NewsSourceTable';
import {
  useCrawlNow,
  useDeleteSource,
  useNewsSources,
} from '../../features/news-admin/hooks/use-news-admin';
import { newsAdminErrorText } from '../../features/news-admin/news-admin-errors';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import { messageText } from '../../i18n/messages';
import type { NewsSource } from '../../types/domain';

type Editing = { source: NewsSource | null } | null;

/**
 * SCR-41 News Sources (SRS 3.11.6, UC-49): the RSS sources with their
 * interval, state, last crawl and next due time; add, edit and delete
 * (audited by the backend, BR-57), the crawl log of each, and a crawl on
 * demand after a confirmation that shows the source's own schedule
 * (T-080b, D-124). No Figma frame: the layout follows SCR-36.
 */
export function AdminNewsSourcesPage() {
  const copy = useCopy();
  const n = copy.newsAdmin;
  const { show } = useToast();
  const sources = useNewsSources();
  const crawl = useCrawlNow();
  const removal = useDeleteSource();
  const [editing, setEditing] = useState<Editing>(null);
  const [crawling, setCrawling] = useState<NewsSource | null>(null);
  const [logs, setLogs] = useState<NewsSource | null>(null);
  const [deleting, setDeleting] = useState<NewsSource | null>(null);

  async function confirmCrawl() {
    if (!crawling) return;
    const result = await crawl.run(crawling.id);
    setCrawling(null);
    if (result.status === 'success') {
      const log = result.data;
      if (log.status === 'FAILED')
        show({
          tone: 'error',
          message: formatCopy(n.crawlFailed, { error: log.errorMessage ?? '' }),
        });
      else
        show({
          tone: log.status === 'PARTIAL' ? 'info' : 'success',
          message: formatCopy(n.crawlDone, {
            inserted: log.articlesInserted ?? 0,
            found: log.articlesFound ?? 0,
          }),
        });
    } else if (result.status === 'error')
      show({ tone: 'error', message: newsAdminErrorText(copy, result.error) });
  }

  async function confirmDelete() {
    if (!deleting) return;
    const result = await removal.run(deleting.id);
    setDeleting(null);
    if (result.status === 'success')
      show({ tone: 'success', message: n.deleted });
    else if (result.status === 'error')
      show({ tone: 'error', message: newsAdminErrorText(copy, result.error) });
  }

  const body = sources.isPending ? (
    <div className="grid gap-2">
      {[0, 1, 2].map((k) => (
        <Skeleton key={k} className="h-12 w-full" />
      ))}
    </div>
  ) : sources.isError ? (
    <ErrorState
      message={newsAdminErrorText(copy, sources.error)}
      onRetry={() => void sources.refetch()}
    />
  ) : sources.data.length === 0 ? (
    <EmptyState icon={Newspaper} title={n.empty} description={n.emptyHint} />
  ) : (
    <NewsSourceTable
      sources={sources.data}
      onCrawl={setCrawling}
      onLogs={setLogs}
      onEdit={(source) => setEditing({ source })}
      onDelete={setDeleting}
    />
  );

  return (
    <div className="w-full">
      <PageHeader
        size="sm"
        title={n.title}
        description={n.subtitle}
        actions={
          <>
            <Link
              to="/admin/news-articles"
              className={buttonClassName('secondary', 'sm', 'no-underline')}
            >
              <FileText size={14} aria-hidden="true" />
              {n.articlesLink}
            </Link>
            <Button size="sm" onClick={() => setEditing({ source: null })}>
              <Plus size={14} aria-hidden="true" />
              {n.addSource}
            </Button>
          </>
        }
      />
      {body}
      <NewsSourceDialog
        open={editing !== null}
        source={editing?.source ?? null}
        onClose={() => setEditing(null)}
        onSaved={(created) => {
          setEditing(null);
          show({
            tone: 'success',
            message: created ? n.created : messageText(copy, 'MSG14'),
          });
        }}
      />
      <CrawlNowDialog
        source={crawling}
        pending={crawl.pending}
        onClose={() => setCrawling(null)}
        onConfirm={() => void confirmCrawl()}
      />
      <CrawlLogDialog source={logs} onClose={() => setLogs(null)} />
      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title={n.deleteTitle}
        description={n.deleteBody}
        size="sm"
        accent="negative"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {n.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={removal.pending}
              onClick={() => void confirmDelete()}
            >
              {n.deleteConfirm}
            </Button>
          </>
        }
      />
    </div>
  );
}
