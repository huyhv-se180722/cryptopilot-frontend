import { useEffect, useState } from 'react';
import { ColorType } from 'lightweight-charts';

/** A design token's current value, so charts follow the light and dark themes. */
export function token(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** Chart options shared by the CryptoPilot charts, from the theme tokens. */
export function chartOptions() {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: token('--cp-muted'),
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 11,
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
