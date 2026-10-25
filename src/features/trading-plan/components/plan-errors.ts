import { formatCopy } from '../../../i18n/copy';
import type { Copy } from '../../../i18n/locales/en';
import { errorText, fieldErrorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import { decodeEntryDeviation } from '../../../services/api/trading-plan-dto';
import type {
  EntryDeviation,
  PlanDirection,
  TradingPlan,
} from '../../../types/domain';
import { planRatio } from './plan-format';
import {
  serverFieldError,
  type PlanField,
  type PlanFieldError,
} from './plan-form';

/** The MSG51 / MSG52 refusal of a MARKET activation, or null (TP-C). */
export const entryDeviationOf = (error: unknown): EntryDeviation | null =>
  decodeEntryDeviation(problemOf(error));

/** MSG52 in words; a take profit already reached says so plainly. */
export function entryDeviationRefusedText(
  copy: Copy,
  deviation: Extract<EntryDeviation, { kind: 'refused' }>,
): string {
  if (deviation.takeProfitReached) return copy.plan.deviationPastTarget;
  return messageText(copy, 'MSG52', [], {
    deviation: planRatio(deviation.deviationR),
    max: planRatio(deviation.maxDeviationR),
  });
}

/** A plan field error in words; MSG16 fills its rule itself (M-11). */
export function planFieldErrorText(
  copy: Copy,
  error: PlanFieldError,
  label: string,
  direction: PlanDirection,
): string {
  const p = copy.plan;
  switch (error.kind) {
    case 'required':
      return fieldErrorText(copy, 'MSG01', label);
    case 'number':
      return formatCopy(p.errNumber, { field: label });
    case 'positive':
      return formatCopy(p.errPositive, { field: label });
    case 'range':
      return messageText(copy, 'MSG15', [], {
        field: label,
        min: error.min,
        max: error.max,
      });
    case 'leverage':
      return formatCopy(p.errLeverage, { field: label });
    case 'leverageMax':
      return p.errLeverageMax;
    case 'order':
      return messageText(copy, 'MSG16', [], {
        direction: p[`directionName${direction}`],
        rule: p[`rule${direction}`],
      });
    case 'levels':
      return messageText(copy, 'MSG16', [], {
        direction: p[`directionName${direction}`],
        rule: p[`ruleLevels${direction}`],
      });
    case 'future':
      return p.errFuture;
    case 'tooLong':
      return formatCopy(p.errTooLong, { field: label, max: error.max });
    case 'deviation':
      return formatCopy(p.errDeviation, { field: label, max: error.max });
    case 'invalidationSide':
      return messageText(copy, 'MSG16', [], {
        direction: p[`directionName${direction}`],
        rule: p.ruleInvalidation,
      });
    case 'stopReached':
      return messageText(copy, 'MSG16', [], {
        direction: p[`directionName${direction}`],
        rule: p[`ruleStop${direction}`],
      });
  }
}

/** The label of each request field, as SCR-17 names it. */
function fieldLabel(copy: Copy, field: PlanField, plan: TradingPlan) {
  const p = copy.plan;
  switch (field) {
    case 'entryPrice':
      return plan.entryType === 'STOP' ? p.stopEntryPrice : p.entryPrice;
    case 'stopLoss':
      return p.stopLoss;
    case 'takeProfit':
      return p.takeProfit;
    case 'capital':
      return p.capital;
    case 'riskPercent':
      return p.riskPercent;
    case 'leverage':
      return p.leverage;
    case 'expiresAt':
      return p.expiryField;
    case 'note':
      return p.note;
    case 'invalidationPrice':
      return p.invalidationPrice;
    case 'maxEntryDeviationR':
      return p.maxDeviation;
    case 'analysisTimeframe':
      return p.timeframeField;
    case 'direction':
      return p.directionField;
  }
}

const PLAN_FIELDS = new Set<string>([
  'direction',
  'entryPrice',
  'stopLoss',
  'takeProfit',
  'capital',
  'riskPercent',
  'leverage',
  'expiresAt',
  'note',
  'invalidationPrice',
  'maxEntryDeviationR',
  'analysisTimeframe',
]);
const isPlanField = (name: string): name is PlanField => PLAN_FIELDS.has(name);

/**
 * Why the server refused to activate a plan outside the form (SCR-16,
 * SCR-18): a field it no longer accepts in words (e.g. a STOP the price has
 * reached, an invalidation price now on the wrong side, a MARKET price past
 * the stop; D-112), a profile without a default capital (D-121), the
 * current price missing (503), else the general text.
 */
export function activationErrorText(
  copy: Copy,
  error: unknown,
  plan: TradingPlan,
): string {
  const problem = problemOf(error);
  if (problem?.code === 'MARKET_PRICE_UNAVAILABLE')
    return copy.plan.priceUnavailable;
  const deviation = entryDeviationOf(error);
  if (deviation?.kind === 'refused')
    return entryDeviationRefusedText(copy, deviation);
  const field = Object.entries(problem?.fieldErrors ?? {}).find(([name]) =>
    isPlanField(name),
  );
  if (field) {
    const [name, messageId] = field as [PlanField, string];
    if (name === 'capital') return copy.plan.capitalMissing;
    return planFieldErrorText(
      copy,
      serverFieldError(name, messageId),
      fieldLabel(copy, name, plan),
      plan.direction,
    );
  }
  return errorText(copy, error);
}
