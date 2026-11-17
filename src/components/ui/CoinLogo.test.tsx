// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoinLogo } from './CoinLogo';

describe('CoinLogo', () => {
  it('shows the logo when there is one', () => {
    const { container } = render(
      <CoinLogo src="https://img.example/btc.png" symbol="BTC" />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://img.example/btc.png',
    );
  });

  it('falls back to the first two letters without a logo', () => {
    render(<CoinLogo src={null} symbol="ETH" />);
    expect(screen.getByTestId('coin-logo').dataset.letters).toBe('ET');
    expect(screen.getByTestId('coin-logo').textContent).toBe('');
  });

  it('falls back to the letters when the image fails to load', () => {
    const { container } = render(
      <CoinLogo src="https://img.example/broken.png" symbol="SOL" />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('coin-logo').dataset.letters).toBe('SO');
  });
});
