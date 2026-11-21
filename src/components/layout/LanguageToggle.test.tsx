// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppLocaleProvider } from '../../app/providers/AppLocaleProvider';
import { useCopy } from '../../hooks/use-copy';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale-preference';
import { LanguageToggle } from './LanguageToggle';

function Title() {
  return <h1>{useCopy().billing.historyTitle}</h1>;
}

const app = () =>
  render(
    <AppLocaleProvider>
      <LanguageToggle />
      <Title />
    </AppLocaleProvider>,
  );

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('LanguageToggle', () => {
  it('starts in Vietnamese', () => {
    app();
    expect(screen.getByRole('heading').textContent).toBe('Lịch sử thanh toán');
    expect(
      screen.getByRole('radio', { name: 'VI' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(document.documentElement.lang).toBe('vi');
  });

  it('switches to English and remembers it on this device', async () => {
    app();
    await userEvent.setup().click(screen.getByRole('radio', { name: 'EN' }));
    expect(screen.getByRole('heading').textContent).toBe('Payment history');
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    cleanup();
    app();
    expect(screen.getByRole('heading').textContent).toBe('Payment history');
  });

  it('is not shown outside the app language provider', () => {
    render(
      <I18nProvider>
        <LanguageToggle />
      </I18nProvider>,
    );
    expect(screen.queryByRole('radiogroup')).toBe(null);
  });
});
