import type { Copy } from '../../i18n/locales/en';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import { problemOf } from '../../services/api/errors';

/**
 * Text for a failure of the assistant: MSG30 with today's quota and MSG29
 * as the upgrade prompt have their own sentences; anything else is the
 * shared text.
 */
export function aiErrorText(copy: Copy, error: unknown): string {
  const t = copy.aiAssistant;
  const problem = problemOf(error);
  switch (problem?.code) {
    case 'AI_DAILY_QUOTA_EXHAUSTED':
      return formatCopy(t.quotaExhausted, {
        quota: problem.messageArgs[0] ?? '',
      });
    case 'PLAN_FEATURE_NOT_INCLUDED':
      return t.upgradeTitle;
    default:
      return errorText(copy, error);
  }
}
