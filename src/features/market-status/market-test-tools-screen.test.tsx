// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminMarketHealthPage } from '../../pages/admin/AdminMarketHealthPage';
import { ServiceError } from '../../services/api/errors';
import {
  ALL_LIVE,
  createPendingMarketStatusService,
} from '../../services/api/market-status';
import type {
  MarketTestToolsService,
  RunningReplay,
} from '../../services/api/market-test-tools';
import { page, renderRoutes } from '../../test/render';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const REPLAY: RunningReplay = {
  scenario: 'btc_liq',
  market: 'FUTURES',
  symbol: 'BTCUSDT',
  startedAt: '2026-11-28T08:00:00Z',
  endsAt: '2026-11-28T08:02:00Z',
  price: '58400.5',
};

function tools(
  overrides: Partial<MarketTestToolsService> = {},
): MarketTestToolsService {
  return {
    scenarios: async () => [
      {
        name: 'btc_liq',
        description: 'BTC falls through a liquidation price',
        market: 'FUTURES',
        symbol: 'BTCUSDT',
        lengthSeconds: 120,
        firstPrice: '60000',
        lastPrice: '52000',
      },
      {
        name: 'eth_alert',
        description: 'ETH crosses an alert price',
        market: 'SPOT',
        symbol: 'ETHUSDT',
        lengthSeconds: 60,
        firstPrice: '3000',
        lastPrice: '3100',
      },
    ],
    replays: async () => [],
    startReplay: async () => REPLAY,
    stopReplay: async () => undefined,
    cutStreams: async (market) => ({
      market,
      connectionsCut: 2,
      cutAt: '2026-11-28T08:00:00Z',
      reconnectFrom: '2026-11-28T08:00:45Z',
    }),
    ...overrides,
  };
}

function render(marketTestTools: MarketTestToolsService) {
  return renderRoutes(
    [page('/admin/market-health', <AdminMarketHealthPage />)],
    '/admin/market-health',
    undefined,
    {
      marketStatus: {
        ...createPendingMarketStatusService(),
        status: async () => ALL_LIVE,
        incidents: async () => [],
      },
      marketTestTools,
    },
  );
}

describe('market test tools on the market health console (RF-07, RF-12)', () => {
  it('starts the chosen replay and stops a running one', async () => {
    const startReplay = vi.fn<MarketTestToolsService['startReplay']>(
      async () => REPLAY,
    );
    const stopReplay = vi.fn<MarketTestToolsService['stopReplay']>(
      async () => undefined,
    );
    let running: RunningReplay[] = [];
    await render(
      tools({
        startReplay: async (name) => {
          running = [REPLAY];
          return startReplay(name);
        },
        stopReplay: async (market, symbol) => {
          running = [];
          return stopReplay(market, symbol);
        },
        replays: async () => running,
      }),
    );
    const replay = await screen.findByTestId('market-replay');
    expect(await within(replay).findByText('No replay running.')).toBeTruthy();
    const scenario = within(replay).getByLabelText('Scenario');
    await userEvent.selectOptions(scenario, 'eth_alert');
    expect(within(replay).getByText('3000 → 3100 in 60 s')).toBeTruthy();
    await userEvent.selectOptions(scenario, 'btc_liq');
    await userEvent.click(
      within(replay).getByRole('button', { name: 'Start replay' }),
    );
    expect(startReplay).toHaveBeenCalledWith('btc_liq');
    expect(await within(replay).findByText('58400.5')).toBeTruthy();
    await userEvent.click(
      within(replay).getByRole('button', {
        name: 'Stop the replay of BTCUSDT',
      }),
    );
    expect(stopReplay).toHaveBeenCalledWith('FUTURES', 'BTCUSDT');
    expect(await within(replay).findByText('No replay running.')).toBeTruthy();
  });

  it('cuts a market after confirming, shows what was cut, and refuses a bad outage', async () => {
    const cutStreams = vi.fn(tools().cutStreams);
    await render(tools({ cutStreams }));
    const card = await screen.findByTestId('market-stream-cut');
    await userEvent.selectOptions(
      within(card).getByLabelText('Market'),
      'SPOT',
    );
    const outage = within(card).getByLabelText('Outage (seconds)');
    await userEvent.clear(outage);
    await userEvent.type(outage, '301');
    expect(
      within(card).getByText('Enter a whole number from 0 to 300.'),
    ).toBeTruthy();
    const button = within(card).getByRole('button', { name: 'Cut streams' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await userEvent.clear(outage);
    await userEvent.type(outage, '45');
    await userEvent.click(button);
    expect(cutStreams).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Cut the Spot exchange streams for 45 s?'),
    ).toBeTruthy();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cut streams' }),
    );
    expect(cutStreams).toHaveBeenCalledWith('SPOT', 45);
    const result = await screen.findByTestId('market-stream-cut-result');
    expect(within(result).getByText('2')).toBeTruthy();
  });

  it('leaves the tools out where the backend has none (404)', async () => {
    await render(
      tools({
        scenarios: async () => {
          throw new ServiceError('Not found', 'HTTP_ERROR', 404);
        },
      }),
    );
    expect(await screen.findByTestId('market-health-SPOT')).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByTestId('market-test-tools')).toBeNull(),
    );
    expect(screen.queryByText('Price replay')).toBeNull();
  });
});
