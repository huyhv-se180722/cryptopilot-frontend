import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ThumbsUp } from 'lucide-react';
import { EmptyState, ErrorState } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import {
  fieldControlClass,
  fieldErrorClass,
} from '../../../components/ui/field-styles';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import type { PostComment } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { formatInstantUtc } from '../../../utils/instant-format';
import {
  useCommentActions,
  useComments,
  useReaction,
} from '../hooks/use-community';
import { ConfirmDeleteDialog } from './CommunityDialogs';
import { memberPath, postAge, wasEdited } from './post-format';
import { AuthorAvatar } from './PostParts';

const MAX = 2_000;

/**
 * SCR-25 comments (SRS 3.7.3, UC-30, UC-31): threads oldest first with
 * replies one level in, like (BR-45), reply, edit and delete of own
 * comments; a deleted comment with replies reads "Comment deleted".
 */
export function CommentSection({
  postId,
  canWrite,
  onGuest,
}: {
  postId: string;
  /** A Trader writes; a Guest is asked to sign in (D-99). */
  canWrite: boolean;
  onGuest: () => void;
}) {
  const copy = useCopy();
  const t = copy.community.comment;
  const { show } = useToast();
  const comments = useComments(postId);
  const { add, edit, remove } = useCommentActions(postId);
  const reaction = useReaction();
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [deleting, setDeleting] = useState<PostComment | null>(null);

  const threads = comments.data?.pages.flatMap((p) => p.items) ?? [];

  async function like(comment: PostComment) {
    if (!canWrite) return onGuest();
    const result = await reaction.run(
      { kind: 'comment', id: comment.id, action: 'like' },
      !comment.likedByMe,
    );
    if (result.status === 'error')
      show({ tone: 'error', message: errorText(copy, result.error) });
  }

  async function confirmDelete() {
    if (!deleting) return;
    const result = await remove.run(deleting.id);
    setDeleting(null);
    if (result.status === 'error')
      show({ tone: 'error', message: errorText(copy, result.error) });
  }

  const item = (comment: PostComment, nested: boolean) => (
    <CommentItem
      key={comment.id}
      comment={comment}
      nested={nested}
      onLike={() => void like(comment)}
      onReply={() => (canWrite ? setReplyTo(comment) : onGuest())}
      onDelete={() => setDeleting(comment)}
      onEdit={async (content) => {
        const result = await edit.run(comment.id, content);
        return result.status === 'error' ? result.error : null;
      }}
      likePending={reaction.pending}
    />
  );

  return (
    <section id="comments" aria-labelledby="comments-title" className="mt-6">
      <h2
        id="comments-title"
        className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg"
      >
        <MessageSquare size={14} aria-hidden="true" className="text-muted" />
        {copy.community.comments}
      </h2>
      {canWrite ? (
        <CommentBox
          key={replyTo?.id ?? 'new'}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={async (content) => {
            const result = await add.run(content, replyTo?.id ?? null);
            if (result.status === 'success') {
              setReplyTo(null);
              return null;
            }
            return result.status === 'error' ? result.error : null;
          }}
        />
      ) : (
        <button
          type="button"
          onClick={onGuest}
          className={classNames(
            fieldControlClass,
            'text-left text-muted-x hover:border-primary-line',
          )}
        >
          {t.placeholder}
        </button>
      )}

      <div className="mt-4">
        {comments.isPending ? (
          <div className="grid gap-3">
            {[0, 1].map((n) => (
              <Skeleton key={n} className="h-14 w-full" />
            ))}
          </div>
        ) : comments.isError ? (
          <ErrorState
            message={errorText(copy, comments.error)}
            onRetry={() => void comments.refetch()}
          />
        ) : threads.length === 0 ? (
          <EmptyState icon={MessageSquare} title={t.empty} />
        ) : (
          <ol className="grid gap-4">
            {threads.map((thread) => (
              <li key={thread.id}>
                {item(thread, false)}
                {thread.replies.length > 0 && (
                  <ol className="mt-3 ml-5 grid gap-3 border-l border-line pl-4 sm:ml-10">
                    {thread.replies.map((reply) => (
                      <li key={reply.id}>{item(reply, true)}</li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        )}
        {comments.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              disabled={comments.isFetchingNextPage}
              onClick={() => void comments.fetchNextPage()}
            >
              {t.loadMore}
            </Button>
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        open={deleting !== null}
        title={t.deleteTitle}
        body={t.deleteBody}
        pending={remove.pending}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

function CommentText({
  value,
  onChange,
  placeholder,
  label,
  error,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  error: string | null;
  autoFocus?: boolean;
}) {
  const t = useCopy().community.comment;
  const id = useId();
  return (
    <div>
      <textarea
        id={id}
        rows={2}
        value={value}
        aria-label={label}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-invalid={error !== null}
        aria-describedby={id + '-count'}
        onChange={(e) => onChange(e.target.value)}
        className={classNames(fieldControlClass, 'min-h-16 resize-y')}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className={classNames(fieldErrorClass, 'mt-0')} role="alert">
          {error}
        </span>
        <span
          id={id + '-count'}
          className={classNames(
            'font-mono text-[11px]',
            value.length > MAX ? 'text-negative' : 'text-muted-x',
          )}
        >
          {formatCopy(t.counter, { n: value.length, max: MAX })}
        </span>
      </div>
    </div>
  );
}

function lengthError(text: string, message: string) {
  const length = text.trim().length;
  return length < 1 || length > MAX ? message : null;
}

function CommentBox({
  replyTo,
  onCancelReply,
  onSend,
}: {
  replyTo: PostComment | null;
  onCancelReply: () => void;
  onSend: (content: string) => Promise<unknown>;
}) {
  const copy = useCopy();
  const t = copy.community.comment;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = lengthError(text, t.length);
    setError(invalid);
    if (invalid) return;
    setPending(true);
    const refusal = await onSend(text.trim());
    setPending(false);
    if (refusal) setError(errorText(copy, refusal));
    else setText('');
  }

  const name = replyTo?.author?.displayName ?? copy.community.noName;
  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="grid gap-2">
      {replyTo && (
        <div className="flex items-center justify-between rounded-lg bg-raised px-3 py-1.5 text-[11px] text-muted">
          {formatCopy(t.replyingTo, { name })}
          <button
            type="button"
            onClick={onCancelReply}
            className="font-medium text-primary hover:underline"
          >
            {t.cancelReply}
          </button>
        </div>
      )}
      <CommentText
        value={text}
        onChange={setText}
        label={t.label}
        placeholder={replyTo ? t.replyPlaceholder : t.placeholder}
        error={error}
        autoFocus={replyTo !== null}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {replyTo ? t.sendReply : t.send}
        </Button>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  nested,
  onLike,
  onReply,
  onDelete,
  onEdit,
  likePending,
}: {
  comment: PostComment;
  nested: boolean;
  onLike: () => void;
  onReply: () => void;
  onDelete: () => void;
  onEdit: (content: string) => Promise<unknown>;
  likePending: boolean;
}) {
  const copy = useCopy();
  const c = copy.community;
  const t = c.comment;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.content ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (comment.deleted || !comment.author)
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted-x italic">
        {t.deleted}
      </p>
    );

  async function save() {
    const invalid = lengthError(text, t.length);
    setError(invalid);
    if (invalid) return;
    setPending(true);
    const refusal = await onEdit(text.trim());
    setPending(false);
    if (refusal) setError(errorText(copy, refusal));
    else setEditing(false);
  }

  const author = comment.author;
  return (
    <article className="flex gap-2.5">
      <AuthorAvatar author={author} size={nested ? 24 : 30} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link
            to={memberPath(author.userId)}
            className="text-xs font-semibold text-fg-2 no-underline hover:text-primary"
          >
            {author.displayName ?? c.noName}
          </Link>
          <time
            dateTime={comment.createdAt}
            title={formatInstantUtc(comment.createdAt)}
            className="text-[11px] text-muted-x"
          >
            {postAge(copy, comment.createdAt)}
            {wasEdited(comment.createdAt, comment.updatedAt) &&
              ' · ' + c.edited}
          </time>
        </div>
        {editing ? (
          <div className="mt-1.5 grid gap-2">
            <CommentText
              value={text}
              onChange={setText}
              label={t.label}
              placeholder={t.placeholder}
              error={error}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setText(comment.content ?? '');
                  setError(null);
                }}
              >
                {copy.common.cancel}
              </Button>
              <Button size="sm" disabled={pending} onClick={() => void save()}>
                {t.save}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-xs leading-relaxed break-words whitespace-pre-line text-fg-2">
            {comment.content}
          </p>
        )}
        {!editing && (
          <div className="mt-1.5 flex items-center gap-3 text-[11px]">
            <button
              type="button"
              aria-pressed={comment.likedByMe}
              aria-label={comment.likedByMe ? c.unlike : c.like}
              disabled={likePending}
              onClick={onLike}
              className={classNames(
                'inline-flex items-center gap-1 pointer-coarse:min-h-10',
                comment.likedByMe
                  ? 'text-positive'
                  : 'text-muted-x hover:text-positive',
              )}
            >
              <ThumbsUp
                size={11}
                aria-hidden="true"
                fill={comment.likedByMe ? 'currentColor' : 'none'}
              />
              <span className="font-mono">{comment.likeCount}</span>
            </button>
            <button
              type="button"
              onClick={onReply}
              className="font-medium text-muted-x hover:text-primary pointer-coarse:min-h-10"
            >
              {t.reply}
            </button>
            {comment.mine && (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="font-medium text-muted-x hover:text-fg-2 pointer-coarse:min-h-10"
                >
                  {t.edit}
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="font-medium text-muted-x hover:text-negative pointer-coarse:min-h-10"
                >
                  {t.delete}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
