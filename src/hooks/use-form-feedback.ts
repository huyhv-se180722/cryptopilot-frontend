import { useCallback, useMemo, useState } from 'react';
import { errorText, isUnexpectedError, messageText } from '../i18n/messages';
import { useCopy } from './use-copy';
import { useToast } from './use-toast';

/**
 * Save feedback of a form, placed as SRS 5.3 says: MSG14 and MSG43 as
 * toasts, every other failure inline above the form (`inline`).
 */
export function useFormFeedback() {
  const copy = useCopy();
  const { show } = useToast();
  const [inline, setInline] = useState<{ error: unknown } | null>(null);
  const clear = useCallback(() => setInline(null), []);
  const saved = useCallback(
    () => show({ tone: 'success', message: messageText(copy, 'MSG14') }),
    [copy, show],
  );
  const failed = useCallback(
    (error: unknown) => {
      if (isUnexpectedError(copy, error))
        show({ tone: 'error', message: errorText(copy, error) });
      else setInline({ error });
    },
    [copy, show],
  );
  return useMemo(
    () => ({ inline, clear, saved, failed }),
    [inline, clear, saved, failed],
  );
}
