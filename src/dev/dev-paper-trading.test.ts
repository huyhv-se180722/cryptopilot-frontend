import { describe, expect, it } from 'vitest';
import type { Session } from '../types/domain';
import { createDevelopmentPaperTrading } from './dev-paper-trading';

describe('development demo trading (TR-04 answers)', () => {
  it('opens the account once and returns it afterwards', async () => {
    const session = { user: { id: 'u-1' } } as unknown as Session;
    const { paperTrading } = createDevelopmentPaperTrading(
      async () => session,
      () => Date.UTC(2026, 9, 13),
    );
    const first = await paperTrading.openAccount();
    expect(first).toEqual({
      accountId: 'dev-paper-account-1',
      positionMode: 'one-way',
      openedAt: '2026-10-13T00:00:00.000Z',
    });
    expect(await paperTrading.openAccount()).toBe(first);
  });

  it('answers MSG44 without a session', async () => {
    const { paperTrading } = createDevelopmentPaperTrading(async () => null);
    await expect(paperTrading.openAccount()).rejects.toMatchObject({
      status: 401,
      problem: { messageCode: 'MSG44' },
    });
  });
});
