import type { Copy } from '../../i18n/locales/en';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import { problemOf } from '../../services/api/errors';

/**
 * Text for a failure of the news console. The news codes carry a message
 * the shared catalogue has no text for (MSG50 with the seconds left, MSG31,
 * and the conflicts answered as MSG43), so each gets its own sentence;
 * anything else is the shared text.
 */
export function newsAdminErrorText(copy: Copy, error: unknown): string {
  const n = copy.newsAdmin;
  const problem = problemOf(error);
  switch (problem?.code) {
    case 'NEWS_SOURCE_CRAWLED_RECENTLY':
      return formatCopy(n.crawledRecently, {
        seconds: problem.messageArgs[0] ?? '60',
      });
    case 'NEWS_SUMMARY_UNAVAILABLE':
      return n.summaryUnavailable;
    case 'NEWS_FEED_UNREADABLE':
      return n.feedUnreadable;
    case 'NEWS_SOURCE_ALREADY_REGISTERED':
      return n.alreadyRegistered;
    case 'NEWS_SOURCE_IN_USE':
      return n.inUse;
    default:
      return errorText(copy, error);
  }
}
