import { describe, expect, it } from 'vitest';
import { createPendingPaperTradingService } from './paper-trading';

describe('demo trading service (D-86)', () => {
  it('is pending until the backend merges its paper module', async () => {
    await expect(
      createPendingPaperTradingService().openAccount(),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
