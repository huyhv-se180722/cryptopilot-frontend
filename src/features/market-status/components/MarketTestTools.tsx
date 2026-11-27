import { useState } from 'react';
import { ErrorState, Warning } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Table } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import {
  MAX_OUTAGE_SECONDS,
  toolsAbsent,
  type ReplayScenario,
  type RunningReplay,
  type StreamCut,
} from '../../../services/api/market-test-tools';
import type { HealthMarket } from '../../../services/api/market-status';
import { formatInstantLocal } from '../../../utils/instant-format';
import {
  useCutStreams,
  useReplayScenarios,
  useRunningReplays,
  useStartReplay,
  useStopReplay,
} from '../hooks/use-market-test-tools';

/**
 * The market tools of a test environment on the market health console
 * (RF-07, RF-12; BM04 section 9): the price replay of a pair along a scripted
 * path and the switch that cuts a market's exchange streams. Left out where
 * the backend has no test tools (production): its paths answer 404.
 */
export function MarketTestTools() {
  const copy = useCopy();
  const t = copy.marketTestTools;
  const scenarios = useReplayScenarios();
  if (scenarios.isPending) return <Skeleton className="h-40" />;
  if (scenarios.isError) {
    if (toolsAbsent(scenarios.error)) return null;
    return (
      <Card>
        <ErrorState
          message={errorText(copy, scenarios.error)}
          onRetry={() => void scenarios.refetch()}
        />
      </Card>
    );
  }
  return (
    <section
      aria-label={t.title}
      data-testid="market-test-tools"
      className="flex flex-col gap-4"
    >
      <Warning title={t.title}>{t.subtitle}</Warning>
      <div className="grid gap-4 lg:grid-cols-2">
        <ReplayCard scenarios={scenarios.data} />
        <StreamCutCard />
      </div>
    </section>
  );
}

function ReplayCard({ scenarios }: { scenarios: readonly ReplayScenario[] }) {
  const copy = useCopy();
  const t = copy.marketTestTools;
  const c = copy.marketStatus;
  const toast = useToast();
  const replays = useRunningReplays(true);
  const start = useStartReplay();
  const stop = useStopReplay();
  const [chosen, setChosen] = useState(scenarios[0]?.name ?? '');
  const scenario = scenarios.find((item) => item.name === chosen);
  const marketName = (market: HealthMarket) =>
    market === 'SPOT' ? c.spot : c.futures;

  const startReplay = async () => {
    if (!scenario) return;
    const result = await start.run(scenario.name);
    if (result.status === 'success') {
      toast.show({
        tone: 'success',
        message: formatCopy(t.replayStarted, {
          scenario: scenario.name,
          symbol: scenario.symbol,
        }),
      });
    } else if (result.status === 'error') {
      toast.show({ tone: 'error', message: errorText(copy, result.error) });
    }
  };

  const stopReplay = async (replay: RunningReplay) => {
    const result = await stop.run(replay.market, replay.symbol);
    if (result.status === 'success') {
      toast.show({
        tone: 'success',
        message: formatCopy(t.replayStopped, { symbol: replay.symbol }),
      });
    } else if (result.status === 'error') {
      toast.show({ tone: 'error', message: errorText(copy, result.error) });
    }
  };

  return (
    <Card
      data-testid="market-replay"
      padding="none"
      className="flex flex-col gap-3 overflow-hidden"
    >
      <div className="flex flex-col gap-3 px-4 pt-3">
        <h2 className="text-sm font-semibold text-fg">{t.replayTitle}</h2>
        <p className="text-xs text-muted">{t.replayHint}</p>
        {scenarios.length === 0 ? (
          <p className="text-xs text-muted">{t.noScenario}</p>
        ) : (
          <>
            <Select
              label={t.scenario}
              value={chosen}
              onChange={(event) => setChosen(event.target.value)}
            >
              {scenarios.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name +
                    ' · ' +
                    marketName(item.market) +
                    ' ' +
                    item.symbol}
                </option>
              ))}
            </Select>
            {scenario && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted">{t.description}</dt>
                <dd className="text-fg">{scenario.description}</dd>
                <dt className="text-muted">{t.path}</dt>
                <dd className="text-fg tabular-nums">
                  {formatCopy(t.pathValue, {
                    first: scenario.firstPrice,
                    last: scenario.lastPrice,
                    seconds: scenario.lengthSeconds,
                  })}
                </dd>
              </dl>
            )}
            <div>
              <Button
                disabled={!scenario || start.pending}
                onClick={() => void startReplay()}
              >
                {t.startReplay}
              </Button>
            </div>
          </>
        )}
      </div>
      <h3 className="px-4 text-xs font-semibold text-fg">{t.running}</h3>
      {replays.isPending ? (
        <Skeleton className="m-4 h-16" />
      ) : replays.isError ? (
        <ErrorState
          message={errorText(copy, replays.error)}
          onRetry={() => void replays.refetch()}
        />
      ) : (
        <Table<RunningReplay>
          caption={t.running}
          rows={replays.data}
          rowKey={(row) => row.market + ':' + row.symbol}
          emptyMessage={t.noReplay}
          columns={[
            {
              id: 'pair',
              header: t.pair,
              render: (row) => marketName(row.market) + ' ' + row.symbol,
            },
            {
              id: 'scenario',
              header: t.scenario,
              render: (row) => row.scenario,
            },
            {
              id: 'price',
              header: t.price,
              render: (row) => (
                <span className="tabular-nums">{row.price}</span>
              ),
            },
            {
              id: 'ends',
              header: t.endsAt,
              render: (row) => formatInstantLocal(row.endsAt),
            },
            {
              id: 'stop',
              header: '',
              render: (row) => (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={stop.pending}
                  onClick={() => void stopReplay(row)}
                  aria-label={formatCopy(t.stopFor, { symbol: row.symbol })}
                >
                  {t.stop}
                </Button>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}

function StreamCutCard() {
  const copy = useCopy();
  const t = copy.marketTestTools;
  const c = copy.marketStatus;
  const toast = useToast();
  const cut = useCutStreams();
  const [market, setMarket] = useState<HealthMarket>('FUTURES');
  const [seconds, setSeconds] = useState('45');
  const [confirming, setConfirming] = useState(false);
  const [last, setLast] = useState<StreamCut | null>(null);
  const outage = Number(seconds);
  const valid =
    seconds.trim() !== '' &&
    Number.isInteger(outage) &&
    outage >= 0 &&
    outage <= MAX_OUTAGE_SECONDS;
  const marketName = market === 'SPOT' ? c.spot : c.futures;

  const cutStreams = async () => {
    setConfirming(false);
    const result = await cut.run(market, outage);
    if (result.status === 'success') {
      setLast(result.data);
      toast.show({
        tone: 'success',
        message: formatCopy(t.cutDone, { count: result.data.connectionsCut }),
      });
    } else if (result.status === 'error') {
      toast.show({ tone: 'error', message: errorText(copy, result.error) });
    }
  };

  return (
    <Card data-testid="market-stream-cut" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-fg">{t.cutTitle}</h2>
      <p className="text-xs text-muted">{t.cutHint}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          label={t.market}
          value={market}
          onChange={(event) => setMarket(event.target.value as HealthMarket)}
        >
          <option value="SPOT">{c.spot}</option>
          <option value="FUTURES">{c.futures}</option>
        </Select>
        <Input
          label={t.outage}
          hint={formatCopy(t.outageHint, { max: MAX_OUTAGE_SECONDS })}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_OUTAGE_SECONDS}
          step={1}
          value={seconds}
          error={
            valid
              ? undefined
              : formatCopy(t.outageInvalid, { max: MAX_OUTAGE_SECONDS })
          }
          onChange={(event) => setSeconds(event.target.value)}
        />
      </div>
      <div>
        <Button
          variant="danger"
          disabled={!valid || cut.pending}
          onClick={() => setConfirming(true)}
        >
          {t.cut}
        </Button>
      </div>
      {last && (
        <dl
          data-testid="market-stream-cut-result"
          className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs"
        >
          <dt className="text-muted">{t.connectionsCut}</dt>
          <dd className="text-fg tabular-nums">{last.connectionsCut}</dd>
          <dt className="text-muted">{t.cutAt}</dt>
          <dd className="text-fg">{formatInstantLocal(last.cutAt)}</dd>
          <dt className="text-muted">{t.reconnectFrom}</dt>
          <dd className="text-fg">{formatInstantLocal(last.reconnectFrom)}</dd>
        </dl>
      )}
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.cut}
        description={formatCopy(t.cutConfirm, {
          market: marketName,
          seconds: outage,
        })}
        accent="warning"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {copy.common.cancel}
            </Button>
            <Button variant="danger" onClick={() => void cutStreams()}>
              {t.cut}
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted">{t.cutHint}</p>
      </Dialog>
    </Card>
  );
}
