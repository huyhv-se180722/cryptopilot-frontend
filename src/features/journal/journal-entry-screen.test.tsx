// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceError } from '../../services/api/errors';
import type { JournalEntry } from '../../types/domain';
import {
  ENTRY_TRADE,
  SIMULATED_ENTRY,
  fakeJournal,
  openEntry,
} from '../../test/journal';

describe('SCR-21 journal entry (T-052)', () => {
  it('shows the facts, what the trade teaches with the MSG55 warning, and the review', async () => {
    const journal = fakeJournal();
    await openEntry(journal);
    expect(
      await screen.findByRole('heading', { name: 'BTC/USDT · Futures' }),
    ).toBeTruthy();
    expect(journal.get).toHaveBeenCalledWith('j-1', expect.anything());
    expect(screen.getByText('Win')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Open the plan' }).getAttribute('href'),
    ).toBe('/plans/plan-1');
    // D-97: realized, fees, funding and net apart.
    expect(screen.getByText('Funding').parentElement?.textContent).toContain(
      '-1.50 USDT',
    );
    expect(screen.getByText('Net P/L').parentElement?.textContent).toContain(
      '+292.40 USDT',
    );
    expect(screen.getByRole('status').textContent).toBe(
      'BTC/USDT entry filled with a setup score of 55, down from 72 when planned.',
    );
    expect(
      screen.getByText('Entry deviation').closest('div')?.textContent,
    ).toContain('0.05 R');
    expect(
      screen.getByText('Setup score').closest('div')?.textContent,
    ).toContain('72 at plan · 55 at fill');
    expect(screen.getByText('Filled as').closest('div')?.textContent).toContain(
      'Taker',
    );
    expect(
      screen.getByText('R multiple').closest('div')?.textContent,
    ).toContain('+2.92 R');
    expect(screen.getByText('Strategy:').textContent).toContain('Breakout');
    expect(screen.getByText('Moved the stop.')).toBeTruthy();
    expect(screen.queryByText('Lessons learned')).toBeNull();
  });

  it('shows a manual trade without learning data, its review empty', async () => {
    await openEntry(
      fakeJournal({
        ...SIMULATED_ENTRY,
        trade: { ...ENTRY_TRADE, source: 'MANUAL', planId: null },
        strategyId: null,
        strategyName: null,
        setupDescription: null,
        mistakes: null,
        learning: null,
      }),
    );
    await screen.findByRole('heading', { name: 'BTC/USDT · Futures' });
    expect(screen.queryByText('What the trade teaches')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open the plan' })).toBeNull();
    expect(screen.getByText('No review yet.')).toBeTruthy();
  });

  it('answers a trade that is not the caller’s with MSG41', async () => {
    await openEntry(
      fakeJournal(async () => {
        throw new ServiceError('Not found', 'HTTP_ERROR', 404, {
          status: 404,
          code: 'RESOURCE_NOT_FOUND',
          messageCode: 'MSG41',
          messageArgs: [],
          fieldErrors: {},
        });
      }),
    );
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('No results found.')).toBeTruthy();
  });

  describe('review (UC-23)', () => {
    const KEY =
      'cryptopilot/journal/01a18806-f703-7786-8f90-8c7c34ce23e8/0b6f2f0e-1d2c-4c5b-9a8e-7f6e5d4c3b2a';
    const withImage: JournalEntry = {
      ...SIMULATED_ENTRY,
      chartImageUrl:
        'https://res.cloudinary.com/d/image/upload/v1/' + KEY + '.png',
      chartImageKey: KEY,
    };

    it('sends the whole review again, keeping the strategy and the image', async () => {
      const user = userEvent.setup();
      const journal = fakeJournal(withImage);
      await openEntry(journal);
      await user.click(
        await screen.findByRole('button', { name: 'Edit review' }),
      );
      const strategy = screen.getByLabelText('Strategy') as HTMLSelectElement;
      await waitFor(() => expect(strategy.value).toBe('s-1'));
      await user.type(screen.getByLabelText('Lessons learned'), 'Wait.');
      expect(screen.getByText('5 / 4000')).toBeTruthy();
      const reads = vi.mocked(journal.get).mock.calls.length;
      await user.click(screen.getByRole('button', { name: 'Save review' }));
      await waitFor(() =>
        expect(journal.review).toHaveBeenCalledWith('j-1', {
          strategyId: 's-1',
          setupDescription: 'Rejected at the weekly level.',
          lessonsLearned: 'Wait.',
          mistakes: 'Moved the stop.',
          chartImageKey: KEY,
        }),
      );
      expect(await screen.findByText('Saved successfully.')).toBeTruthy();
      // The answer is the new state: the trade is not read again.
      expect(journal.get).toHaveBeenCalledTimes(reads);
      expect(screen.queryByRole('button', { name: 'Save review' })).toBeNull();
      expect(screen.getByText('Wait.')).toBeTruthy();
    });

    it('clears a text left blank and a strategy taken off', async () => {
      const user = userEvent.setup();
      const journal = fakeJournal();
      await openEntry(journal);
      await user.click(
        await screen.findByRole('button', { name: 'Edit review' }),
      );
      await user.clear(screen.getByLabelText('Mistakes'));
      await user.type(screen.getByLabelText('Setup'), '   ');
      await user.selectOptions(screen.getByLabelText('Strategy'), '');
      await user.click(screen.getByRole('button', { name: 'Save review' }));
      await waitFor(() =>
        expect(journal.review).toHaveBeenCalledWith(
          'j-1',
          expect.objectContaining({ strategyId: null, mistakes: null }),
        ),
      );
    });

    it('keeps a review read only when its image key cannot be read back (Q-97)', async () => {
      await openEntry(
        fakeJournal({
          ...SIMULATED_ENTRY,
          chartImageUrl: 'https://cdn.example.com/chart.png',
          chartImageKey: null,
        }),
      );
      await screen.findByRole('heading', { name: 'BTC/USDT · Futures' });
      expect(screen.queryByRole('button', { name: 'Edit review' })).toBeNull();
      expect(
        screen.getByText(/chart image this page cannot keep/),
      ).toBeTruthy();
    });

    it('shows a text the server refuses under its field (MSG15)', async () => {
      const user = userEvent.setup();
      const journal = fakeJournal();
      vi.mocked(journal.review).mockRejectedValueOnce(
        new ServiceError('Invalid', 'HTTP_ERROR', 400, {
          status: 400,
          code: 'VALIDATION_FAILED',
          messageCode: 'MSG01',
          messageArgs: [],
          fieldErrors: { lessonsLearned: 'MSG15' },
        }),
      );
      await openEntry(journal);
      await user.click(
        await screen.findByRole('button', { name: 'Edit review' }),
      );
      await user.click(screen.getByRole('button', { name: 'Save review' }));
      expect(
        await screen.findByText(
          'Lessons learned must be between 0 and 4,000 characters.',
        ),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Save review' })).toBeTruthy();
    });

    it('uploads a new chart image and attaches it with the review', async () => {
      const user = userEvent.setup();
      const journal = fakeJournal();
      vi.mocked(journal.uploadChartImage).mockImplementation(
        async (_id, _file, onProgress) => {
          onProgress?.(0.5);
          return 'cryptopilot/journal/u/new-key';
        },
      );
      await openEntry(journal);
      await user.click(
        await screen.findByRole('button', { name: 'Edit review' }),
      );
      const file = new File(['png'], 'chart.png', { type: 'image/png' });
      await user.upload(screen.getByLabelText('Chart image'), file);
      expect(journal.uploadChartImage).toHaveBeenCalledWith(
        'j-1',
        file,
        expect.any(Function),
      );
      expect(
        await screen.findByText('Uploaded. Save the review to attach it.'),
      ).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Save review' }));
      await waitFor(() =>
        expect(journal.review).toHaveBeenCalledWith(
          'j-1',
          expect.objectContaining({
            chartImageKey: 'cryptopilot/journal/u/new-key',
          }),
        ),
      );
    });

    it('removes the chart image with the review', async () => {
      const user = userEvent.setup();
      const journal = fakeJournal(withImage);
      await openEntry(journal);
      await user.click(
        await screen.findByRole('button', { name: 'Edit review' }),
      );
      await user.click(screen.getByRole('button', { name: 'Remove image' }));
      expect(
        screen.getByText('The image is removed when you save the review.'),
      ).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Save review' }));
      await waitFor(() =>
        expect(journal.review).toHaveBeenCalledWith(
          'j-1',
          expect.objectContaining({ chartImageKey: null }),
        ),
      );
    });

    it('shows MSG32 when the file is refused, keeping the review as it was', async () => {
      const user = userEvent.setup();
      const journal = fakeJournal(withImage);
      vi.mocked(journal.uploadChartImage).mockRejectedValue(
        new ServiceError('Refused', 'HTTP_ERROR', 400, {
          status: 400,
          code: 'MEDIA_INVALID',
          messageCode: 'MSG32',
          messageArgs: ['5 MB'],
          fieldErrors: {},
        }),
      );
      await openEntry(journal);
      await user.click(
        await screen.findByRole('button', { name: 'Edit review' }),
      );
      await user.upload(
        screen.getByLabelText('Chart image'),
        new File(['x'], 'chart.png', { type: 'image/png' }),
      );
      expect((await screen.findByRole('alert')).textContent).toBe(
        'File type or size is not supported (maximum 5 MB).',
      );
      await user.click(screen.getByRole('button', { name: 'Save review' }));
      await waitFor(() =>
        expect(journal.review).toHaveBeenCalledWith(
          'j-1',
          expect.objectContaining({ chartImageKey: KEY }),
        ),
      );
    });
  });
});
