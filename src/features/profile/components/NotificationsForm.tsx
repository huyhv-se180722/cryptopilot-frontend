import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Switch } from '../../../components/ui/Switch';
import { useCopy } from '../../../hooks/use-copy';
import { useFormFeedback } from '../../../hooks/use-form-feedback';
import { errorText } from '../../../i18n/messages';
import type { UserProfile } from '../../../types/domain';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { useUpdateNotifications } from '../hooks/use-profile';
import { SectionTitle } from '../../../components/ui/SectionTitle';

/** SCR-07 Notifications tab (UC-08): email and push; in-app is always on. */
export function NotificationsForm({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: () => void;
}) {
  const copy = useCopy();
  const p = copy.profile;
  const action = useUpdateNotifications();
  const [email, setEmail] = useState(profile.notifyEmail);
  const [push, setPush] = useState(profile.notifyPush);
  const [saved, setSaved] = useState({
    email: profile.notifyEmail,
    push: profile.notifyPush,
  });
  const feedback = useFormFeedback();
  const dirty = email !== saved.email || push !== saved.push;

  return (
    <form
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        feedback.clear();
        const result = await action.run({ email, push });
        if (result.status === 'success') {
          setSaved({ email, push });
          feedback.saved();
          onSaved();
        } else if (result.status === 'error') feedback.failed(result.error);
      }}
    >
      {feedback.inline && (
        <FormNotice tone="error">
          {errorText(copy, feedback.inline.error)}
        </FormNotice>
      )}
      <Card padding="lg" className="mb-5">
        <SectionTitle>{p.notificationsTitle}</SectionTitle>
        <Switch
          label={p.notifyEmail}
          description={p.notifyEmailHint}
          checked={email}
          disabled={action.pending}
          onChange={(event) => setEmail(event.target.checked)}
        />
        <Switch
          label={p.notifyPush}
          description={p.notifyPushHint}
          checked={push}
          disabled={action.pending}
          onChange={(event) => setPush(event.target.checked)}
        />
        <Switch
          label={p.notifyInApp}
          description={p.notifyInAppHint}
          checked
          disabled
          readOnly
        />
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={action.pending || !dirty}>
          {action.pending && (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          )}
          {action.pending ? p.saving : p.save}
        </Button>
      </div>
    </form>
  );
}
