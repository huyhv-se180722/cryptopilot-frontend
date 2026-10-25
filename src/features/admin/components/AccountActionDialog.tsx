import { useId, useState } from 'react';
import { Alert } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
} from '../../../components/ui/field-styles';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText, fieldErrorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type {
  AccountAction,
  AccountRole,
  AdminUserSummary,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { useAccountAction, useChangeRole } from '../hooks/use-admin-users';

const REASON_MAX = 500;

export type AccountChange =
  { kind: AccountAction } | { kind: 'role'; role: AccountRole };

/**
 * MSG39 confirmation of one status or role change (UC-42) with its
 * required reason, kept in the audit log (BR-57). A change the server
 * refuses (own account, last active administrator, a status it cannot
 * leave) stays open with the refusal.
 */
export function AccountActionDialog({
  account,
  change,
  onClose,
}: {
  account: AdminUserSummary;
  /** null = closed. */
  change: AccountChange | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  const t = copy.adminUsers;
  const verb =
    change === null
      ? ''
      : change.kind === 'role'
        ? t.actionRole
        : t[`action${change.kind}`];
  return (
    <Dialog
      open={change !== null}
      onOpenChange={(open) => !open && onClose()}
      title={formatCopy(t.confirmTitle, { action: verb, email: account.email })}
      size="sm"
      accent={change?.kind === 'ban' ? 'negative' : 'primary'}
    >
      {change && (
        <ChangeForm
          key={change.kind === 'role' ? 'role' + change.role : change.kind}
          account={account}
          change={change}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function ChangeForm({
  account,
  change,
  onClose,
}: {
  account: AdminUserSummary;
  change: AccountChange;
  onClose: () => void;
}) {
  const copy = useCopy();
  const t = copy.adminUsers;
  const { show } = useToast();
  const act = useAccountAction();
  const role = useChangeRole();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reasonId = useId();
  const text = reason.trim();
  const tooLong = text.length > REASON_MAX;
  const localError =
    touched && text === ''
      ? t.reasonRequired
      : tooLong
        ? t.reasonTooLong
        : null;
  const error = localError ?? fieldError;
  const pending = act.pending || role.pending;

  async function submit() {
    setTouched(true);
    if (text === '' || tooLong) return;
    setNotice(null);
    setFieldError(null);
    const result =
      change.kind === 'role'
        ? await role.run(account.userId, change.role, text)
        : await act.run(account.userId, change.kind, text);
    if (result.status === 'success') {
      show({
        tone: 'success',
        message: change.kind === 'role' ? t.donerole : t[`done${change.kind}`],
      });
      onClose();
      return;
    }
    if (result.status !== 'error') return;
    const problem = problemOf(result.error);
    const onReason = problem?.fieldErrors.reason;
    if (problem?.code === 'ACCOUNT_STATUS_TRANSITION_INVALID')
      setNotice(t.refused);
    else if (onReason) setFieldError(fieldErrorText(copy, onReason, t.reason));
    else setNotice(errorText(copy, result.error));
  }

  const body =
    change.kind === 'role'
      ? t[`confirmrole${change.role}`]
      : t[`confirm${change.kind}`];
  const label =
    change.kind === 'role'
      ? change.role === 'Admin'
        ? t.makeAdmin
        : t.makeTrader
      : t[change.kind];
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-xs leading-relaxed text-fg-2">{body}</p>
      {notice && <Alert tone="danger" title={notice} />}
      <div>
        <label htmlFor={reasonId} className={fieldLabelClass}>
          {t.reason}
        </label>
        <textarea
          id={reasonId}
          rows={3}
          required
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setFieldError(null);
          }}
          onBlur={() => setTouched(true)}
          aria-invalid={error ? true : undefined}
          aria-describedby={reasonId + '-hint'}
          className={classNames(fieldControlClass, 'resize-y')}
        />
        <div
          id={reasonId + '-hint'}
          className="mt-1 flex justify-between gap-2 text-[11px]"
        >
          <span
            className={classNames(
              error ? fieldErrorClass : fieldHintClass,
              'mt-0',
            )}
          >
            {error ?? t.reasonHint}
          </span>
          <span
            className={classNames(
              'font-mono',
              tooLong ? 'text-negative' : 'text-muted-x',
            )}
          >
            {text.length}/{REASON_MAX}
          </span>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {copy.common.cancel}
        </Button>
        <Button
          type="submit"
          variant={change.kind === 'ban' ? 'danger' : 'primary'}
          disabled={pending}
        >
          {label}
        </Button>
      </div>
    </form>
  );
}
