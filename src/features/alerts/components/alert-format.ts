import type { Copy } from '../../../i18n/locales/en';
import type { AlertRule } from '../../../types/domain';
import { groupThousands, trimDecimal } from '../../../utils/decimal-format';

/**
 * The rule in words for SCR-13 and the delete confirmation, e.g.
 * "Crosses above 65,000.00", "RSI (14) 4h · Less than 30",
 * "EMA 20 crosses above EMA 50 · 1h". Thresholds drop the scale padding.
 */
export function conditionText(copy: Copy, rule: AlertRule): string {
  const a = copy.alerts;
  const value = rule.threshold
    ? groupThousands(trimDecimal(rule.threshold, rule.type === 'PRICE' ? 2 : 0))
    : '';
  const condition = a[`condition${rule.condition}`];
  if (rule.type === 'PRICE') return `${condition} ${value}`;
  const indicator = rule.indicator;
  if (indicator === 'MACD_CROSS' || indicator === 'EMA_CROSS') {
    const direction = rule.condition === 'CROSS_BELOW' ? 'BELOW' : 'ABOVE';
    return `${a[`cross${indicator}_${direction}`]}${rule.timeframe ? ` · ${rule.timeframe}` : ''}`;
  }
  if (indicator === 'OPEN_INTEREST_CHANGE')
    return `${a.indicatorOPEN_INTEREST_CHANGE} · ${condition} ${value}%`;
  // Stored and shown in percent (Q-30).
  if (indicator === 'FUNDING_RATE' && rule.threshold)
    return `${a.indicatorFUNDING_RATE} · ${condition} ${trimDecimal(rule.threshold, 0)}%`;
  const name = indicator ? a[`indicator${indicator}`] : '';
  return `${name}${rule.timeframe ? ` ${rule.timeframe}` : ''} · ${condition} ${value}`;
}
