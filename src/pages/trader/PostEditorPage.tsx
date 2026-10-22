import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Alert, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { PostForm } from '../../features/community/components/PostForm';
import { postPath } from '../../features/community/components/post-format';
import {
  usePost,
  useSavePost,
} from '../../features/community/hooks/use-community';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { useCopy } from '../../hooks/use-copy';
import { useFeature } from '../../hooks/use-entitlement';
import { useToast } from '../../hooks/use-toast';
import { errorText, messageText } from '../../i18n/messages';
import type { PostDetail, PostDraft } from '../../types/domain';

/**
 * SCR-26 Create / edit post (SRS 3.7.2): a new post at /community/new,
 * an own post at /community/:postId/edit. Publishing shows MSG33, saving
 * an edit MSG14; both open the post.
 */
export function PostEditorPage() {
  const { postId } = useParams();
  return postId ? <EditPost postId={postId} /> : <Editor />;
}

function EditPost({ postId }: { postId: string }) {
  const copy = useCopy();
  const post = usePost(postId);
  if (post.isPending)
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  if (post.isError)
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ErrorState
          message={errorText(copy, post.error)}
          onRetry={() => void post.refetch()}
        />
      </div>
    );
  if (!post.data.mine)
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Alert tone="warning" title={copy.community.form.notYours} />
      </div>
    );
  return <Editor post={post.data} />;
}

function Editor({ post }: { post?: PostDetail }) {
  const copy = useCopy();
  const c = copy.community;
  const navigate = useNavigate();
  const { show } = useToast();
  const save = useSavePost(post?.id);
  // Unknown entitlements leave the choice to the backend (MSG29).
  const videoAllowed = useFeature('VIDEO_POST') !== 'locked';
  const spot = useMarketPairs('spot');
  const futures = useMarketPairs('futures');
  const coins = useMemo(() => {
    const set = new Set<string>();
    for (const pair of [...(spot.data ?? []), ...(futures.data ?? [])])
      if (pair.baseAsset) set.add(pair.baseAsset);
    return [...set].sort();
  }, [spot.data, futures.data]);

  const back = post ? postPath(post.id) : '/community';

  async function submit(draft: PostDraft) {
    const result = await save.run(draft);
    if (result.status === 'success') {
      show({
        tone: 'success',
        message: messageText(copy, post ? 'MSG14' : 'MSG33'),
      });
      navigate(postPath(result.data.id), { replace: true });
      return null;
    }
    return result.status === 'error' ? result.error : null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        to={back}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted no-underline hover:text-fg-2"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        {post ? post.title : c.backToFeed}
      </Link>
      <PageHeader
        title={post ? c.form.editTitle : c.form.newTitle}
        description={c.form.subtitle}
      />
      <Card padding="lg">
        <PostForm
          {...(post ? { post } : {})}
          videoAllowed={videoAllowed}
          coinSuggestions={coins}
          onSubmit={submit}
          onCancel={() => navigate(back)}
        />
      </Card>
    </div>
  );
}
