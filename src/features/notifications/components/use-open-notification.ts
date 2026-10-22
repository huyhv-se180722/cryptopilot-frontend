import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { errorText } from '../../../i18n/messages';
import type { AppNotification } from '../../../types/domain';
import { useMarkRead } from '../hooks/use-notifications';
import { notificationPath } from './notification-format';

/**
 * Opening a notification marks it read and navigates to what it
 * references (SRS 3.4.5). A failed mark still opens the object; the error
 * shows as a toast.
 */
export function useOpenNotification(afterOpen?: () => void) {
  const copy = useCopy();
  const { show } = useToast();
  const navigate = useNavigate();
  const markRead = useMarkRead();
  return useCallback(
    (notification: AppNotification) => {
      const path = notificationPath(notification.reference);
      if (!notification.read)
        void markRead.run(notification.id).then((result) => {
          if (result.status === 'error')
            show({ tone: 'error', message: errorText(copy, result.error) });
        });
      afterOpen?.();
      if (path) navigate(path);
    },
    [markRead, show, copy, navigate, afterOpen],
  );
}
