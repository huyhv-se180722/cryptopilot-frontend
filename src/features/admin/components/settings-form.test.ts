import { describe, expect, it } from 'vitest';
import type { SystemSetting } from '../../../types/domain';
import {
  changesOf,
  checkDraft,
  checkValue,
  groupSettings,
  shownValue,
} from './settings-form';

const setting = (
  key: string,
  value: string,
  valueType: SystemSetting['valueType'] = 'DECIMAL',
  min: string | null = '0',
  max: string | null = '10',
): SystemSetting => ({
  key,
  value,
  valueType,
  description: key,
  min,
  max,
  updatedBy: null,
  updatedAt: '2026-01-01T00:00:00Z',
});

const FEE = setting('SPOT_TAKER_FEE', '0.00100000', 'DECIMAL', '0', '0.1');
const IMAGES = setting('MAX_IMAGES_PER_POST', '4', 'INT', '1', '10');
const CONFIRM = setting('ENTRY_DEVIATION_CONFIRM_R', '0.25000000');
const BLOCK = setting('ENTRY_DEVIATION_BLOCK_R', '0.75000000');
const NEW = setting('SOMETHING_NEW', 'abc', 'STRING', null, null);

describe('SCR-43 settings form', () => {
  it('groups the settings in screen order and puts unknown keys last', () => {
    const groups = groupSettings([NEW, IMAGES, BLOCK, CONFIRM, FEE]);
    expect(groups.map((g) => g.group)).toEqual([
      'fees',
      'planWarnings',
      'uploads',
      'other',
    ]);
    expect(groups[1]?.settings.map((s) => s.key)).toEqual([
      'ENTRY_DEVIATION_CONFIRM_R',
      'ENTRY_DEVIATION_BLOCK_R',
    ]);
  });

  it('shows a decimal without its padding and checks type and range', () => {
    expect(shownValue(FEE)).toBe('0.001');
    expect(checkValue(FEE, ' ')).toEqual({ kind: 'required' });
    expect(checkValue(FEE, '1e-3')).toEqual({ kind: 'number' });
    expect(checkValue(FEE, '0.2')).toEqual({
      kind: 'range',
      min: '0',
      max: '0.1',
    });
    expect(checkValue(IMAGES, '4.5')).toEqual({ kind: 'whole' });
    expect(checkValue(IMAGES, '10')).toBeNull();
    expect(checkValue(NEW, 'anything')).toBeNull();
  });

  it('lists only real changes: 0.0010 is the saved 0.00100000', () => {
    const all = [FEE, IMAGES, CONFIRM];
    expect(changesOf(all, { SPOT_TAKER_FEE: '0.0010' })).toEqual([]);
    expect(
      changesOf(all, { SPOT_TAKER_FEE: '0.00075', MAX_IMAGES_PER_POST: '4' }),
    ).toEqual([{ setting: FEE, value: '0.00075' }]);
  });

  it('keeps the confirmation deviation at most the refused one (BR-69)', () => {
    const all = [CONFIRM, BLOCK];
    expect(checkDraft(all, { ENTRY_DEVIATION_CONFIRM_R: '0.9' })).toEqual({
      ENTRY_DEVIATION_CONFIRM_R: {
        kind: 'order',
        bound: 'atMost',
        other: 'ENTRY_DEVIATION_BLOCK_R',
        value: '0.75',
      },
    });
    expect(checkDraft(all, { ENTRY_DEVIATION_BLOCK_R: '0.1' })).toEqual({
      ENTRY_DEVIATION_BLOCK_R: {
        kind: 'order',
        bound: 'atLeast',
        other: 'ENTRY_DEVIATION_CONFIRM_R',
        value: '0.25',
      },
    });
    expect(
      checkDraft(all, {
        ENTRY_DEVIATION_CONFIRM_R: '0.9',
        ENTRY_DEVIATION_BLOCK_R: '1.2',
      }),
    ).toEqual({});
  });
});
