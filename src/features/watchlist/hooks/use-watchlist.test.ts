import { describe, expect, it } from 'vitest';
import type { WatchlistItem } from '../../../types/domain';
import { reorderUpdates } from './use-watchlist';

const item = (id: string, sortOrder: number): WatchlistItem => ({
  id,
  pairId: 'pair-' + id,
  symbol: id.toUpperCase() + 'USDT',
  spotListed: true,
  futuresListed: false,
  label: null,
  note: null,
  sortOrder,
  activeAlerts: 0,
  addedAt: '2026-10-01T00:00:00Z',
});

describe('reorderUpdates', () => {
  it('patches only the rows whose position changed, numbered 0…n−1', () => {
    const rows = [item('a', 0), item('b', 1), item('c', 2), item('d', 3)];
    expect(reorderUpdates(rows, ['a', 'c', 'b', 'd'])).toEqual([
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
  });

  it('renumbers ties and gaps the server left', () => {
    const rows = [item('a', 0), item('b', 0), item('c', 7)];
    expect(reorderUpdates(rows, ['a', 'b', 'c'])).toEqual([
      { id: 'b', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ]);
  });
});
