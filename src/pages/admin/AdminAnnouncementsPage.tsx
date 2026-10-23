import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Plus } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { buttonClassName } from '../../components/ui/button-styles';
import { AnnouncementTable } from '../../features/announcements/components/AnnouncementTable';
import {
  ANNOUNCEMENTS_PAGE_SIZE,
  useAnnouncements,
  useDeleteAnnouncement,
} from '../../features/announcements/hooks/use-announcements';
import { ConfirmDeleteDialog } from '../../features/community/components/CommunityDialogs';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import type { OfficialCategory, PostSummary } from '../../types/domain';

type Filter = OfficialCategory | 'ALL';

/**
 * Official announcements of the administration console (SRS 3.7.2,
 * UC-44): published and hidden ones, newest first, filtered by category
 * (BR-61); New announcement and Edit open the SCR-26 form, Delete asks
 * first (BR-47). No Figma frame: the layout follows SCR-36.
 */
export function AdminAnnouncementsPage() {
  const copy = useCopy();
  const a = copy.announcements;
  const { show } = useToast();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<PostSummary | null>(null);
  const list = useAnnouncements(filter === 'ALL' ? null : filter, page);
  const removal = useDeleteAnnouncement();
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / ANNOUNCEMENTS_PAGE_SIZE));
  // Deleting the last row of the last page leaves the page past the end:
  // show the new last page rather than an empty list without a pager.
  if (list.data && !list.isPlaceholderData && page > pages) setPage(pages);

  async function confirmDelete() {
    if (!deleting) return;
    const result = await removal.run(deleting.id);
    setDeleting(null);
    if (result.status === 'success')
      show({ tone: 'success', message: a.deleted });
    else if (result.status === 'error')
      show({ tone: 'error', message: errorText(copy, result.error) });
  }

  const body = list.isPending ? (
    <div className="grid gap-2">
      {[0, 1, 2].map((k) => (
        <Skeleton key={k} className="h-12 w-full" />
      ))}
    </div>
  ) : list.isError ? (
    <ErrorState
      message={errorText(copy, list.error)}
      onRetry={() => void list.refetch()}
    />
  ) : list.data.items.length === 0 ? (
    <EmptyState
      icon={Megaphone}
      title={filter === 'ALL' ? a.empty : a.emptyFiltered}
      description={a.emptyHint}
    />
  ) : (
    <>
      <AnnouncementTable items={list.data.items} onDelete={setDeleting} />
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-dim">
          <span>{formatCopy(a.pageOf, { page, pages })}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {a.previous}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {a.next}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <div className="w-full">
      <PageHeader
        size="sm"
        title={a.title}
        description={a.subtitle}
        actions={
          <Link
            to="/admin/announcements/new"
            className={buttonClassName('primary', 'sm', 'no-underline')}
          >
            <Plus size={14} aria-hidden="true" />
            {a.newAnnouncement}
          </Link>
        }
      />
      <div className="mb-3 overflow-x-auto">
        <SegmentedControl<Filter>
          label={a.filterLabel}
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setPage(1);
          }}
          options={[
            { value: 'ALL', label: a.all },
            {
              value: 'ANNOUNCEMENT',
              label: copy.community.categoryANNOUNCEMENT,
            },
            {
              value: 'PLATFORM_UPDATE',
              label: copy.community.categoryPLATFORM_UPDATE,
            },
            { value: 'EDUCATION', label: copy.community.categoryEDUCATION },
          ]}
        />
      </div>
      {body}
      <ConfirmDeleteDialog
        open={deleting !== null}
        title={a.deleteTitle}
        body={a.deleteBody}
        pending={removal.pending}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
