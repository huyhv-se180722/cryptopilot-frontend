import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { NewsSource } from '../../../types/domain';
import { formatInstantLocal } from '../../../utils/instant-format';
import { crawlAge } from './news-admin-format';

/**
 * The confirmation before a crawl on demand (T-080b, D-124): the source is
 * crawled on its own every interval, so the administrator sees when it was
 * last read and when it is read next, or that it is switched off, before
 * asking the outlet again. Crawling now restarts its schedule from now.
 */
export function CrawlNowDialog({
  source,
  pending,
  onClose,
  onConfirm,
}: {
  source: NewsSource | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const copy = useCopy();
  const n = copy.newsAdmin;
  return (
    <Dialog
      open={source !== null}
      onOpenChange={(next) => !next && !pending && onClose()}
      title={
        source ? formatCopy(n.crawlTitle, { name: source.sourceName }) : ''
      }
      size="sm"
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {n.cancel}
          </Button>
          <Button disabled={pending} onClick={onConfirm}>
            {pending ? (
              <Loader2 size={14} aria-hidden="true" className="animate-spin" />
            ) : (
              <RefreshCw size={14} aria-hidden="true" />
            )}
            {pending ? n.crawling : n.crawlConfirm}
          </Button>
        </>
      }
    >
      {source && (
        <div className="grid gap-2 text-sm text-fg-2">
          <p>
            {formatCopy(n.crawlSchedule, { n: source.crawlIntervalMinutes })}
          </p>
          <p>
            {source.lastCrawledAt
              ? formatCopy(n.crawlLast, {
                  time: formatInstantLocal(source.lastCrawledAt),
                  age: crawlAge(copy, source.lastCrawledAt),
                })
              : n.crawlNever}
          </p>
          <p>
            {!source.active
              ? n.crawlOff
              : source.nextCrawlAt
                ? formatCopy(n.crawlNext, {
                    time: formatInstantLocal(source.nextCrawlAt),
                  })
                : null}
          </p>
          <p className="text-xs text-muted-dim">{n.crawlNote}</p>
        </div>
      )}
    </Dialog>
  );
}
