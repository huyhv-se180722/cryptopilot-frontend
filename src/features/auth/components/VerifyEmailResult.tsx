import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Input } from '../../../components/ui/Input';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { fieldErrorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import { emailSchema } from '../schemas';
import { useVerifyEmail } from '../hooks/use-verify-email';
import { ResendVerification } from './ResendVerification';
import { StatusPanel } from './StatusPanel';

function stateEmail(state: unknown): string {
  return typeof state === 'object' &&
    state !== null &&
    'email' in state &&
    typeof state.email === 'string'
    ? state.email
    : '';
}

/** Email field + resend, used when there is no valid link. */
function ResendBlock({ initialEmail }: { initialEmail: string }) {
  const copy = useCopy();
  const [email, setEmail] = useState(initialEmail);
  const parsed = emailSchema.safeParse({ email });
  const issue = parsed.success ? undefined : parsed.error.issues[0]?.message;
  return (
    <>
      <Input
        type="email"
        autoComplete="email"
        label={copy.auth.emailLabel}
        placeholder={copy.auth.emailPlaceholder}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={
          email && issue
            ? fieldErrorText(copy, issue, copy.auth.emailLabel)
            : undefined
        }
      />
      <ResendVerification email={parsed.success ? parsed.data.email : ''} />
    </>
  );
}

/**
 * SCR-03 (no Figma frame; spec §1). Reads `token` from the link, verifies it
 * once and offers resend when the link is invalid (MSG06 / MSG07).
 */
export function VerifyEmailResult() {
  const copy = useCopy();
  const [params] = useSearchParams();
  const location = useLocation();
  const token = params.get('token');
  const state = useVerifyEmail(token);
  const loginLink = (
    <Link to="/login" className={buttonClassName('primary', 'lg', 'w-full')}>
      {copy.auth.goToLogin}
    </Link>
  );

  if (state.status === 'pending')
    return <StatusPanel tone="pending" title={copy.auth.verifyingTitle} />;
  if (state.status === 'success')
    return (
      <StatusPanel
        tone="success"
        title={copy.auth.verifiedTitle}
        message={messageText(copy, 'MSG06')}
      >
        {loginLink}
      </StatusPanel>
    );
  if (
    state.status === 'error' &&
    problemOf(state.error)?.code === 'EMAIL_ALREADY_VERIFIED'
  )
    return (
      <StatusPanel
        tone="warning"
        title={copy.auth.verifyFailedTitle}
        message={
          messageText(copy, 'MSG07') + ' ' + copy.auth.alreadyVerifiedHint
        }
      >
        {loginLink}
      </StatusPanel>
    );
  return (
    <StatusPanel
      tone={state.status === 'idle' ? 'mail' : 'warning'}
      title={
        state.status === 'idle'
          ? copy.auth.resendVerification
          : copy.auth.verifyFailedTitle
      }
      {...(state.status === 'error'
        ? { message: messageText(copy, 'MSG07') }
        : {})}
    >
      <ResendBlock initialEmail={stateEmail(location.state)} />
      <p className="text-center text-sm">
        <Link to="/login" className="text-primary no-underline">
          {copy.auth.backToSignIn}
        </Link>
      </p>
    </StatusPanel>
  );
}
