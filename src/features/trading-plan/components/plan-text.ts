import { formatCopy } from '../../../i18n/copy';
import type { Copy } from '../../../i18n/locales/en';
import type { PlanWarning } from '../../../types/domain';
import { fractionToPercent } from '../../../utils/decimal-format';

/**
 * A warning in the client's words (the server's sentence is for
 * developers). HIGH_FEE_SHARE names the share of the risk when the
 * snapshot gives it; a type this client does not know names its code
 * (ADR-009).
 */
export function warningText(
  copy: Copy,
  warning: PlanWarning,
  feeShareOfRisk: string | null,
): string {
  const p = copy.plan;
  if (warning.type === 'UNKNOWN')
    return formatCopy(p.warningUNKNOWN, { type: warning.rawType ?? '?' });
  if (warning.type === 'HIGH_FEE_SHARE')
    return feeShareOfRisk === null
      ? p.warningHIGH_FEE_SHAREPlain
      : formatCopy(p.warningHIGH_FEE_SHARE, {
          share: fractionToPercent(feeShareOfRisk, 2),
        });
  return p[`warning${warning.type}`];
}
