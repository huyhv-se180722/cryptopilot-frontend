// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JournalEntryPage } from '../../pages/trader/JournalEntryPage';
import { JournalManualPage } from '../../pages/trader/JournalManualPage';
import { ServiceError } from '../../services/api/errors';
import type { JournalEntry, MarketPair } from '../../types/domain';
import { page, renderRoutes } from '../../test/render';
import {
  ENTRY_TRADE,
  SIMULATED_ENTRY,
  fakeJournal,
  fakeMarket,
} from '../../test/journal';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

const MANUAL: JournalEntry = {
  ...SIMULATED_ENTRY,
  trade: {
    ...ENTRY_TRADE,
    id: 'm-1',
    planId: null,
    source: 'MANUAL',
    status: 'OPEN',
    exitPrice: null,
    exitTime: null,
    closeReason: null,
    realizedPnl: null,
    feeAmount: null,
    fundingFeeAmount: null,
    netPnl: null,
  },
  learning: null,
};

const SPOT_PAIR: MarketPair = {
  pairId: 'pair-spot',
  symbol: 'ETHUSDT',
  market: 'spot',
  baseAsset: 'ETH',
  quoteAsset: 'USDT',
  baseAssetName: 'Ethereum',
  logoUrl: null,
  tickSize: '0.01',
  stepSize: '0.0001',
  minNotional: '5',
  displayOrder: 1,
};

function open(path: string, journal = fakeJournal(MANUAL)) {
  const market = fakeMarket();
  const futures = vi.mocked(market.listPairs).getMockImplementation();
  vi.mocked(market.listPairs).mockImplementation(async (kind) =>
    kind === 'spot' ? [SPOT_PAIR] : (futures?.(kind) ?? []),
  );
  return renderRoutes(
    [
      page('/journal', <p>journal list</p>),
      page('/journal/new', <JournalManualPage />),
      page('/journal/:entryId', <JournalEntryPage />),
    ],
    path,
    undefined,
    { journal, market },
  ).then(() => journal);
}

describe('SCR-22 record a manual trade (UC-24)', () => {
  it('records a Spot trade and opens it', async () => {
    const user = userEvent.setup();
    const journal = fakeJournal(MANUAL);
    vi.mocked(journal.record).mockResolvedValue(MANUAL);
    await open('/journal/new', journal);
    expect(
      await screen.findByRole('heading', { name: 'Record a manual trade' }),
    ).toBeTruthy();
    // Spot offers Long only.
    expect(screen.queryByRole('radio', { name: 'Short' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Record trade' }));
    expect(screen.getByText('The entry price field is required.')).toBeTruthy();
    expect(journal.record).not.toHaveBeenCalled();

    await user.selectOptions(await screen.findByLabelText('Pair'), 'pair-spot');
    await user.type(screen.getByLabelText('Entry price'), '2034.5');
    await user.type(screen.getByLabelText('Quantity'), '0.5');
    await user.type(screen.getByLabelText('Entry time'), '2026-11-20T08:00');
    await user.click(screen.getByRole('button', { name: 'Record trade' }));
    await waitFor(() =>
      expect(journal.record).toHaveBeenCalledWith(
        expect.objectContaining({
          pairId: 'pair-spot',
          market: 'spot',
          direction: 'LONG',
          leverage: null,
          entryPrice: '2034.5',
          quantity: '0.5',
          exitPrice: null,
        }),
      ),
    );
    expect(
      await screen.findByRole('heading', { name: 'BTC/USDT · Futures' }),
    ).toBeTruthy();
    expect(screen.getByText('Saved successfully.')).toBeTruthy();
  });

  it('shows a side the server refuses under its field (MSG16)', async () => {
    const user = userEvent.setup();
    const journal = fakeJournal(MANUAL);
    vi.mocked(journal.edit).mockRejectedValue(
      new ServiceError('Invalid', 'HTTP_ERROR', 400, {
        status: 400,
        code: 'VALIDATION_FAILED',
        messageCode: 'MSG16',
        messageArgs: [],
        fieldErrors: { takeProfit: 'MSG16' },
      }),
    );
    await open('/journal/new?edit=m-1', journal);
    expect(
      await screen.findByRole('heading', { name: 'Edit a manual trade' }),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText('Entry price') as HTMLInputElement).value,
    ).toBe('62,000');
    await user.click(screen.getByRole('button', { name: 'Save trade' }));
    await waitFor(() =>
      expect(journal.edit).toHaveBeenCalledWith(
        'm-1',
        expect.objectContaining({ direction: 'SHORT', leverage: 5 }),
      ),
    );
    expect(
      await screen.findByText(
        'For short positions: take profit < entry price < stop loss.',
      ),
    ).toBeTruthy();
  });

  it('does not edit a simulated trade (BR-40)', async () => {
    await open('/journal/new?edit=j-1', fakeJournal(SIMULATED_ENTRY));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Only a manual trade can be edited.',
    );
    expect(screen.queryByRole('button', { name: 'Save trade' })).toBeNull();
  });

  it('deletes a manual trade from its page after confirmation', async () => {
    const user = userEvent.setup();
    const journal = fakeJournal(MANUAL);
    vi.mocked(journal.remove).mockResolvedValue(undefined);
    await open('/journal/m-1', journal);
    expect(
      (await screen.findByRole('link', { name: 'Edit trade' })).getAttribute(
        'href',
      ),
    ).toBe('/journal/new?edit=m-1');
    await user.click(screen.getByRole('button', { name: 'Delete trade' }));
    expect(journal.remove).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'Delete', hidden: true }),
    );
    await waitFor(() => expect(journal.remove).toHaveBeenCalledWith('m-1'));
    expect(await screen.findByText('journal list')).toBeTruthy();
  });

  it('offers no edit or delete on a simulated trade', async () => {
    await open('/journal/j-1', fakeJournal(SIMULATED_ENTRY));
    await screen.findByRole('heading', { name: 'BTC/USDT · Futures' });
    expect(screen.queryByRole('link', { name: 'Edit trade' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete trade' })).toBeNull();
  });
});
