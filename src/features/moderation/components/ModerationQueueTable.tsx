import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { ModerationQueueItem } from '../../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { postStatusTone, reasonTone } from './moderation-tones';

function When({ at }: { at: string }) {
  return (
    <time dateTime={at} title={formatInstantUtc(at)} className="font-mono">
      {formatInstantLocal(at)}
    </time>
  );
}

/**
 * The SCR-36 queue, from the Figma moderation table: one row per post
 * (SRS 3.11.3 groups reports by post) with its open reports counted,
 * their reasons, the first and last report and the post's status.
 */
export function ModerationQueueTable({
  items,
  onReview,
}: {
  items: readonly ModerationQueueItem[];
  onReview: (item: ModerationQueueItem) => void;
}) {
  const copy = useCopy();
  const m = copy.moderation;
  const reasons = copy.community.reportDialog;
  const columns: Column<ModerationQueueItem>[] = [
    {
      id: 'post',
      header: m.colPost,
      render: (item) => (
        <span className="block max-w-[340px] whitespace-normal">
          <span className="line-clamp-1 font-medium text-fg">
            {item.post.title}
          </span>
          <span className="line-clamp-1 text-[11px] text-muted-dim">
            {item.post.excerpt}
          </span>
        </span>
      ),
    },
    {
      id: 'author',
      header: m.colAuthor,
      render: (item) => item.post.author.displayName ?? copy.community.noName,
    },
    {
      id: 'reports',
      header: m.colReports,
      numeric: true,
      render: (item) => item.reportCount,
    },
    {
      id: 'reasons',
      header: m.colReasons,
      render: (item) => (
        <span className="flex flex-wrap gap-1">
          {item.reasons.map((reason) => (
            <Badge key={reason} tone={reasonTone[reason]}>
              {reasons[reason]}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      id: 'first',
      header: m.colFirst,
      render: (item) => <When at={item.firstReportedAt} />,
    },
    {
      id: 'last',
      header: m.colLast,
      render: (item) => <When at={item.lastReportedAt} />,
    },
    {
      id: 'status',
      header: m.colStatus,
      render: (item) => (
        <Badge tone={postStatusTone[item.post.status]} withDot>
          {m[`status${item.post.status}`]}
        </Badge>
      ),
    },
    {
      id: 'action',
      header: m.colAction,
      render: (item) => (
        <Button
          variant="secondary"
          size="sm"
          aria-label={formatCopy(m.reviewPost, { title: item.post.title })}
          onClick={(event) => {
            event.stopPropagation();
            onReview(item);
          }}
        >
          {m.review}
        </Button>
      ),
    },
  ];
  return (
    <Table
      caption={m.queueCaption}
      columns={columns}
      rows={items}
      rowKey={(item) => item.post.id}
      onRowClick={onReview}
    />
  );
}
