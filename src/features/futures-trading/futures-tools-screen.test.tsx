// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TradeOrdersPage } from '../../pages/trader/TradeOrdersPage';
import { ServiceError } from '../../services/api/errors';
import {
  createPendingFuturesTradingService,
  type FuturesTradingService,
} from '../../services/api/futures';
import type { MarketService } from '../../services/api/contracts';
import type { MarketPair } from '../../types/domain';
import type { FuturesCalculation, FuturesOrder } from '../../types/futures';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';
import { AmendOrderDialog } from './components/AmendOrderDialog';
import { FuturesCalculatorDialog } from './components/FuturesCalculatorDialog';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const ORDER: FuturesOrder = {
  orderId: 'o-1',
  clientOrderId: 'c-1',
  symbol: 'BTCUSDT',
  status: 'PARTIALLY_FILLED',
  statusReason: null,
  type: 'LIMIT',
  side: 'BUY',
  positionSide: 'BOTH',
  timeInForce: 'GTC',
  price: '60000',
  avgPrice: '60000',
  origQty: '0.5',
  executedQty: '0.1',
  cumQuote: '6000',
  reduceOnly: false,
  closePosition: false,
  goodTillDate: null,
  time: '2026-11-04T00:00:00Z',
  updateTime: '2026-11-04T00:00:00Z',
};

const EMPTY: FuturesCalculation = {
  initialMargin: null,
  pnl: null,
  roe: null,
  targetPrice: null,
  liquidationPrice: null,
  walletBalance: null,
  maxQuantity: null,
  maxNotional: null,
  maxPositionAtLeverage: null,
  openPrice: null,
  quantity: null,
};

function futures(change: Partial<FuturesTradingService>) {
  return { ...createPendingFuturesTradingService(), ...change };
}

const show = (element: React.ReactElement, service: FuturesTradingService) =>
  renderRoutes(
    [page('/', element)],
    '/',
    fakeAuth({ restoreSession: async () => testTrader }),
    { futuresTrading: service },
  );

describe('editing a waiting Futures order (TR-17)', () => {
  it('sends the new price and quantity of the same order', async () => {
    const amendOrder = vi.fn(async () => ({ ...ORDER, price: '59000' }));
    const onClose = vi.fn();
    await show(
      <AmendOrderDialog order={ORDER} onClose={onClose} />,
      futures({ amendOrder }),
    );
    const user = userEvent.setup();
    expect(
      await screen.findByText('Buy limit order, 0.1 of 0.5 filled.'),
    ).toBeTruthy();
    const price = screen.getByLabelText('Price (USDT)');
    await user.clear(price);
    await user.type(price, '59000');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(amendOrder).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        orderId: 'o-1',
        side: 'BUY',
        price: '59000',
        quantity: '0.5',
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('keeps the quantity above what filled and refuses no change', async () => {
    const amendOrder = vi.fn();
    await show(
      <AmendOrderDialog order={ORDER} onClose={() => undefined} />,
      futures({ amendOrder }),
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(
      await screen.findByText('The order already has this price and quantity.'),
    ).toBeTruthy();
    const quantity = screen.getByLabelText('Quantity');
    await user.clear(quantity);
    await user.type(quantity, '0.1');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(
      await screen.findByText(
        'The quantity must stay above what has filled (0.1).',
      ),
    ).toBeTruthy();
    expect(amendOrder).not.toHaveBeenCalled();
  });

  it("says why the server refused, in the reader's words", async () => {
    const amendOrder = vi.fn(async () => {
      throw new ServiceError('refused', 'HTTP_ERROR', 409, {
        code: 'PAPER_ORDER_UNCHANGED',
        messageArgs: [],
      } as never);
    });
    await show(
      <AmendOrderDialog
        order={{ ...ORDER, executedQty: '0' }}
        onClose={() => undefined}
      />,
      futures({ amendOrder }),
    );
    const user = userEvent.setup();
    const quantity = await screen.findByLabelText('Quantity');
    await user.clear(quantity);
    await user.type(quantity, '0.4');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(
      await screen.findByText('The order already has this price and quantity.'),
    ).toBeTruthy();
  });
});

describe('Futures calculator (TR-44)', () => {
  const open = (calculate: FuturesTradingService['calculate']) =>
    show(
      <FuturesCalculatorDialog
        symbol="BTCUSDT"
        tickSize="0.1"
        leverage={20}
        maxLeverage={125}
        walletBalance="1000"
        lastPrice="60000"
        onClose={() => undefined}
      />,
      futures({ calculate }),
    );

  it('works out the PnL and ROI of a position', async () => {
    const calculate = vi.fn(async () => ({
      ...EMPTY,
      initialMargin: '1500',
      pnl: '3000',
      roe: '200',
    }));
    await open(calculate);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Exit price (USDT)'), '66000');
    await user.type(screen.getByLabelText('Quantity'), '0.5');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));
    await waitFor(() =>
      expect(calculate).toHaveBeenCalledWith('pnl', {
        symbol: 'BTCUSDT',
        side: 'LONG',
        leverage: 20,
        entryPrice: '60000',
        exitPrice: '66000',
        quantity: '0.5',
      }),
    );
    const result = await screen.findByLabelText('Result');
    expect(result.textContent).toContain('1,500.00 USDT');
    expect(result.textContent).toContain('+3,000.00 USDT');
    expect(result.textContent).toContain('+200.00%');
  });

  it('asks for the fields a tab needs before calling', async () => {
    const calculate = vi.fn();
    await open(calculate);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('radio', { name: 'Target price' }),
    );
    await user.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(await screen.findByText('Required.')).toBeTruthy();
    expect(calculate).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Target ROI (%)'), '-50');
    await user.click(screen.getByRole('radio', { name: 'Short' }));
    await user.click(screen.getByRole('button', { name: 'Calculate' }));
    await waitFor(() =>
      expect(calculate).toHaveBeenCalledWith('target', {
        symbol: 'BTCUSDT',
        side: 'SHORT',
        leverage: 20,
        entryPrice: '60000',
        roe: '-50',
      }),
    );
  });

  it('averages the open price of several parts', async () => {
    const calculate = vi.fn(async () => ({
      ...EMPTY,
      openPrice: '62500',
      quantity: '2',
    }));
    await open(calculate);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: 'Open price' }));
    await user.type(screen.getByLabelText('Price 1'), '60000');
    await user.type(screen.getByLabelText('Quantity 1'), '1');
    await user.type(screen.getByLabelText('Price 2'), '65000');
    await user.type(screen.getByLabelText('Quantity 2'), '1');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));
    const result = await screen.findByLabelText('Result');
    expect(result.textContent).toContain('62,500.0 USDT');
    expect(calculate).toHaveBeenCalledWith('openPrice', {
      symbol: 'BTCUSDT',
      lots: [
        { price: '60000', quantity: '1' },
        { price: '65000', quantity: '1' },
      ],
    });
  });
});

describe('demo orders page, Futures side', () => {
  it('opens for a Trader on any plan, Free included', async () => {
    const BTC: MarketPair = {
      pairId: 'p-btc',
      symbol: 'BTCUSDT',
      market: 'futures',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      baseAssetName: 'Bitcoin',
      logoUrl: null,
      tickSize: '0.1',
      stepSize: '0.001',
      minNotional: '5',
      displayOrder: 1,
    };
    const market = {
      listPairs: vi.fn(async () => [BTC]),
      getCandles: vi.fn(async () => []),
      getFuturesMetrics: vi.fn(),
      getTicker: vi.fn(async () => null),
    } as unknown as MarketService;
    await renderRoutes(
      [page('/trade/orders', <TradeOrdersPage />)],
      '/trade/orders?market=futures',
      fakeAuth({
        restoreSession: async () => ({
          ...testTrader,
          entitlements: { tier: 'FREE', features: [], limits: {} },
        }),
      }),
      { market, futuresTrading: futures({}) },
    );
    expect(
      await screen.findByRole('combobox', { name: 'Pair' }),
    ).toHaveProperty('value', 'BTCUSDT');
    expect(screen.getByText('Positions and orders')).toBeTruthy();
    expect(screen.queryByText(/part of PRO/)).toBeNull();
    expect(
      screen
        .getByRole('radio', { name: 'Futures' })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });
});
