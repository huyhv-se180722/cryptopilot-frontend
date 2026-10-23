import { useId, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  EyeOff,
  RotateCcw,
  ShieldAlert,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Alert, ErrorState } from '../../../components/feedback/States';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Skeleton } from '../../../components/ui/Skeleton';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
} from '../../../components/ui/field-styles';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type { ModerationAction, ModerationCase } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import {
  useModerationCase,
  useModerationDecision,
  useRestorePost,
} from '../hooks/use-moderation';
import { postStatusTone, reasonTone } from './moderation-tones';

const NOTE_MAX = 500;
const ACTIONS: readonly {
  action: ModerationAction;
  icon: LucideIcon;
  variant: 'secondary' | 'danger';
}[] = [
  { action: 'DISMISS', icon: CheckCircle2, variant: 'secondary' },
  { action: 'WARN_USER', icon: ShieldAlert, variant: 'secondary' },
  { action: 'HIDE_POST', icon: EyeOff, variant: 'secondary' },
  { action: 'REMOVE_POST', icon: Trash2, variant: 'danger' },
  { action: 'BAN_USER', icon: Ban, variant: 'danger' },
];
/** Decisions that cannot be undone from this screen ask first (Figma ConfirmDialog). */
const CONFIRMED: readonly ModerationAction[] = ['REMOVE_POST', 'BAN_USER'];

/**
 * SCR-36 review of one reported post (SRS 3.11.3, UC-43): the post
 * whatever its status, its open reports, an optional note for the audit
 * log (BR-57) and one decision for all reports. A hidden post can be
 * restored. A decision the server no longer accepts (already decided)
 * closes the review and reads the queue again.
 */
export function ModerationCaseDialog({
  postId,
  onClose,
}: {
  /** null = closed. */
  postId: string | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  return (
    <Dialog
      open={postId !== null}
      onOpenChange={(open) => !open && onClose()}
      title={copy.moderation.caseTitle}
      description={copy.moderation.caseHint}
      size="lg"
    >
      {postId && <CaseBody key={postId} postId={postId} onClose={onClose} />}
    </Dialog>
  );
}

function CaseBody({
  postId,
  onClose,
}: {
  postId: string;
  onClose: () => void;
}) {
  const copy = useCopy();
  const m = copy.moderation;
  const { show } = useToast();
  const opened = useModerationCase(postId);
  const decision = useModerationDecision();
  const restore = useRestorePost();
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ModerationAction | null>(null);
  const noteId = useId();
  const tooLong = note.trim().length > NOTE_MAX;

  async function decide(action: ModerationAction) {
    if (tooLong) return;
    setConfirming(null);
    setNotice(null);
    const text = note.trim();
    const result = await decision.run(
      postId,
      action,
      text === '' ? null : text,
    );
    if (result.status === 'success') {
      const done =
        action === 'BAN_USER' && !result.data.authorBanned
          ? m.doneBanBefore
          : m[`done${action}`];
      show({ tone: 'success', message: done });
      onClose();
      return;
    }
    if (result.status !== 'error') return;
    const problem = problemOf(result.error);
    if (problem?.code === 'ACCOUNT_STATUS_TRANSITION_INVALID')
      setNotice(m.cannotBanAdmin);
    else if (problem?.status === 404) {
      show({ tone: 'info', message: m.alreadyDecided });
      onClose();
    } else setNotice(errorText(copy, result.error));
  }

  async function restorePost() {
    setNotice(null);
    const result = await restore.run(postId);
    if (result.status === 'success') {
      show({ tone: 'success', message: m.restored });
      void opened.refetch();
    } else if (result.status === 'error')
      setNotice(errorText(copy, result.error));
  }

  if (opened.isPending)
    return (
      <div className="grid gap-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  if (opened.isError) {
    const gone = problemOf(opened.error)?.status === 404;
    return gone ? (
      <Alert tone="info" title={m.alreadyDecided} />
    ) : (
      <ErrorState
        message={errorText(copy, opened.error)}
        onRetry={() => void opened.refetch()}
      />
    );
  }

  const busy = decision.pending || restore.pending;
  const authorName =
    opened.data.post.author.displayName ?? copy.community.noName;
  return (
    <div className="grid gap-5">
      {notice && <Alert tone="danger" title={notice} />}
      <PostPreview data={opened.data} />
      <ReportList data={opened.data} />

      {opened.data.post.status === 'HIDDEN' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-line bg-warning-soft px-4 py-3">
          <p className="text-xs text-fg-2">{m.restoreHint}</p>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void restorePost()}
          >
            <RotateCcw size={12} aria-hidden="true" />
            {m.restore}
          </Button>
        </div>
      )}

      <div>
        <label htmlFor={noteId} className={fieldLabelClass}>
          {m.note}
        </label>
        <textarea
          id={noteId}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={tooLong || undefined}
          aria-describedby={noteId + '-hint'}
          className={classNames(fieldControlClass, 'resize-y')}
        />
        <div
          id={noteId + '-hint'}
          className="mt-1 flex justify-between gap-2 text-[11px]"
        >
          <span
            className={classNames(
              tooLong ? fieldErrorClass : fieldHintClass,
              'mt-0',
            )}
          >
            {tooLong ? m.noteTooLong : m.noteHint}
          </span>
          <span
            className={classNames(
              'font-mono',
              tooLong ? 'text-negative' : 'text-muted-x',
            )}
          >
            {note.trim().length}/{NOTE_MAX}
          </span>
        </div>
      </div>

      <fieldset>
        <legend className={fieldLabelClass}>{m.decisions}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACTIONS.map(({ action, icon: Icon, variant }) => (
            <button
              key={action}
              type="button"
              disabled={busy || tooLong}
              onClick={() =>
                CONFIRMED.includes(action)
                  ? setConfirming(action)
                  : void decide(action)
              }
              className={classNames(
                'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50',
                variant === 'danger'
                  ? 'border-negative-line bg-negative-soft/40 hover:enabled:bg-negative-soft'
                  : 'border-line bg-raised hover:enabled:border-line-strong',
              )}
            >
              <Icon
                size={14}
                aria-hidden="true"
                className={classNames(
                  'mt-0.5 shrink-0',
                  variant === 'danger' ? 'text-negative' : 'text-muted',
                )}
              />
              <span>
                <span
                  className={classNames(
                    'block text-xs font-semibold',
                    variant === 'danger' ? 'text-negative' : 'text-fg',
                  )}
                >
                  {m[action]}
                </span>
                <span className="block text-[11px] text-muted-dim">
                  {m[`${action}Hint`]}
                </span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={
          confirming === 'BAN_USER'
            ? formatCopy(m.confirmBAN_USER, { name: authorName })
            : m.confirmREMOVE_POST
        }
        description={
          confirming === 'BAN_USER'
            ? m.confirmBAN_USERBody
            : m.confirmREMOVE_POSTBody
        }
        size="sm"
        accent="negative"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              {copy.common.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => confirming && void decide(confirming)}
            >
              {confirming ? m[confirming] : ''}
            </Button>
          </>
        }
      />
    </div>
  );
}

function PostPreview({ data }: { data: ModerationCase }) {
  const copy = useCopy();
  const m = copy.moderation;
  const post = data.post;
  return (
    <article className="rounded-xl border border-line bg-page-alt p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-dim">
        <span>
          {formatCopy(m.by, {
            name: post.author.displayName ?? copy.community.noName,
          })}
        </span>
        <span aria-hidden="true">·</span>
        <time
          dateTime={post.createdAt}
          title={formatInstantUtc(post.createdAt)}
        >
          {formatInstantLocal(post.createdAt)}
        </time>
        <Badge tone={postStatusTone[post.status]} withDot>
          {m[`status${post.status}`]}
        </Badge>
        {post.official && <Badge tone="info">{m.official}</Badge>}
      </div>
      <h3 className="text-sm font-semibold text-fg">{post.title}</h3>
      <p className="mt-2 max-h-48 overflow-y-auto text-xs leading-relaxed break-words whitespace-pre-line text-fg-2">
        {post.content}
      </p>
      {(post.media.length > 0 || post.coins.length > 0) && (
        <p className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-dim">
          {post.coins.map((coin) => (
            <span key={coin} className="font-mono font-semibold text-primary">
              ${coin}
            </span>
          ))}
          {post.media.length > 0 && (
            <span>{formatCopy(m.media, { n: post.media.length })}</span>
          )}
        </p>
      )}
    </article>
  );
}

function ReportList({ data }: { data: ModerationCase }) {
  const copy = useCopy();
  const m = copy.moderation;
  const reasons = copy.community.reportDialog;
  return (
    <section aria-labelledby="case-reports">
      <h3
        id="case-reports"
        className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase"
      >
        {formatCopy(m.reportsTitle, { n: data.reports.length })}
      </h3>
      <ul className="grid gap-2">
        {data.reports.map((report) => (
          <li
            key={report.id}
            className="rounded-lg border border-line px-3 py-2.5 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={reasonTone[report.reason]}>
                {reasons[report.reason]}
              </Badge>
              <span className="text-muted-dim">
                {formatCopy(m.reportedBy, {
                  name: report.reporter.displayName ?? copy.community.noName,
                })}
              </span>
              <time
                dateTime={report.createdAt}
                title={formatInstantUtc(report.createdAt)}
                className="ml-auto font-mono text-[11px] text-muted-x"
              >
                {formatInstantLocal(report.createdAt)}
              </time>
            </div>
            <p
              className={classNames(
                'mt-1.5 break-words',
                report.description ? 'text-fg-2' : 'text-muted-x italic',
              )}
            >
              {report.description ?? m.noDescription}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
