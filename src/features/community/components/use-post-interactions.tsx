import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/use-auth';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { errorText, messageText } from '../../../i18n/messages';
import type { PostSummary } from '../../../types/domain';
import {
  useCommunityRole,
  useDeletePost,
  useReaction,
  useReportPost,
} from '../hooks/use-community';
import {
  ConfirmDeleteDialog,
  JoinDialog,
  ReportDialog,
} from './CommunityDialogs';
import { postPath } from './post-format';
import { PostMenu } from './PostMenu';

/**
 * What a reader can do with a post wherever it shows (feed, detail,
 * member page): react, report, edit, delete, copy its link. A Guest is
 * asked to sign in instead (D-99). Returns the handlers and the dialogs
 * to render once.
 */
export function usePostInteractions(onDeleted?: () => void) {
  const copy = useCopy();
  const c = copy.community;
  const { show } = useToast();
  const navigate = useNavigate();
  const role = useCommunityRole();
  const me = useAuth().session?.user.id;
  const reaction = useReaction();
  const report = useReportPost();
  const removal = useDeletePost();
  const [joining, setJoining] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const trader = role === 'trader';

  const askToJoin = useCallback(() => setJoining(true), []);

  const react = useCallback(
    async (postId: string, action: 'like' | 'save', active: boolean) => {
      if (!trader) return askToJoin();
      const result = await reaction.run(
        { kind: 'post', id: postId, action },
        active,
      );
      if (result.status === 'error')
        show({ tone: 'error', message: errorText(copy, result.error) });
    },
    [trader, askToJoin, reaction, show, copy],
  );

  const isMine = useCallback(
    (post: Pick<PostSummary, 'author'> & { mine?: boolean }) =>
      post.mine ?? (me !== undefined && post.author.userId === me),
    [me],
  );

  const menu = (
    post: Pick<PostSummary, 'id' | 'author'> & { mine?: boolean },
  ) => (
    <PostMenu
      mine={trader && isMine(post)}
      onEdit={() => navigate(postPath(post.id) + '/edit')}
      onDelete={() => setDeleting(post.id)}
      onReport={() => (trader ? setReporting(post.id) : askToJoin())}
      onCopyLink={() => {
        const url = new URL(postPath(post.id), window.location.origin).href;
        void navigator.clipboard?.writeText(url).then(
          () => show({ tone: 'success', message: c.linkCopied }),
          () => undefined,
        );
      }}
    />
  );

  async function confirmDelete() {
    if (!deleting) return;
    const result = await removal.run(deleting);
    setDeleting(null);
    if (result.status === 'success') {
      show({ tone: 'success', message: c.deleted });
      onDeleted?.();
    } else if (result.status === 'error')
      show({ tone: 'error', message: errorText(copy, result.error) });
  }

  const dialogs = (
    <>
      <JoinDialog open={joining} onClose={() => setJoining(false)} />
      <ReportDialog
        open={reporting !== null}
        onClose={() => setReporting(null)}
        onSubmit={async (value) => {
          if (!reporting) return null;
          const result = await report.run(reporting, value);
          if (result.status === 'success') {
            setReporting(null);
            show({ tone: 'success', message: messageText(copy, 'MSG34') });
            return null;
          }
          return result.status === 'error' ? result.error : null;
        }}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        title={c.deleteTitle}
        body={c.deleteBody}
        pending={removal.pending}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );

  return {
    trader,
    role,
    react,
    menu,
    askToJoin,
    dialogs,
    reacting: reaction.pending,
  };
}
