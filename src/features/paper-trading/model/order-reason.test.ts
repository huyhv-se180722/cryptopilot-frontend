import { describe, expect, it } from 'vitest';
import { en } from '../../../i18n/locales/en';
import { orderReasonText } from './order-reason';

describe('order end reasons', () => {
  it('words the reasons the backend gives', () => {
    expect(orderReasonText(en, 'OCO_OTHER_EXECUTED')).toBe(
      'The other order of the OCO executed.',
    );
    expect(orderReasonText(en, 'PAIR_NOT_TRADING')).toBe(
      'Cancelled: the pair stopped trading on the exchange.',
    );
  });

  it('shows nothing for no reason or one it does not know', () => {
    expect(orderReasonText(en, null)).toBeUndefined();
    expect(orderReasonText(en, 'SOMETHING_NEW')).toBeUndefined();
  });
});
