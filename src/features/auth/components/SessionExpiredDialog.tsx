import { useNavigate } from 'react-router-dom';
import { Dialog } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../hooks/use-auth';
import { useCopy } from '../../../hooks/use-copy';
import { messageText } from '../../../i18n/messages';

/** MSG44 dialog when the server ends a live session (SRS 3.2.3). */
export function SessionExpiredDialog() {
  const copy = useCopy();
  const auth = useAuth();
  const navigate = useNavigate();
  const open = auth.status === 'ready' && auth.ended === 'expired';
  const signIn = () => {
    auth.acknowledgeEnded();
    navigate('/login', { replace: true });
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) signIn();
      }}
      title={copy.auth.sessionExpiredTitle}
      description={messageText(copy, 'MSG44')}
      size="sm"
      accent="warning"
      footer={
        <Button onClick={signIn}>{copy.auth.sessionExpiredAction}</Button>
      }
    />
  );
}
