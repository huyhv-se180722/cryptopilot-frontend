import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge, type Tone } from '../../../components/ui/Badge';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  OfficialCategory,
  PostStatus,
  PostSummary,
} from '../../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';

const categoryTone: Record<OfficialCategory, Tone> = {
  ANNOUNCEMENT: 'info',
  PLATFORM_UPDATE: 'warning',
  EDUCATION: 'success',
};
const statusTone: Record<PostStatus, Tone> = {
  PUBLISHED: 'success',
  HIDDEN: 'warning',
  DELETED: 'danger',
};

const actionClass =
  'inline-flex size-8 items-center justify-center rounded-lg text-muted-dim hover:bg-raised-hover hover:text-fg-2';

/**
 * The announcements of the administration console (UC-44), newest first:
 * title, category (BR-61), status, author, publication time and reactions.
 * A hidden announcement can be deleted but not edited (SRS 3.7.2).
 */
export function AnnouncementTable({
  items,
  onDelete,
}: {
  items: readonly PostSummary[];
  onDelete: (post: PostSummary) => void;
}) {
  const copy = useCopy();
  const a = copy.announcements;
  const c = copy.community;
  const columns: Column<PostSummary>[] = [
    {
      id: 'title',
      header: a.colTitle,
      render: (post) => (
        <span className="block max-w-[360px] whitespace-normal">
          <span className="line-clamp-1 font-medium text-fg">{post.title}</span>
          <span className="line-clamp-1 text-[11px] text-muted-dim">
            {post.excerpt}
          </span>
        </span>
      ),
    },
    {
      id: 'category',
      header: a.colCategory,
      render: (post) =>
        post.officialCategory ? (
          <Badge tone={categoryTone[post.officialCategory]}>
            {c[`category${post.officialCategory}`]}
          </Badge>
        ) : (
          '--'
        ),
    },
    {
      id: 'status',
      header: a.colStatus,
      render: (post) => (
        <Badge tone={statusTone[post.status]} withDot>
          {a[`status${post.status}`]}
        </Badge>
      ),
    },
    {
      id: 'author',
      header: a.colAuthor,
      render: (post) => post.author.displayName ?? c.noName,
    },
    {
      id: 'published',
      header: a.colPublished,
      render: (post) => (
        <time
          dateTime={post.createdAt}
          title={formatInstantUtc(post.createdAt)}
          className="font-mono"
        >
          {formatInstantLocal(post.createdAt)}
        </time>
      ),
    },
    {
      id: 'reactions',
      header: a.colReactions,
      numeric: true,
      render: (post) =>
        formatCopy(a.reactions, {
          likes: post.likeCount,
          comments: post.commentCount,
        }),
    },
    {
      id: 'action',
      header: a.colAction,
      render: (post) => (
        <span className="flex items-center gap-1">
          {post.status === 'PUBLISHED' ? (
            <Link
              to={'/admin/announcements/' + encodeURIComponent(post.id)}
              aria-label={formatCopy(a.editPost, { title: post.title })}
              title={a.edit}
              className={actionClass}
            >
              <Pencil size={14} aria-hidden="true" />
            </Link>
          ) : (
            <span
              className={actionClass + ' cursor-not-allowed opacity-40'}
              title={a.hiddenNoEdit}
              aria-label={a.hiddenNoEdit}
              role="img"
            >
              <Pencil size={14} aria-hidden="true" />
            </span>
          )}
          <button
            type="button"
            aria-label={formatCopy(a.deletePost, { title: post.title })}
            title={a.delete}
            onClick={() => onDelete(post)}
            className={actionClass + ' hover:text-negative'}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </span>
      ),
    },
  ];
  return (
    <Table
      caption={a.caption}
      columns={columns}
      rows={items}
      rowKey={(post) => post.id}
    />
  );
}
