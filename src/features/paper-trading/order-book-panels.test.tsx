// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { integrationPending } from '../../services/api/errors';
import { ServiceError } from '../../services/api/errors';
import type { MarketStream } from '../market/hooks/use-order-book';
import type { MarketPair, MarketTrade, OrderBook } from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';
import { MarketTradesPanel } from './components/MarketTradesPanel';
import { OrderBookPanel } from './components/OrderBookPanel';

const PAIR: MarketPair = {
  symbol: 'BTCUSDT',
  market: 'spot',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  baseAssetName: 'Bitcoin',
  logoUrl: null,
  tickSize: '0.01',
  stepSize: '0.00001',
  displayOrder: 1,
};

const BOOK: OrderBook = {
  market: 'spot',
  symbol: 'BTCUSDT',
  lastUpdateId: 7,
  receivedAt: '2026-10-13T00:00:00Z',
  bids: [
    { price: '63000.00', quantity: '0.50000000' },
    { price: '62999.95', quantity: '0.25000000' },
    { price: '62999.90', quantity: '1.25000000' },
  ],
  asks: [
    { price: '63000.01', quantity: '0.10000000' },
    { price: '63000.06', quantity: '0.40000000' },
  ],
};

const stream = <T,>(value: T, extra: Partial<MarketStream<T>> = {}) => ({
  status: 'ready' as const,
  error: null,
  value,
  updatedAt: null,
  retry: vi.fn(),
  ...extra,
});

async function show(element: React.ReactElement) {
  await renderRoutes([page('/', element)], '/', fakeAuth());
}

describe('order book panel (TR-F2)', () => {
  it('lists asks above the last price and bids below, with spread and running totals', async () => {
    await show(
      <OrderBookPanel pair={PAIR} stream={stream(BOOK)} lastPrice="63000.00" />,
    );
    const panel = await screen.findByRole('region', { name: 'Order book' });
    const rows = within(panel)
      .getAllByRole('group')
      .map((row) => row.getAttribute('aria-label'));
    expect(rows).toEqual([
      'Ask 63,000.06, amount 0.40000',
      'Ask 63,000.01, amount 0.10000',
      'Bid 63,000.00, amount 0.50000',
      'Bid 62,999.95, amount 0.25000',
      'Bid 62,999.90, amount 1.25000',
    ]);
    expect(panel.textContent).toContain('Spread 0.01');
    // Bids 2.0 against asks 0.5 of the shown amount.
    expect(
      within(panel).getByRole('img', {
        name: 'Buy 80.00% · Sell 20.00% of the shown amount',
      }),
    ).toBeTruthy();
    expect(
      within(panel).getByRole('img', { name: 'Waiting for updates' }),
    ).toBeTruthy();
  });

  it('groups by a larger step and shows one side at a time', async () => {
    const user = userEvent.setup();
    await show(
      <OrderBookPanel pair={PAIR} stream={stream(BOOK)} lastPrice={null} />,
    );
    const panel = await screen.findByRole('region', { name: 'Order book' });
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Price group' }),
      '0.1',
    );
    const labels = () =>
      within(panel)
        .getAllByRole('group')
        .map((row) => row.getAttribute('aria-label'));
    // Asks round up, bids round down; 62999.95 and 62999.90 share 62999.9.
    expect(labels()).toEqual([
      'Ask 63,000.1, amount 0.50000',
      'Bid 63,000.0, amount 0.50000',
      'Bid 62,999.9, amount 1.50000',
    ]);
    await user.click(within(panel).getByRole('radio', { name: 'Bids only' }));
    expect(labels().every((label) => label?.startsWith('Bid'))).toBe(true);
    await user.click(within(panel).getByRole('radio', { name: 'Asks only' }));
    expect(labels().every((label) => label?.startsWith('Ask'))).toBe(true);
  });

  it('hands a selected price to the order form when there is one', async () => {
    const onPickPrice = vi.fn();
    const user = userEvent.setup();
    await show(
      <OrderBookPanel
        pair={PAIR}
        stream={stream(BOOK)}
        lastPrice={null}
        onPickPrice={onPickPrice}
      />,
    );
    await user.click(
      await screen.findByRole('button', {
        name: 'Bid 62,999.95, amount 0.25000',
      }),
    );
    expect(onPickPrice).toHaveBeenCalledWith('62999.95');
  });

  it('says when depth is not connected yet and when no book is held', async () => {
    let error: unknown;
    try {
      integrationPending();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ServiceError);
    await show(
      <>
        <OrderBookPanel
          pair={PAIR}
          stream={stream<OrderBook | null>(null, { status: 'error', error })}
          lastPrice={null}
        />
        <MarketTradesPanel
          pair={PAIR}
          stream={stream<readonly MarketTrade[]>([])}
        />
      </>,
    );
    expect(
      (await screen.findByRole('region', { name: 'Order book' })).textContent,
    ).toContain('not connected to the server yet');
    expect(
      screen.getByRole('region', { name: 'Market trades' }).textContent,
    ).toContain('No trades yet.');
  });
});

describe('market trades panel (TR-F2)', () => {
  it('lists the trades with the taker side as an arrow and the amount at the step', async () => {
    const trades: MarketTrade[] = [
      {
        id: 2,
        price: '63000.01',
        quantity: '0.01234000',
        time: '2026-10-13T00:00:02Z',
        buyerMaker: false,
      },
      {
        id: 1,
        price: '62999.99',
        quantity: '0.50000000',
        time: '2026-10-13T00:00:01Z',
        buyerMaker: true,
      },
    ];
    await show(<MarketTradesPanel pair={PAIR} stream={stream(trades)} />);
    const panel = await screen.findByRole('region', { name: 'Market trades' });
    expect(
      within(panel)
        .getAllByRole('group')
        .map((row) => row.getAttribute('aria-label')),
    ).toEqual(['Buy 63,000.01', 'Sell 62,999.99']);
    expect(within(panel).getByRole('img', { name: 'Buy' })).toBeTruthy();
    expect(within(panel).getByRole('img', { name: 'Sell' })).toBeTruthy();
    expect(panel.textContent).toContain('0.01234');
  });
});
