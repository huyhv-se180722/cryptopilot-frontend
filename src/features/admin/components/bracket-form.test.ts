import { describe, expect, it } from 'vitest';
import { bracketInputs, floorsOf, rowsOf } from './bracket-form';

describe('bracket form (SCR-38, BR-26)', () => {
  it('starts each bracket at the cap before it and sends rates as fractions', () => {
    const rows = [
      { cap: '50000', leverage: '125', ratePercent: '0.4' },
      { cap: '600000', leverage: '100', ratePercent: '0.5' },
    ];
    expect(floorsOf(rows)).toEqual(['0', '50000']);
    expect(bracketInputs(rows)).toEqual({
      ok: true,
      inputs: [
        {
          notionalFloor: '0',
          notionalCap: '50000',
          maxLeverage: 125,
          maintenanceMarginRate: '0.004',
        },
        {
          notionalFloor: '50000',
          notionalCap: '600000',
          maxLeverage: 100,
          maintenanceMarginRate: '0.005',
        },
      ],
    });
  });

  it('names each refused cell as the server keys it', () => {
    expect(
      bracketInputs([
        { cap: '50000', leverage: '50', ratePercent: '0.4' },
        { cap: '40000', leverage: '75', ratePercent: '0' },
        { cap: '', leverage: '', ratePercent: '' },
      ]),
    ).toEqual({
      ok: false,
      errors: {
        'brackets[1].notionalCap': 'cap',
        'brackets[1].maxLeverage': 'leverage',
        'brackets[1].maintenanceMarginRate': 'rate',
        'brackets[2].notionalCap': 'required',
        'brackets[2].maxLeverage': 'required',
        'brackets[2].maintenanceMarginRate': 'required',
      },
    });
    expect(
      bracketInputs([{ cap: '1000', leverage: '126', ratePercent: '100' }]),
    ).toMatchObject({
      errors: {
        'brackets[0].maxLeverage': 'leverage',
        'brackets[0].maintenanceMarginRate': 'rate',
      },
    });
  });

  it('reads stored brackets without the scale padding, the rate in percent', () => {
    expect(
      rowsOf([
        {
          bracketNo: 1,
          notionalFloor: '0.00000000',
          notionalCap: '50000.00000000',
          maxLeverage: 125,
          maintenanceMarginRate: '0.00650000',
          maintenanceAmount: '0.00000000',
        },
      ]),
    ).toEqual([{ cap: '50000', leverage: '125', ratePercent: '0.65' }]);
  });
});
