import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import type { MarketHealth } from '../../../services/api/market-status';
import { formatInstantLocal } from '../../../utils/instant-format';
import {
  useMaintenance,
  useResumeMarket,
} from '../hooks/use-market-health-admin';

/**
 * One market on the administration console (D-159): its state, since when
 * its data is lost and why, where the shown prices come from; the
 * maintenance switch with the Traders' message and expected end; and, while
 * it recovers, the reopening by hand for an outage beyond the replay.
 */
export function MarketHealthCard({ health }: { health: MarketHealth }) {
  const copy = useCopy();
  const t = copy.marketHealthAdmin;
  const c = copy.marketStatus;
  const toast = useToast();
  const maintenance = useMaintenance();
  const resume = useResumeMarket();
  const [message, setMessage] = useState('');
  const [expectedEnd, setExpectedEnd] = useState('');
  const [confirming, setConfirming] = useState(false);
  const market = health.market === 'SPOT' ? c.spot : c.futures;
  const underMaintenance = health.state === 'MAINTENANCE';

  const switchMaintenance = async () => {
    const result = await maintenance.run(
      underMaintenance
        ? { market: health.market, on: false }
        : {
            market: health.market,
            on: true,
            ...(message.trim() ? { message: message.trim() } : {}),
            ...(expectedEnd
              ? { expectedEndAt: new Date(expectedEnd).toISOString() }
              : {}),
          },
    );
    if (result.status === 'success') {
      toast.show({
        tone: 'success',
        message: underMaintenance ? t.ended : t.started,
      });
      setMessage('');
      setExpectedEnd('');
    } else if (result.status === 'error') {
      toast.show({ tone: 'error', message: errorText(copy, result.error) });
    }
  };

  const reopen = async () => {
    setConfirming(false);
    const result = await resume.run(health.market);
    if (result.status === 'success') {
      toast.show({ tone: 'success', message: t.resumed });
    } else if (result.status === 'error') {
      toast.show({ tone: 'error', message: errorText(copy, result.error) });
    }
  };

  const facts: [string, string][] = [
    [t.state, t.states[health.state]],
    ...(health.since
      ? ([[t.since, formatInstantLocal(health.since)]] as [string, string][])
      : []),
    ...(health.reason
      ? ([[t.reason, c.reasons[health.reason]]] as [string, string][])
      : []),
    [t.source, health.displaySource],
    ...(health.recovery
      ? ([
          [
            c.recoveringTitle.replace('{market}', market),
            formatCopy(c.progress, {
              done: health.recovery.pairsDone,
              total: health.recovery.pairsTotal,
            }),
          ],
        ] as [string, string][])
      : []),
  ];

  return (
    <Card
      data-testid={'market-health-' + health.market}
      className="flex flex-col gap-3"
    >
      <h2 className="text-sm font-semibold text-fg">{market}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      {!underMaintenance && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            label={t.message}
            hint={t.messageHint}
            maxLength={500}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <Input
            label={t.expectedEnd}
            type="datetime-local"
            value={expectedEnd}
            onChange={(event) => setExpectedEnd(event.target.value)}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={underMaintenance ? 'primary' : 'secondary'}
          disabled={maintenance.pending}
          onClick={() => void switchMaintenance()}
        >
          {underMaintenance ? t.end : t.start}
        </Button>
        {health.state === 'RECOVERING' && (
          <Button
            variant="danger"
            disabled={resume.pending}
            onClick={() => setConfirming(true)}
            title={t.resumeHint}
          >
            {t.resume}
          </Button>
        )}
      </div>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.resume}
        description={formatCopy(t.resumeConfirm, { market })}
        accent="warning"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {copy.common.cancel}
            </Button>
            <Button variant="danger" onClick={() => void reopen()}>
              {t.resume}
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted">{t.resumeHint}</p>
      </Dialog>
    </Card>
  );
}
