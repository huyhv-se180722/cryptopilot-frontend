import { useMemo, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Alert, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  useAnnouncement,
  useSaveAnnouncement,
} from '../../features/announcements/hooks/use-announcements';
import { PostForm } from '../../features/community/components/PostForm';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { errorText, messageText } from '../../i18n/messages';
import type { PostDetail, PostDraft } from '../../types/domain';

const LIST = '/admin/announcements';

/**
 * New or edited announcement (SRS 3.7.2, UC-44): the SCR-26 form with the
 * Official category (BR-61). Publishing shows MSG33, saving MSG14; both
 * return to the list. A hidden announcement cannot be edited.
 */
export function AdminAnnouncementEditorPage() {
  const { postId } = useParams();
  return postId ? <EditAnnouncement postId={postId} /> : <Editor />;
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl">{children}</div>;
}

function EditAnnouncement({ postId }: { postId: string }) {
  const copy = useCopy();
  const a = copy.announcements;
  const post = useAnnouncement(postId);
  if (post.isPending)
    return (
      <Frame>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </Frame>
    );
  if (post.isError)
    return (
      <Frame>
        <ErrorState
          message={errorText(copy, post.error)}
          onRetry={() => void post.refetch()}
        />
      </Frame>
    );
  if (!post.data.official || post.data.status !== 'PUBLISHED')
    return (
      <Frame>
        <Alert
          tone="warning"
          title={post.data.official ? a.hiddenNoEdit : a.notOfficial}
        />
      </Frame>
    );
  return <Editor post={post.data} />;
}

function Editor({ post }: { post?: PostDetail }) {
  const copy = useCopy();
  const a = copy.announcements;
  const navigate = useNavigate();
  const { show } = useToast();
  const save = useSaveAnnouncement(post?.id);
  const spot = useMarketPairs('spot');
  const futures = useMarketPairs('futures');
  const coins = useMemo(() => {
    const set = new Set<string>();
    for (const pair of [...(spot.data ?? []), ...(futures.data ?? [])])
      if (pair.baseAsset) set.add(pair.baseAsset);
    return [...set].sort();
  }, [spot.data, futures.data]);

  async function submit(draft: PostDraft) {
    const result = await save.run({
      ...draft,
      officialCategory: draft.officialCategory ?? 'ANNOUNCEMENT',
    });
    if (result.status === 'success') {
      show({
        tone: 'success',
        message: messageText(copy, post ? 'MSG14' : 'MSG33'),
      });
      navigate(LIST);
      return null;
    }
    return result.status === 'error' ? result.error : null;
  }

  return (
    <Frame>
      <Link
        to={LIST}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted no-underline hover:text-fg-2"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        {a.back}
      </Link>
      <PageHeader
        title={post ? a.editTitle : a.newTitle}
        description={a.formSubtitle}
      />
      <Card padding="lg">
        <PostForm
          {...(post ? { post } : {})}
          official
          videoAllowed={false}
          coinSuggestions={coins}
          onSubmit={submit}
          onCancel={() => navigate(LIST)}
        />
      </Card>
    </Frame>
  );
}
