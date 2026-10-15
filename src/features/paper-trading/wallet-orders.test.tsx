// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDevelopmentPaperTrading } from '../../dev/dev-paper-trading';
import { DEV_PAIR_IDS } from '../../dev/fixtures/watchlist';
import { TradeOrdersPage } from '../../pages/trader/TradeOrdersPage';
import { TradeWalletPage } from '../../pages/trader/TradeWalletPage';
import type {
  MarketService,
  WatchlistService,
} from '../../services/api/contracts';
import type {
  MarketPair,
  MarketTicker,
  WatchlistItem,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

// jsdom has no modal dialog; the component only needs open/close.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const BTC: MarketPair = {
  symbol: 'BTCUSDT',
  market: 'spot',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  baseAssetName: 'Bitcoin',
  logoUrl: null,
  tickSize: '0.01',
  stepSize: '0.00001',
  minNotional: '5',
  displayOrder: 1,
};
const PRICES: Record<string, string> = {
  BTCUSDT: '60000',
  ETHUSDT: '2500',
  BNBUSDT: '580',
};
const BTC_ID = DEV_PAIR_IDS.BTCUSDT!;

async function setup(
  element: React.ReactElement,
  path: string,
  pairs: readonly MarketPair[] = [BTC],
) {
  const market: MarketService = {
    listPairs: vi.fn(async () => pairs),
    getCandles: vi.fn(async () => []),
    getFuturesMetrics: vi.fn(),
    getTicker: vi.fn(
      async (_m, symbol) =>
        ({ lastPrice: PRICES[symbol] ?? '1' }) as MarketTicker,
    ),
  };
  const watched: WatchlistItem = {
    id: 'w-1',
    pairId: BTC_ID,
    symbol: 'BTCUSDT',
    spotListed: true,
    futuresListed: true,
    label: null,
    note: null,
    sortOrder: 0,
    activeAlerts: 0,
    addedAt: '2026-10-01T00:00:00Z',
  };
  const watchlist: WatchlistService = {
    get: vi.fn(async () => ({ items: [watched], limit: null })),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const { paperTrading } = createDevelopmentPaperTrading(
    async () => testTrader,
    market,
  );
  await paperTrading.openAccount();
  await renderRoutes(
    [page(path, element)],
    path,
    fakeAuth({ restoreSession: async () => testTrader }),
    { market, watchlist, paperTrading },
  );
  return { paperTrading, user: userEvent.setup() };
}

describe('Demo wallet page (TR-F3)', () => {
  it('shows the estimated balance, each wallet and the coins', async () => {
    const { user } = await setup(<TradeWalletPage />, '/trade/wallet');
    // Spot 10,000 + 0.1 × 60,000 + 1 × 2,500 + 10 × 580; Futures 5,000.
    await waitFor(() =>
      expect(
        screen.getByText('Estimated balance').parentElement?.textContent,
      ).toContain('29,300.00 USDT'),
    );
    expect(screen.getByText(/0\.48833333 BTC/)).toBeTruthy();
    const spot = await screen.findByRole('region', { name: 'Spot wallet' });
    expect(within(spot).getAllByRole('row')).toHaveLength(5);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search coin' }),
      'et',
    );
    expect(within(spot).getAllByRole('row')).toHaveLength(2);
    expect(
      screen.getByRole('navigation', { name: 'Demo trading' }),
    ).toBeTruthy();
  });

  it('lists the transaction history with signed changes and filters it', async () => {
    const { paperTrading, user } = await setup(
      <TradeWalletPage />,
      '/trade/wallet',
    );
    await paperTrading.transfer({
      asset: 'USDT',
      from: 'SPOT',
      amount: '100',
      clientTransferId: 't-1',
    });
    await user.click(
      await screen.findByRole('tab', { name: 'Transaction history' }),
    );
    const ledger = await screen.findByRole('region', {
      name: 'Transaction history',
    });
    await waitFor(() => expect(ledger.textContent).toContain('-100'));
    expect(ledger.textContent).toContain('+100');
    expect(ledger.textContent).toContain('Initial grant');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Type' }),
      'TRANSFER',
    );
    await waitFor(() =>
      expect(within(ledger).getAllByRole('row')).toHaveLength(3),
    );
    await user.click(screen.getByRole('tab', { name: 'Transfers' }));
    const transfers = await screen.findByRole('region', { name: 'Transfers' });
    await waitFor(() => expect(transfers.textContent).toContain('100'));
  });
});

describe('Demo orders page (TR-F3)', () => {
  it('lists open orders, cancels one and shows the history by status', async () => {
    const { paperTrading, user } = await setup(
      <TradeOrdersPage />,
      '/trade/orders',
    );
    await paperTrading.placeOrder({
      pairId: BTC_ID,
      market: 'spot',
      side: 'BUY',
      type: 'LIMIT',
      price: '50000',
      quantity: '0.01',
      clientOrderId: 'o-1',
    });
    await paperTrading.placeOrder({
      pairId: BTC_ID,
      market: 'spot',
      side: 'BUY',
      type: 'MARKET',
      quantity: '0.01',
      clientOrderId: 'o-2',
    });
    const open = await screen.findByRole('region', { name: 'Open orders' });
    await waitFor(() =>
      expect(within(open).getAllByRole('row')).toHaveLength(2),
    );
    await user.click(
      within(open).getByRole('button', { name: /Cancel order/ }),
    );
    await waitFor(() => expect(open.textContent).toContain('No open orders.'));
    await user.click(screen.getByRole('tab', { name: 'Order history' }));
    const history = await screen.findByRole('region', {
      name: 'Order history',
    });
    await waitFor(() =>
      expect(within(history).getAllByRole('row')).toHaveLength(3),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Status' }),
      'FILLED',
    );
    await waitFor(() =>
      expect(within(history).getAllByRole('row')).toHaveLength(2),
    );
    await user.click(screen.getByRole('tab', { name: 'Trade history' }));
    const fills = await screen.findByRole('region', { name: 'Trade history' });
    await waitFor(() => expect(fills.textContent).toContain('Taker'));
  });

  it('offers only pairs with an id from the watchlist (FEQ-01)', async () => {
    await setup(<TradeOrdersPage />, '/trade/orders');
    const select = await screen.findByRole('combobox', { name: 'Pair' });
    await waitFor(() =>
      expect(
        within(select)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['All', 'BTCUSDT']),
    );
    expect(screen.getByText(/Only pairs on your watchlist/)).toBeTruthy();
  });

  it('offers every Spot pair whose id the market list gives (FEQ-01)', async () => {
    const ETH: MarketPair = {
      ...BTC,
      pairId: DEV_PAIR_IDS.ETHUSDT!,
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      baseAssetName: 'Ethereum',
      displayOrder: 2,
    };
    await setup(<TradeOrdersPage />, '/trade/orders', [
      { ...BTC, pairId: BTC_ID },
      ETH,
    ]);
    const select = await screen.findByRole('combobox', { name: 'Pair' });
    await waitFor(() =>
      expect(
        within(select)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['All', 'BTCUSDT', 'ETHUSDT']),
    );
    expect(screen.queryByText(/Only pairs on your watchlist/)).toBeNull();
  });
});
