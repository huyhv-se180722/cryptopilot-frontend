import { describe, expect, it } from 'vitest';
import { createDevelopmentAdminSettings } from '../../../dev/dev-admin-settings';
import { saveInTurn } from './use-admin-settings';

describe('saving settings in turn', () => {
  it('sends a value refused only for the order once more after the other', async () => {
    const service = createDevelopmentAdminSettings();
    const outcome = await saveInTurn(service, [
      { key: 'ENTRY_DEVIATION_CONFIRM_R', value: '0.9' },
      { key: 'ENTRY_DEVIATION_BLOCK_R', value: '1.2' },
    ]);
    expect(outcome.refused).toEqual([]);
    expect(outcome.saved.map((s) => [s.key, s.value])).toEqual([
      ['ENTRY_DEVIATION_BLOCK_R', '1.2'],
      ['ENTRY_DEVIATION_CONFIRM_R', '0.9'],
    ]);
  });

  it('keeps the refused ones with their error and the rest saved', async () => {
    const service = createDevelopmentAdminSettings();
    const outcome = await saveInTurn(service, [
      { key: 'SPOT_TAKER_FEE', value: '0.123456789' },
      { key: 'MAX_IMAGES_PER_POST', value: '6' },
    ]);
    expect(outcome.saved.map((s) => s.key)).toEqual(['MAX_IMAGES_PER_POST']);
    expect(outcome.refused).toHaveLength(1);
    expect(outcome.refused[0]).toMatchObject({
      key: 'SPOT_TAKER_FEE',
      error: { problem: { fieldErrors: { value: 'MSG15' } } },
    });
  });
});
