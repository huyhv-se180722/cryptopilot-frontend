import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { AdminNewsArticle } from '../../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import type { ArticleAction } from '../hooks/use-news-admin';
import { articleTone } from './news-admin-format';

const actionClass =
  'inline-flex size-8 items-center justify-center rounded-lg text-muted-dim hover:bg-raised-hover hover:text-fg-2 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * The collected articles of the console (T-080b, D-124): the headline as
 * collected and as translated, the source, publish time, status with the
 * attempts and last error of NSF-11, the AI summary, and per article hide
 * or show again and summarize again.
 */
export function NewsArticleTable({
  articles,
  busy,
  onAction,
}: {
  articles: readonly AdminNewsArticle[];
  /** The article an action is running on; its buttons wait. */
  busy: string | null;
  onAction: (action: ArticleAction, article: AdminNewsArticle) => void;
}) {
  const n = useCopy().newsAdmin;
  const columns: Column<AdminNewsArticle>[] = [
    {
      id: 'article',
      header: n.colArticle,
      render: (a) => (
        <span className="block max-w-[360px] whitespace-normal">
          <a
            href={a.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 font-medium text-fg no-underline hover:text-primary"
          >
            {a.aiTitle ?? a.title}
          </a>
          {a.aiTitle && (
            <span className="line-clamp-1 text-[11px] text-muted-dim">
              {a.title}
            </span>
          )}
          <span className="text-[11px] text-muted-dim">{a.source}</span>
        </span>
      ),
    },
    {
      id: 'published',
      header: n.colPublished,
      render: (a) => (
        <time
          dateTime={a.publishedAt}
          title={formatInstantUtc(a.publishedAt)}
          className="font-mono"
        >
          {formatInstantLocal(a.publishedAt)}
        </time>
      ),
    },
    {
      id: 'status',
      header: n.colStatus,
      render: (a) => (
        <span className="flex max-w-[220px] flex-col gap-1 whitespace-normal">
          <Badge tone={articleTone[a.status]} withDot>
            {n[`status${a.status}`]}
          </Badge>
          {a.summaryAttempts > 0 && (
            <span className="text-[11px] text-muted-dim">
              {formatCopy(n.attempts, { n: a.summaryAttempts })}
            </span>
          )}
          {a.summaryError && (
            <span className="line-clamp-2 text-[11px] text-negative">
              {a.summaryError}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'summary',
      header: n.colSummary,
      render: (a) => (
        <span className="line-clamp-3 block max-w-[320px] text-[11px] whitespace-normal text-fg-2">
          {a.aiSummary ?? <span className="text-muted-dim">{n.noSummary}</span>}
        </span>
      ),
    },
    {
      id: 'actions',
      header: n.colActions,
      render: (a) => {
        const title = a.aiTitle ?? a.title;
        const hidden = a.status === 'HIDDEN';
        return (
          <span className="flex items-center gap-1">
            <button
              type="button"
              disabled={busy !== null}
              aria-label={formatCopy(n.summarizeFor, { title })}
              title={n.summarize}
              onClick={() => onAction('summarize', a)}
              className={actionClass + ' hover:text-primary'}
            >
              <Sparkles size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={busy !== null}
              aria-label={formatCopy(hidden ? n.restoreFor : n.hideFor, {
                title,
              })}
              title={hidden ? n.restore : n.hide}
              onClick={() => onAction(hidden ? 'restore' : 'hide', a)}
              className={actionClass}
            >
              {hidden ? (
                <Eye size={14} aria-hidden="true" />
              ) : (
                <EyeOff size={14} aria-hidden="true" />
              )}
            </button>
          </span>
        );
      },
    },
  ];
  return (
    <Table
      caption={n.articlesCaption}
      columns={columns}
      rows={articles}
      rowKey={(a) => a.id}
    />
  );
}
