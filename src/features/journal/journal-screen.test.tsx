// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { JournalPage } from '../../pages/trader/JournalPage';
import type { JournalService } from '../../services/api/contracts';
import type { JournalTrade } from '../../types/domain';
import { page, renderRoutes } from '../../test/render';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

const TRADE: JournalTrade = {
  id: 'j-1',
  planId: 'plan-1',
  pairId: 'pair-1',
  market: 'futures',
  direction: 'SHORT',
  source: 'SIMULATED',
  status: 'CLOSED',
  leverage: 5,
  entryPrice: '100.000000000000',
  quantity: '2.000000000000',
  entryTime: '2026-10-20T08:00:00Z',
  entryFee: '0.10000000',
  stopLoss: '110.000000000000',
  takeProfit: '90.000000000000',
  exitPrice: '90.000000000000',
  exitTime: '2026-10-20T09:00:00Z',
  closeReason: 'TAKE_PROFIT',
  realizedPnl: '20.00000000',
  feeAmount: '0.21000000',
  fundingFeeAmount: '-0.50000000',
  netPnl: '19.29000000',
  provisional: true,
};

function service(items: readonly JournalTrade[] = [TRADE], total = 1) {
  return {
    list: vi.fn(async ({ page: number, pageSize }) => ({
      items,
      page: number,
      pageSize,
      total,
    })),
  } satisfies JournalService;
}

const open = (journal: JournalService, path = '/journal') =>
  renderRoutes([page('/journal', <JournalPage />)], path, undefined, {
    journal,
  });

describe('SCR-20 trading journal', () => {
  it('lists a trade with its net P/L and result', async () => {
    await open(service());
    const table = await screen.findByRole('table');
    expect(within(table).getByText(/\+19\.29 USDT/)).toBeTruthy();
    expect(within(table).getByText('Win')).toBeTruthy();
    expect(within(table).getByText('Simulated')).toBeTruthy();
  });

  it('sends the filters of the address and links the dashboard', async () => {
    const journal = service();
    await open(journal, '/journal?status=CLOSED&market=spot&pair=p-1&page=2');
    await screen.findByRole('table');
    expect(journal.list).toHaveBeenLastCalledWith(
      {
        page: 2,
        pageSize: 10,
        status: 'CLOSED',
        market: 'spot',
        pairId: 'p-1',
      },
      expect.anything(),
    );
    expect(
      screen.getByRole('link', { name: 'Performance' }).getAttribute('href'),
    ).toBe('/performance?market=spot&pair=p-1');
  });

  it('goes back to the first page on a new filter', async () => {
    const user = userEvent.setup();
    const journal = service();
    await open(journal, '/journal?page=3');
    await screen.findByRole('table');
    await user.selectOptions(screen.getByLabelText('Status'), 'OPEN');
    await waitFor(() =>
      expect(journal.list.mock.calls.at(-1)?.[0]).toMatchObject({
        page: 1,
        status: 'OPEN',
      }),
    );
  });

  it('answers an empty page with MSG41', async () => {
    await open(service([], 0));
    expect(await screen.findByText('No results found.')).toBeTruthy();
  });

  it('opens the facts of a row, keeping fees and funding apart', async () => {
    const user = userEvent.setup();
    await open(service());
    await user.click(await screen.findByRole('button', { name: /Open the/ }));
    const dialog = await screen.findByRole('dialog', { hidden: true });
    expect(
      within(dialog).getByText('Realized P/L').parentElement?.textContent,
    ).toContain('+20.00 USDT');
    expect(
      within(dialog).getByText('Funding').parentElement?.textContent,
    ).toContain('-0.50 USDT');
    expect(
      within(dialog)
        .getByRole('link', { name: 'Open the plan', hidden: true })
        .getAttribute('href'),
    ).toBe('/plans/plan-1');
  });
});
