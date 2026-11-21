// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { ReactNode } from 'react';
import { EmptyState, ErrorState } from './States';

function inEnglish(node: ReactNode) {
  return render(<I18nProvider locale="en">{node}</I18nProvider>);
}

describe('ErrorState (T-141)', () => {
  it('keeps the block with a heading by default', () => {
    inEnglish(<ErrorState message="News could not load." />);
    expect(screen.getByRole('alert').textContent).toContain(
      'News could not load.',
    );
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
  });

  it('draws one line without a heading inline and still offers a retry', () => {
    const retry = vi.fn();
    inEnglish(
      <ErrorState
        variant="inline"
        title="News unavailable."
        message="Try again later."
        onRetry={retry}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('News unavailable.');
    expect(alert.textContent).toContain('Try again later.');
    expect(screen.queryByRole('heading')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('EmptyState (T-141)', () => {
  it('keeps the block with a heading by default', () => {
    inEnglish(<EmptyState title="No plans yet" />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'No plans yet' }),
    ).toBeTruthy();
  });

  it('draws one line without a heading inline', () => {
    const { container } = inEnglish(
      <EmptyState
        variant="inline"
        title="No news"
        description="Nothing new for this coin."
        action={<button type="button">Open news</button>}
      />,
    );
    expect(screen.queryByRole('heading')).toBeNull();
    expect(container.textContent).toContain(
      'No news Nothing new for this coin.',
    );
    expect(screen.getByRole('button', { name: 'Open news' })).toBeTruthy();
  });
});
