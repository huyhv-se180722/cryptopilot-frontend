// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminMarketHealthPage } from '../../pages/admin/AdminMarketHealthPage';
import {
  ALL_LIVE,
  type MarketHealth,
  type MarketStatus,
  type MarketStatusService,
} from '../../services/api/market-status';
import { page, renderRoutes } from '../../test/render';
import { MarketStatusBanner } from './components/MarketStatusBanner';
import { ReferencePriceNote } from './components/ReferencePriceNote';
import { useTradingBlock } from './hooks/use-market-status';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const SPOT_LIVE = ALL_LIVE.markets[0] as MarketHealth;
const FUTURES_LIVE = ALL_LIVE.markets[1] as MarketHealth;

function statusOf(
  futures: Partial<MarketHealth>,
  spot: Partial<MarketHealth> = {},
): MarketStatus {
  return {
    markets: [
      { ...SPOT_LIVE, ...spot },
      { ...FUTURES_LIVE, ...futures },
    ],
  };
}

function fakeService(
  status: MarketStatus,
  overrides: Partial<MarketStatusService> = {},
): MarketStatusService {
  return {
    status: async () => status,
    subscribe: () => () => undefined,
    fallback: async (market) => ({
      market,
      source: 'OKX',
      asOf: '2026-11-19T07:33:00Z',
      prices: [
        {
          symbol: 'BTCUSDT',
          lastPrice: '70000',
          changePercent24h: null,
          high24h: null,
          low24h: null,
          volume24h: null,
          asOf: '2026-11-19T07:33:00Z',
          diverged: true,
        },
      ],
    }),
    subscribeFallback: () => () => undefined,
    fallbackCandles: async () => [],
    maintenance: async () => status,
    resume: async () => status,
    incidents: async () => [],
    ...overrides,
  };
}

const PAUSED: Partial<MarketHealth> = {
  state: 'PAUSED',
  tradingOpen: false,
  since: '2026-11-19T07:32:05Z',
  pausedAt: '2026-11-19T07:32:35Z',
  reason: 'IP_BANNED',
  incidentId: 'incident-1',
  retryAt: '2026-11-19T07:40:00Z',
  displaySource: 'OKX',
  dataLost: true,
};

async function banner(status: MarketStatus) {
  await renderRoutes([page('/', <MarketStatusBanner />)], '/', undefined, {
    marketStatus: fakeService(status),
  });
}

describe('market status banner (D-158, I7)', () => {
  it('shows nothing while both markets are live, or only reconnecting', async () => {
    await banner(statusOf({ state: 'RECONNECTING' }));
    await waitFor(() =>
      expect(screen.queryByTestId('market-status-FUTURES')).toBeNull(),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says a market is paused, since when, why, when the exchange takes calls again and where prices come from', async () => {
    await banner(statusOf(PAUSED));
    const line = await screen.findByTestId('market-status-FUTURES');
    expect(line.textContent).toContain('Futures trading is paused');
    expect(line.textContent).toContain('the exchange blocked the server');
    expect(line.textContent).toContain('accepts calls again');
    expect(line.textContent).toContain('Reference prices from OKX');
    expect(screen.queryByTestId('market-status-SPOT')).toBeNull();
  });

  it('shows maintenance with its message and expected end, and recovery with its progress', async () => {
    await banner(
      statusOf(
        {
          ...PAUSED,
          state: 'RECOVERING',
          recovery: { pairsDone: 3, pairsTotal: 5 },
        },
        {
          state: 'MAINTENANCE',
          tradingOpen: false,
          message: 'Upgrading the server.',
          expectedEndAt: '2026-11-19T09:00:00Z',
          incidentId: 'incident-2',
        },
      ),
    );
    expect(
      (await screen.findByTestId('market-status-SPOT')).textContent,
    ).toContain('Upgrading the server.');
    expect(screen.getByTestId('market-status-SPOT').textContent).toContain(
      'Expected to end',
    );
    expect(screen.getByTestId('market-status-FUTURES').textContent).toContain(
      '3 of 5 pairs caught up',
    );
  });

  it('says trading has reopened after an incident, until dismissed', async () => {
    await banner(
      statusOf({
        incidentId: 'incident-1',
        pausedAt: '2026-11-19T07:32:35Z',
        resumedAt: '2026-11-19T07:50:00Z',
      }),
    );
    const line = await screen.findByTestId('market-status-FUTURES');
    expect(line.textContent).toContain('Futures trading has reopened');
    await userEvent.click(
      within(line).getByRole('button', { name: 'Dismiss' }),
    );
    expect(screen.queryByTestId('market-status-FUTURES')).toBeNull();
  });
});

function Block({ symbol }: { symbol: string }) {
  return <p data-testid="block">{useTradingBlock('SPOT', symbol) ?? 'open'}</p>;
}

describe('trading block and reference price (D-158)', () => {
  it('blocks a closed market, and only the lost pairs of an open one', async () => {
    await renderRoutes(
      [page('/', <Block symbol="ethusdt" />)],
      '/',
      undefined,
      {
        marketStatus: fakeService(statusOf({}, { pausedPairs: ['ETHUSDT'] })),
      },
    );
    expect(
      await screen.findByText(/Data for ETHUSDT is unavailable/),
    ).toBeTruthy();
  });

  it('blocks every pair of a paused market', async () => {
    await renderRoutes(
      [page('/', <Block symbol="BTCUSDT" />)],
      '/',
      undefined,
      {
        marketStatus: fakeService(statusOf({}, { ...PAUSED, market: 'SPOT' })),
      },
    );
    expect(await screen.findByText(/Spot trading is paused/)).toBeTruthy();
  });

  it('shows the reference price with its source and a divergence warning while the market is lost', async () => {
    await renderRoutes(
      [page('/', <ReferencePriceNote market="FUTURES" symbol="BTCUSDT" />)],
      '/',
      undefined,
      { marketStatus: fakeService(statusOf(PAUSED)) },
    );
    const note = await screen.findByTestId('reference-price');
    await waitFor(() => expect(note.textContent).toContain('70,000'));
    expect(note.textContent).toContain('Source: OKX (reference)');
    expect(note.textContent).toContain('may differ markedly');
  });
});

describe('market health console (D-158)', () => {
  it('starts maintenance with the message, and reopens a recovering market by hand after confirming', async () => {
    const recovering = statusOf({
      ...PAUSED,
      state: 'RECOVERING',
      recovery: { pairsDone: 1, pairsTotal: 2 },
    });
    const maintenance = vi.fn(async () => recovering);
    const resume = vi.fn(async () => ALL_LIVE);
    await renderRoutes(
      [page('/admin/market-health', <AdminMarketHealthPage />)],
      '/admin/market-health',
      undefined,
      {
        marketStatus: fakeService(
          statusOf({
            ...PAUSED,
            state: 'RECOVERING',
            recovery: { pairsDone: 1, pairsTotal: 2 },
          }),
          { maintenance, resume },
        ),
      },
    );
    const spot = await screen.findByTestId('market-health-SPOT');
    await userEvent.type(
      within(spot).getByLabelText('Message for the Traders'),
      'Deploying',
    );
    await userEvent.click(
      within(spot).getByRole('button', { name: 'Start maintenance' }),
    );
    expect(maintenance).toHaveBeenCalledWith({
      market: 'SPOT',
      on: true,
      message: 'Deploying',
    });

    const futures = await screen.findByTestId('market-health-FUTURES');
    await waitFor(() =>
      expect(
        within(futures).getByRole('button', { name: 'Reopen by hand' }),
      ).toBeTruthy(),
    );
    expect(
      within(spot).queryByRole('button', { name: 'Reopen by hand' }),
    ).toBeNull();
    await userEvent.click(
      within(futures).getByRole('button', { name: 'Reopen by hand' }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Reopen by hand' }),
    );
    expect(resume).toHaveBeenCalledWith('FUTURES');
    expect(await screen.findAllByText('No incident yet.')).toHaveLength(2);
  });
});
