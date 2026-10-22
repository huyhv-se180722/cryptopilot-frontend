import { useId, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Alert as Banner } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { buttonClassName } from '../../../components/ui/button-styles';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
} from '../../../components/ui/field-styles';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type { PostReport, ReportReason } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';

const REASONS: readonly ReportReason[] = [
  'SPAM',
  'SCAM',
  'ABUSE',
  'MISLEADING',
  'OTHER',
];
const DETAILS_MAX = 500;

/**
 * SCR-27 Report post (UC-33, BR-46): a reason, details required for
 * Other. A repeated report shows the SRS "already reported" text, which
 * the backend sends under MSG34 (Q-66), in line.
 */
export function ReportDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  /** Resolves with the refusal, if any. */
  onSubmit: (report: PostReport) => Promise<unknown>;
}) {
  const r = useCopy().community.reportDialog;
  const formId = useId();
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={r.title}
      description={r.description}
      accent="warning"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {useCopy().common.cancel}
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {r.submit}
          </Button>
        </>
      }
    >
      {open && (
        <ReportForm id={formId} onPending={setPending} onSubmit={onSubmit} />
      )}
    </Dialog>
  );
}

function ReportForm({
  id,
  onPending,
  onSubmit,
}: {
  id: string;
  onPending: (pending: boolean) => void;
  onSubmit: (report: PostReport) => Promise<unknown>;
}) {
  const copy = useCopy();
  const r = copy.community.reportDialog;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const detailsId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (!reason) {
      setFieldError(
        formatCopy(copy.messages.MSG01, { field: r.reason.toLowerCase() }),
      );
      return;
    }
    const text = details.trim();
    if (reason === 'OTHER' && text === '') {
      setFieldError(r.detailsRequired);
      return;
    }
    setFieldError(null);
    onPending(true);
    const refusal = await onSubmit({
      reason,
      description: text === '' ? null : text,
    });
    onPending(false);
    if (!refusal) return;
    const problem = problemOf(refusal);
    if (problem?.code === 'POST_ALREADY_REPORTED') setNotice(r.already);
    else if (problem?.fieldErrors.description) setFieldError(r.detailsRequired);
    else setNotice(errorText(copy, refusal));
  }

  return (
    <form
      id={id}
      noValidate
      onSubmit={(e) => void submit(e)}
      className="grid gap-4"
    >
      {notice && <Banner tone="warning" title={notice} />}
      <fieldset>
        <legend className={fieldLabelClass}>{r.reason}</legend>
        <div className="grid gap-1.5">
          {REASONS.map((value) => (
            <label
              key={value}
              className={classNames(
                'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs',
                reason === value
                  ? 'border-primary-line bg-primary-soft text-fg'
                  : 'border-line bg-raised text-fg-2 hover:border-line-strong',
              )}
            >
              <input
                type="radio"
                name="reason"
                value={value}
                checked={reason === value}
                onChange={() => {
                  setReason(value);
                  setFieldError(null);
                }}
                className="accent-(--cp-primary)"
              />
              {r[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={detailsId} className={fieldLabelClass}>
          {r.details}
        </label>
        <textarea
          id={detailsId}
          rows={3}
          maxLength={DETAILS_MAX}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          aria-invalid={fieldError !== null && reason !== null}
          aria-describedby={detailsId + '-hint'}
          className={classNames(fieldControlClass, 'resize-y')}
        />
        <span id={detailsId + '-hint'} className={fieldHintClass}>
          {r.detailsHint} · {details.length}/{DETAILS_MAX}
        </span>
      </div>
      {fieldError && (
        <span role="alert" className={fieldErrorClass}>
          {fieldError}
        </span>
      )}
    </form>
  );
}

/** Confirmation before deleting a post or a comment (BR-47). */
export function ConfirmDeleteDialog({
  open,
  title,
  body,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const copy = useCopy();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      description={body}
      size="sm"
      accent="negative"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {copy.common.cancel}
          </Button>
          <Button variant="danger" disabled={pending} onClick={onConfirm}>
            {copy.community.delete}
          </Button>
        </>
      }
    />
  );
}

/**
 * A Guest reads the community (D-99); writing, reacting and reporting
 * ask them to sign in, then bring them back to the same page.
 */
export function JoinDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const c = useCopy().community;
  const location = useLocation();
  const from = { from: location.pathname + location.search };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={c.signInTitle}
      description={c.signInBody}
      size="sm"
      footer={
        <>
          <Link
            to="/login"
            state={from}
            className={buttonClassName('secondary')}
          >
            {c.signIn}
          </Link>
          <Link to="/register" state={from} className={buttonClassName()}>
            {c.register}
          </Link>
        </>
      }
    />
  );
}
