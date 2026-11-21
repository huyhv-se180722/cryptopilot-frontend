// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoutes } from '../../test/render';
import { ThemeProvider } from '../providers/ThemeProvider';
import { TraderShell } from './TraderShell';

describe('TraderShell bottom room (T-141)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the footer clear of the dock and the AI button', async () => {
    vi.stubGlobal('matchMedia', (media: string) => ({
      matches: false,
      media,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    await renderRoutes(
      [
        {
          path: '/',
          element: (
            <ThemeProvider>
              <TraderShell />
            </ThemeProvider>
          ),
          children: [{ index: true, element: <p>Page</p> }],
        },
      ],
      '/',
    );
    const room = (await screen.findByRole('contentinfo')).parentElement;
    // below lg: dock + AI button reach 152 px; 144 px + the footer's 16 px
    expect(room?.className).toContain('pb-36');
    // from lg: the AI button reaches 80 px; 80 px + 16 px
    expect(room?.className).toContain('lg:pb-20');
    expect(room?.className).not.toContain('lg:pb-0');
  });
});
