// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DisclaimerFooter } from './DisclaimerFooter';

describe('DisclaimerFooter', () => {
  it('shows MSG42 and the chart library attribution with its link', () => {
    render(<DisclaimerFooter />);
    expect(
      screen.getByText(
        'Information on CryptoPilot is for reference and education only and is not investment advice.',
      ),
    ).toBeTruthy();
    // Lightweight Charts licence: the NOTICE and a link to tradingview.com.
    const credit = screen.getByRole('link', {
      name: 'Charts by TradingView Lightweight Charts™',
    });
    expect(credit.getAttribute('href')).toBe('https://www.tradingview.com/');
    expect(credit.getAttribute('rel')).toContain('noopener');
    expect(
      screen.getByText('© TradingView, Inc.', { exact: false }),
    ).toBeTruthy();
  });
});
