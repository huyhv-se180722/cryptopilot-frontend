import { useState } from 'react';
import { AlertOctagon, CheckCircle2, RefreshCw, Wrench, X } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { MarketHealth } from '../../../services/api/market-status';
import { classNames } from '../../../utils/class-names';
import { formatInstantLocal } from '../../../utils/instant-format';
import { useMarketStatus } from '../hooks/use-market-status';

const TONES = {
  paused: 'border-negative-line bg-negative-soft text-negative',
  maintenance: 'border-warning-line bg-warning-soft text-warning',
  recovering: 'border-primary-line bg-primary-soft text-primary',
  resumed: 'border-positive-line bg-positive-soft text-positive',
} as const;

/**
 * The strip on every page, public ones included (D-159, I7), one line per
 * market that is not live: paused, under maintenance or catching up, with
 * since when, why, what the Trader keeps and where the shown prices come
 * from; and for ten minutes after it ends, that trading has reopened, until
 * dismissed. A short reconnect shows nothing.
 */
export function MarketStatusBanner() {
  const status = useMarketStatus();
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const shown = status.markets.filter((health) =>
    health.tradingOpen
      ? health.resumedAt !== null &&
        health.incidentId !== null &&
        !dismissed.includes(health.incidentId)
      : true,
  );
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col">
      {shown.map((health) => (
        <MarketLine
          key={health.market}
          health={health}
          onDismiss={() =>
            health.incidentId &&
            setDismissed((ids) => [...ids, health.incidentId as string])
          }
        />
      ))}
    </div>
  );
}

function MarketLine({
  health,
  onDismiss,
}: {
  health: MarketHealth;
  onDismiss: () => void;
}) {
  const c = useCopy().marketStatus;
  const market = health.market === 'SPOT' ? c.spot : c.futures;
  const time = (value: string | null) =>
    value ? formatInstantLocal(value) : '—';

  let tone: keyof typeof TONES;
  let Icon = AlertOctagon;
  let title: string;
  const lines: string[] = [];
  if (health.tradingOpen) {
    tone = 'resumed';
    Icon = CheckCircle2;
    title = formatCopy(c.resumedTitle, { market });
    lines.push(
      formatCopy(c.resumedBody, {
        since: time(health.since ?? health.pausedAt),
        resumed: time(health.resumedAt),
      }),
    );
  } else if (health.state === 'MAINTENANCE') {
    tone = 'maintenance';
    Icon = Wrench;
    title = formatCopy(c.maintenanceTitle, { market });
    lines.push(health.message ?? c.maintenanceBody);
    if (health.expectedEndAt) {
      lines.push(
        formatCopy(c.expectedEnd, { time: time(health.expectedEndAt) }),
      );
    }
  } else if (health.state === 'RECOVERING') {
    tone = 'recovering';
    Icon = RefreshCw;
    title = formatCopy(c.recoveringTitle, { market });
    lines.push(c.recoveringBody);
    if (health.recovery && health.recovery.pairsTotal > 0) {
      lines.push(
        formatCopy(c.progress, {
          done: health.recovery.pairsDone,
          total: health.recovery.pairsTotal,
        }),
      );
    }
  } else {
    tone = 'paused';
    title = formatCopy(c.pausedTitle, { market });
    lines.push(formatCopy(c.pausedBody, { since: time(health.since) }));
    if (health.reason) lines.push(c.reasons[health.reason] + '.');
    if (health.retryAt) {
      lines.push(formatCopy(c.retryAt, { time: time(health.retryAt) }));
    }
  }
  if (!health.tradingOpen && health.state !== 'MAINTENANCE') {
    if (health.displaySource === 'OKX') lines.push(c.referenceOkx);
    if (health.displaySource === 'NONE') lines.push(c.referenceNone);
  }

  return (
    <div
      role={tone === 'resumed' ? 'status' : 'alert'}
      data-testid={'market-status-' + health.market}
      className={classNames(
        'flex items-start gap-2 border-b px-4 py-2 text-xs sm:px-6',
        TONES[tone],
      )}
    >
      <Icon
        size={14}
        aria-hidden="true"
        className={classNames(
          'mt-0.5 shrink-0',
          tone === 'recovering' && 'motion-safe:animate-spin',
        )}
      />
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">{title}</strong>
        <span className="text-fg-2"> {lines.join(' ')}</span>
      </p>
      {tone === 'resumed' && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={c.dismiss}
          className="shrink-0 rounded p-0.5 hover:bg-raised"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
