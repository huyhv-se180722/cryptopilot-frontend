import { useEffect, useState } from 'react';
import { ColorType } from 'lightweight-charts';
import type { Locale } from '../../../i18n/copy';

/** A design token's current value, so charts follow the light and dark themes. */
export function token(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/**
 * Chart options shared by the CryptoPilot charts, from the theme tokens.
 * Month names on the time axis and in the crosshair follow the interface's
 * locale: left alone, the chart library takes the browser's, and a
 * Vietnamese browser showed "Tháng 8" among English copy.
 */
export function chartOptions(locale: Locale) {
  return {
    autoSize: true,
    localization: { locale },
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: token('--cp-muted'),
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 11,
      // The licence's attribution and link are in the shell footer.
      attributionLogo: false,
      panes: { separatorColor: token('--cp-border') },
    },
    grid: {
      vertLines: { color: token('--cp-border') },
      horzLines: { color: token('--cp-border') },
    },
    rightPriceScale: { borderColor: token('--cp-border') },
    timeScale: {
      borderColor: token('--cp-border'),
      timeVisible: true,
      secondsVisible: false,
    },
  };
}

/** Changes whenever the theme switches, so a chart can be rebuilt with the new colours. */
export function useThemeVersion() {
  const [theme, setTheme] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme((value) => value + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}
