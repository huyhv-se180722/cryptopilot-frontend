// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDevelopmentPaperTrading } from '../../dev/dev-paper-trading';
import { DEV_PAIR_IDS } from '../../dev/fixtures/market';
import { TradeSpotPage } from '../../pages/trader/TradeSpotPage';
import { ServiceError } from '../../services/api/errors';
import type {
  MarketFeed,
  MarketService,
  TradingMarketService,
  WatchlistService,
} from '../../services/api/contracts';
import type {
  MarketPair,
  MarketTicker,
  OrderBook,
  WatchlistItem,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

vi.mock('lightweight-charts', () => ({
  createSeriesMarkers: () => ({ setMarkers: vi.fn() }),
  CandlestickSeries: { name: 'candles' },
  LineSeries: { name: 'line' },
  HistogramSeries: { name: 'histogram' },
  ColorType: { Solid: 'solid' },
  createChart: () => ({
    addSeries: () => ({
      setData: vi.fn(),
      priceScale: () => ({ applyOptions: vi.fn() }),
      priceToCoordinate: vi.fn(() => null),
      createPriceLine: vi.fn(),
      removePriceLine: vi.fn(),
    }),
    panes: () => [0, 1, 2, 3].map(() => ({ setStretchFactor: vi.fn() })),
    timeScale: () => ({
      fitContent: vi.fn(),
      getVisibleLogicalRange: () => null,
      setVisibleLogicalRange: vi.fn(),
      subscribeVisibleLogicalRangeChange: vi.fn(),
      unsubscribeVisibleLogicalRangeChange: vi.fn(),
    }),
    remove: vi.fn(),
  }),
}));

// jsdom has no modal dialog; the component only needs open/close.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const pair = (symbol: string, base: string, order: number): MarketPair => ({
  pairId: DEV_PAIR_IDS[symbol] as string,
  symbol,
  market: 'spot',
  baseAsset: base,
  quoteAsset: 'USDT',
  baseAssetName: base,
  logoUrl: null,
  tickSize: '0.01',
  stepSize: '0.00001',
  minNotional: '5',
  displayOrder: order,
});
const PAIRS = [pair('BTCUSDT', 'BTC', 1), pair('ETHUSDT', 'ETH', 2)];

const ticker = (symbol: string, lastPrice: string) =>
  ({
    market: 'spot',
    symbol,
    sourceTime: new Date().toISOString(),
    lastPrice,
  }) as MarketTicker;

const BOOK: OrderBook = {
  market: 'spot',
  symbol: 'BTCUSDT',
  lastUpdateId: 1,
  receivedAt: '2026-10-13T00:00:00Z',
  bids: [{ price: '59990.00', quantity: '0.5' }],
  asks: [{ price: '60010.00', quantity: '0.5' }],
};

async function open(path = '/trade/spot/BTCUSDT', pairs = PAIRS) {
  const prices: Record<string, string> = { BTCUSDT: '60000', ETHUSDT: '2500' };
  const market: MarketService = {
    listPairs: vi.fn(async () => pairs),
    getCandles: vi.fn(async () => []),
    getFuturesMetrics: vi.fn(),
    getTicker: vi.fn(async (_m, symbol) =>
      ticker(symbol, prices[symbol] ?? '1'),
    ),
  };
  const marketFeed: MarketFeed = {
    status: () => 'open',
    onStatus: () => () => undefined,
    subscribeOverview: () => () => undefined,
    subscribeKline: () => () => undefined,
    subscribeTicker: (_m, symbol, listener) => {
      queueMicrotask(() => listener(ticker(symbol, prices[symbol] ?? '1')));
      return () => undefined;
    },
  };
  const watched: WatchlistItem = {
    id: 'w-1',
    pairId: DEV_PAIR_IDS.BTCUSDT!,
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
  const tradingMarket: TradingMarketService = {
    getDepth: vi.fn(async () => BOOK),
    getTrades: vi.fn(async () => []),
    subscribeDepth: () => () => undefined,
    subscribeTrades: () => () => undefined,
  };
  const { paperTrading } = createDevelopmentPaperTrading(
    async () => testTrader,
    market,
  );
  await renderRoutes(
    [page('/trade/spot/:symbol', <TradeSpotPage />)],
    path,
    fakeAuth({ restoreSession: async () => testTrader }),
    { market, marketFeed, watchlist, tradingMarket, paperTrading },
  );
  const form = await screen.findByRole('region', { name: 'Spot order' });
  // The account opens and the wallet arrives before trading.
  await waitFor(() => expect(within(form).getByText(/10,000/)).toBeTruthy());
  return { form, user: userEvent.setup(), paperTrading };
}

const field = (form: HTMLElement, name: RegExp) =>
  within(form).getByRole('textbox', { name });

describe('Spot demo orders (TR-F3)', () => {
  it('places a LIMIT buy that waits, lists it and locks its funds', async () => {
    const { form, user } = await open();
    await user.type(field(form, /^Price/), '59000');
    await user.type(field(form, /Amount/), '0.01');
    expect((field(form, /Total/) as HTMLInputElement).value).toBe('590.00');
    await user.click(within(form).getByRole('button', { name: 'Buy BTC' }));
    expect(await screen.findByText('Buy order open.')).toBeTruthy();
    const panel = screen.getByRole('region', { name: 'Orders and funds' });
    const openOrders = await within(panel).findByRole('region', {
      name: 'Open orders',
    });
    await waitFor(() =>
      expect(within(openOrders).getAllByRole('row')).toHaveLength(2),
    );
    expect(openOrders.textContent).toContain('59,000.00');
    await user.click(within(panel).getByRole('tab', { name: 'Funds' }));
    const funds = await within(panel).findByRole('region', { name: 'Funds' });
    await waitFor(() => expect(funds.textContent).toContain('9,410'));
    expect(funds.textContent).toContain('590');
  });

  it('groups the price by thousands and takes a comma typed as grouping', async () => {
    const { form, user } = await open();
    const price = field(form, /^Price/) as HTMLInputElement;
    await user.type(price, '59000');
    expect(price.value).toBe('59,000');
    await user.clear(price);
    await user.type(price, '59,000.5');
    expect(price.value).toBe('59,000.5');
    await user.type(field(form, /Amount/), '0.01');
    expect((field(form, /Total/) as HTMLInputElement).value).toBe('590.00');
    // A point is the decimal mark: "81.32" stays 81.32, plainly not 81,320.
    await user.clear(price);
    await user.type(price, '81.32');
    expect(price.value).toBe('81.32');
    expect((field(form, /Total/) as HTMLInputElement).value).toBe('0.81');
  });

  it('reads an amount typed with a decimal comma ("0,5") as 0.5', async () => {
    const { form, user } = await open();
    await user.type(field(form, /^Price/), '1000');
    await user.type(field(form, /Amount/), '0,5');
    expect((field(form, /Total/) as HTMLInputElement).value).toBe('500.00');
  });

  it('checks the order before sending it', async () => {
    const { form, user } = await open();
    await user.click(within(form).getByRole('button', { name: 'Buy BTC' }));
    expect(within(form).getAllByText('Enter a value.')).toHaveLength(2);
    await user.type(field(form, /^Price/), '60000');
    await user.type(field(form, /Amount/), '1');
    expect(
      within(form).getByText('Not enough available balance.'),
    ).toBeTruthy();
    await user.clear(field(form, /Amount/));
    await user.type(field(form, /Amount/), '0.00005');
    expect(
      within(form).getByText('The order value must be at least 5 USDT.'),
    ).toBeTruthy();
  });

  it('fills the amount from a share of the balance and fills a MARKET buy at once', async () => {
    const { form, user } = await open();
    await user.click(within(form).getByRole('radio', { name: 'Market' }));
    await user.click(within(form).getByRole('button', { name: '25%' }));
    // 25 % of 10,000 USDT at the last price 60,000, floored to the step.
    expect((field(form, /Amount/) as HTMLInputElement).value).toBe('0.04166');
    await user.click(within(form).getByRole('button', { name: 'Buy BTC' }));
    expect(await screen.findByText('Buy order filled.')).toBeTruthy();
    const panel = screen.getByRole('region', { name: 'Orders and funds' });
    await user.click(within(panel).getByRole('tab', { name: 'Trade history' }));
    const fills = await within(panel).findByRole('region', {
      name: 'Trade history',
    });
    await waitFor(() => expect(fills.textContent).toContain('Taker'));
    expect(fills.textContent).toContain('0.04166');
  });

  it('fills the amount from the share slider, which follows a typed amount', async () => {
    const { form, user } = await open();
    await user.type(field(form, /^Price/), '50000');
    const maxRow = () =>
      within(form)
        .getByText(/^Max (buy|sell)$/)
        .closest('p')?.textContent;
    // 10,000 USDT free at 50,000.
    expect(maxRow()).toContain('0.20000 BTC');
    const slider = within(form).getByRole('slider', {
      name: 'Share of the available balance',
    }) as HTMLInputElement;
    expect(slider.value).toBe('0');
    fireEvent.change(slider, { target: { value: '40' } });
    expect((field(form, /Amount/) as HTMLInputElement).value).toBe('0.08000');
    expect(slider.getAttribute('aria-valuetext')).toBe('40%');
    const half = within(form).getByRole('button', { name: '50%' });
    expect(half.getAttribute('aria-pressed')).toBe('false');
    await user.click(half);
    expect(half.getAttribute('aria-pressed')).toBe('true');
    expect(slider.value).toBe('50');
    // A typed amount moves the slider: 0.05 BTC × 50,000 = 25 % of the funds.
    await user.clear(field(form, /Amount/));
    await user.type(field(form, /Amount/), '0.05');
    expect(slider.value).toBe('25');
    expect(
      within(form)
        .getByRole('button', { name: '25%' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    // Back to 0 % empties the amount.
    fireEvent.change(slider, { target: { value: '0' } });
    expect((field(form, /Amount/) as HTMLInputElement).value).toBe('');
    // A sale shows what the free coin brings at the price.
    await user.click(within(form).getByRole('radio', { name: 'Sell' }));
    expect(maxRow()).toMatch(/Max sell.*USDT/);
  });

  it('shows the Buy and the Sell forms side by side on a wide screen, under one order type', async () => {
    vi.stubGlobal('matchMedia', (media: string) => ({
      matches: true,
      media,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    try {
      const { form, user } = await open();
      expect(within(form).queryByRole('radio', { name: 'Sell' })).toBeNull();
      const buying = within(form).getByRole('form', { name: 'Buy' });
      const selling = within(form).getByRole('form', { name: 'Sell' });
      await user.click(within(form).getByRole('radio', { name: 'Stop' }));
      expect(field(buying, /^Stop \(/)).toBeTruthy();
      expect(field(selling, /^Stop \(/)).toBeTruthy();
      await user.click(within(form).getByRole('radio', { name: 'Limit' }));
      await user.type(field(selling, /^Price/), '70000');
      await user.type(field(selling, /Amount/), '0.05');
      expect((field(buying, /Amount/) as HTMLInputElement).value).toBe('');
      await user.click(
        within(selling).getByRole('button', { name: 'Sell BTC' }),
      );
      expect(await screen.findByText('Sell order open.')).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('cancels an open order', async () => {
    const { form, user } = await open();
    await user.click(within(form).getByRole('radio', { name: 'Sell' }));
    await user.type(field(form, /^Price/), '70000');
    await user.type(field(form, /Amount/), '0.05');
    await user.click(within(form).getByRole('button', { name: 'Sell BTC' }));
    await screen.findByText('Sell order open.');
    const panel = screen.getByRole('region', { name: 'Orders and funds' });
    await user.click(
      await within(panel).findByRole('button', { name: /Cancel order/ }),
    );
    await waitFor(() =>
      expect(within(panel).getByText('No open orders.')).toBeTruthy(),
    );
  });

  it('has no time in force or post only on the form, as on the exchange Spot panel', async () => {
    const { form, user } = await open();
    expect(within(form).getByRole('checkbox', { name: 'TP/SL' })).toBeTruthy();
    expect(
      within(form).queryByRole('combobox', { name: 'Time in force' }),
    ).toBeNull();
    expect(
      within(form).queryByRole('checkbox', { name: 'Post only' }),
    ).toBeNull();
    await user.click(within(form).getByRole('radio', { name: 'Stop' }));
    expect(
      within(form).queryByRole('combobox', { name: 'Time in force' }),
    ).toBeNull();
  });

  it('shows a symbol filter refusal under its field and an open-order limit as a notice', async () => {
    const { form, user, paperTrading } = await open();
    const refusal = (status: number, code: string, messageArgs: string[]) =>
      new ServiceError('Refused.', 'HTTP_ERROR', status, {
        status,
        code,
        messageCode: status === 409 ? 'MSG43' : 'MSG15',
        messageArgs,
        fieldErrors: {},
      });
    vi.spyOn(paperTrading, 'placeOrder')
      .mockRejectedValueOnce(
        refusal(400, 'PAPER_PERCENT_PRICE', ['price', '30000', '48000', 'MIN']),
      )
      .mockRejectedValueOnce(
        refusal(409, 'PAPER_MAX_NUM_ORDERS', ['orders', '201', '200', 'MAX']),
      );
    await user.type(field(form, /^Price/), '30000');
    await user.type(field(form, /Amount/), '0.01');
    await user.click(within(form).getByRole('button', { name: 'Buy BTC' }));
    expect(
      await within(form).findByText(
        'Too far below the last price: enter at least 48,000.00.',
      ),
    ).toBeTruthy();
    expect(within(form).queryByText(/Something went wrong/)).toBeNull();
    await user.click(within(form).getByRole('button', { name: 'Buy BTC' }));
    expect(
      await within(form).findByText(
        'You can have at most 200 open orders on this pair. Cancel one first.',
      ),
    ).toBeTruthy();
  });

  it('places a Stop Limit as the exchange stop type, shown with its trigger', async () => {
    const { form, user } = await open();
    await user.click(within(form).getByRole('radio', { name: 'Stop' }));
    expect(
      (
        within(form).getByRole('combobox', {
          name: 'Stop order type',
        }) as HTMLSelectElement
      ).value,
    ).toBe('STOP_LIMIT');
    // At the last price the stop would trigger immediately.
    await user.type(field(form, /^Stop \(/), '60000');
    await user.type(field(form, /^Limit/), '60100');
    await user.type(field(form, /Amount/), '0.01');
    await user.click(within(form).getByRole('button', { name: 'Buy BTC' }));
    expect(
      within(form).getByText('The stop cannot be the last price.'),
    ).toBeTruthy();
    await user.clear(field(form, /^Stop \(/));
    await user.type(field(form, /^Stop \(/), '61000');
    await user.clear(field(form, /^Limit/));
    await user.type(field(form, /^Limit/), '61100');
    await user.click(within(form).getByRole('button', { name: 'Buy BTC' }));
    expect(await screen.findByText('Buy order open.')).toBeTruthy();
    const panel = screen.getByRole('region', { name: 'Orders and funds' });
    const openOrders = await within(panel).findByRole('region', {
      name: 'Open orders',
    });
    await waitFor(() => expect(openOrders.textContent).toContain('Stop limit'));
    expect(openOrders.textContent).toContain('61,000.00');
  });

  it('places a Trailing Stop with its delta', async () => {
    const { form, user } = await open();
    await user.click(within(form).getByRole('radio', { name: 'Sell' }));
    await user.click(within(form).getByRole('radio', { name: 'Stop' }));
    await user.selectOptions(
      within(form).getByRole('combobox', { name: 'Stop order type' }),
      'TRAILING',
    );
    await user.type(field(form, /Trailing delta/), '1');
    await user.type(field(form, /^Limit/), '58000');
    await user.type(field(form, /Amount/), '0.01');
    await user.click(within(form).getByRole('button', { name: 'Sell BTC' }));
    expect(await screen.findByText('Sell order open.')).toBeTruthy();
    const panel = screen.getByRole('region', { name: 'Orders and funds' });
    const openOrders = await within(panel).findByRole('region', {
      name: 'Open orders',
    });
    await waitFor(() =>
      expect(openOrders.textContent).toContain('1 % trailing'),
    );
  });

  it('places an OCO: a take profit and a stop on one quantity', async () => {
    const { form, user } = await open();
    await user.click(within(form).getByRole('radio', { name: 'Sell' }));
    await user.click(within(form).getByRole('radio', { name: 'Stop' }));
    await user.selectOptions(
      within(form).getByRole('combobox', { name: 'Stop order type' }),
      'OCO',
    );
    await user.type(field(form, /^Take profit/), '62000');
    await user.type(field(form, /^Stop \(/), '58000');
    await user.type(field(form, /Amount/), '0.01');
    await user.click(within(form).getByRole('button', { name: 'Sell BTC' }));
    expect(await screen.findByText('OCO placed.')).toBeTruthy();
    const panel = screen.getByRole('region', { name: 'Orders and funds' });
    const openOrders = await within(panel).findByRole('region', {
      name: 'Open orders',
    });
    await waitFor(() =>
      expect(within(openOrders).getAllByRole('row')).toHaveLength(3),
    );
    expect(openOrders.textContent).toContain('Limit maker');
    expect(openOrders.textContent).toContain('Stop loss');
  });

  it('sends an OCO again after a timeout with the same list key (Q-70)', async () => {
    const { form, user, paperTrading } = await open();
    const placeList = vi
      .spyOn(paperTrading, 'placeOrderList')
      .mockRejectedValueOnce(new ServiceError('Timed out.', 'TIMEOUT'));
    await user.click(within(form).getByRole('radio', { name: 'Sell' }));
    await user.click(within(form).getByRole('radio', { name: 'Stop' }));
    await user.selectOptions(
      within(form).getByRole('combobox', { name: 'Stop order type' }),
      'OCO',
    );
    await user.type(field(form, /^Take profit/), '62000');
    await user.type(field(form, /^Stop \(/), '58000');
    await user.type(field(form, /Amount/), '0.01');
    await user.click(within(form).getByRole('button', { name: 'Sell BTC' }));
    await waitFor(() => expect(placeList).toHaveBeenCalledTimes(1));
    await user.click(within(form).getByRole('button', { name: 'Sell BTC' }));
    expect(await screen.findByText('OCO placed.')).toBeTruthy();
    const [first, again] = placeList.mock.calls.map(([list]) => list);
    expect(first?.listClientOrderId).toMatch(/^web-/);
    expect(again?.listClientOrderId).toBe(first?.listClientOrderId);
  });

  it('places a limit with TP/SL as an OTOCO, its TP and SL pending', async () => {
    const { form, user } = await open();
    await user.type(field(form, /^Price/), '59000');
    await user.type(field(form, /Amount/), '0.01');
    await user.click(within(form).getByRole('checkbox', { name: 'TP/SL' }));
    await user.type(field(form, /^Take profit/), '63000');
    await user.type(field(form, /^Stop loss/), '57000');
    await user.click(within(form).getByRole('button', { name: 'Buy BTC' }));
    expect(await screen.findByText('OTOCO placed.')).toBeTruthy();
    const panel = screen.getByRole('region', { name: 'Orders and funds' });
    const openOrders = await within(panel).findByRole('region', {
      name: 'Open orders',
    });
    await waitFor(() =>
      expect(within(openOrders).getAllByRole('row')).toHaveLength(4),
    );
    expect(openOrders.textContent).toContain('Pending');
  });

  it('takes a price selected in the order book', async () => {
    const { form, user } = await open();
    await user.click(
      await screen.findByRole('button', { name: /^Bid 59,990.00/ }),
    );
    expect((field(form, /^Price/) as HTMLInputElement).value).toBe('59,990.00');
  });

  it('trades a pair off the watchlist by its market list id (FEQ-01)', async () => {
    const { form, user } = await open('/trade/spot/ETHUSDT');
    await user.type(field(form, /^Price/), '2400');
    await user.type(field(form, /Amount/), '0.1');
    await user.click(within(form).getByRole('button', { name: 'Buy ETH' }));
    expect(await screen.findByText('Buy order open.')).toBeTruthy();
  });

  it('transfers USDT to the Futures wallet', async () => {
    const { user } = await open();
    const panel = screen.getByRole('region', { name: 'Orders and funds' });
    await user.click(within(panel).getByRole('tab', { name: 'Funds' }));
    await user.click(
      await within(panel).findByRole('button', { name: 'Transfer' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Transfer USDT' });
    const amount = within(dialog).getByRole('textbox', {
      name: 'Amount (USDT)',
    }) as HTMLInputElement;
    // The free balance with two digits, grouped, without the stored zeros.
    expect(dialog.textContent).toContain('Available: 10,000.00 USDT');
    await user.click(within(dialog).getByRole('button', { name: 'Max' }));
    expect(amount.value).toBe('10,000');
    await user.clear(amount);
    // Typed with a grouping comma, the amount is read as 1,250.
    await user.type(amount, '1,250');
    expect(amount.value).toBe('1,250');
    await user.click(within(dialog).getByRole('button', { name: 'Transfer' }));
    expect(
      await screen.findByText('1,250 USDT moved to the futures wallet.'),
    ).toBeTruthy();
  });
});
