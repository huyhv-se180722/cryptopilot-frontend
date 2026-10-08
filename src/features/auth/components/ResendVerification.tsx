import { Button } from '../../../components/ui/Button';
import { useCooldown } from '../../../hooks/use-cooldown';
import { useCopy, formatCopy } from '../../../hooks/use-copy';
import { errorText } from '../../../i18n/messages';
import { useResendVerification } from '../hooks/use-auth-actions';
import { FormNotice } from './FormNotice';

/** Resend action with the client-side 60 s cooldown (SRS 3.2.2, M-07). */
export function ResendVerification({ email }: { email: string }) {
  const copy = useCopy();
  const resend = useResendVerification();
  const cooldown = useCooldown(60);
  return (
    <div>
      {resend.state.status === 'success' && (
        <FormNotice tone="info">{copy.auth.resendSent}</FormNotice>
      )}
      {resend.state.status === 'error' && (
        <FormNotice tone="error">
          {errorText(copy, resend.state.error)}
        </FormNotice>
      )}
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        disabled={!email || resend.pending || cooldown.active}
        onClick={async () => {
          const result = await resend.run(email);
          if (result.status === 'success') cooldown.start();
        }}
      >
        {cooldown.active
          ? formatCopy(copy.auth.resendIn, { seconds: cooldown.remaining })
          : copy.auth.resendVerification}
      </Button>
    </div>
  );
}
