import type {
  RiskProfile,
  RiskProfileParams,
  RiskQuestion,
  RiskSuggestion,
  TradingStyle,
  UserProfile,
} from '../../types/domain';

/**
 * Runtime decoders for the `/me/*` contract (fe-guide modules/user.md,
 * checked against `develop` @ 0d92def). Decimals stay strings.
 */
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected an object');
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(name + ' must be a non-empty string');
  return value;
}
function nullableText(value: unknown, name: string): string | null {
  return value === null || value === undefined ? null : text(value, name);
}
function decimal(value: unknown, name: string): string {
  const raw = text(value, name);
  if (!/^-?\d+(\.\d+)?$/.test(raw))
    throw new Error(name + ' must be a decimal');
  return raw;
}
function nullableDecimal(value: unknown, name: string): string | null {
  return value === null || value === undefined ? null : decimal(value, name);
}
function bool(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(name + ' must be a boolean');
  return value;
}
function integer(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value))
    throw new Error(name + ' must be an integer');
  return value;
}
function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  name: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T))
    throw new Error(name + ' is not an allowed value');
  return value as T;
}

export const TRADING_STYLES: readonly TradingStyle[] = [
  'SCALPING',
  'DAY',
  'SWING',
  'POSITION',
];
export const RISK_PROFILES: readonly RiskProfile[] = [
  'CONSERVATIVE',
  'BALANCED',
  'AGGRESSIVE',
];

export function decodeProfile(body: unknown): UserProfile {
  const value = record(body);
  return {
    email: text(value.email, 'email'),
    displayName: text(value.displayName, 'displayName'),
    avatarUrl: nullableText(value.avatarUrl, 'avatarUrl'),
    defaultCapital: nullableDecimal(value.defaultCapital, 'defaultCapital'),
    defaultRiskPercent: nullableDecimal(
      value.defaultRiskPercent,
      'defaultRiskPercent',
    ),
    tradingStyle:
      value.tradingStyle === null || value.tradingStyle === undefined
        ? null
        : oneOf(value.tradingStyle, TRADING_STYLES, 'tradingStyle'),
    riskProfile: oneOf(value.riskProfile, RISK_PROFILES, 'riskProfile'),
    notifyEmail: bool(value.notifyEmail, 'notifyEmail'),
    notifyPush: bool(value.notifyPush, 'notifyPush'),
  };
}

export function decodeRiskProfile(body: unknown): RiskProfileParams {
  const value = record(body);
  return {
    riskProfile: oneOf(value.riskProfile, RISK_PROFILES, 'riskProfile'),
    riskPerTradePercent: decimal(
      value.riskPerTradePercent,
      'riskPerTradePercent',
    ),
    maxFuturesLeverage: integer(value.maxFuturesLeverage, 'maxFuturesLeverage'),
    maxTotalOpenRiskPercent: decimal(
      value.maxTotalOpenRiskPercent,
      'maxTotalOpenRiskPercent',
    ),
  };
}

export function decodeQuestionnaire(body: unknown): readonly RiskQuestion[] {
  const questions = record(body).questions;
  if (!Array.isArray(questions) || questions.length === 0)
    throw new Error('questions must be a non-empty array');
  return questions.map((raw) => {
    const question = record(raw);
    const options = question.options;
    if (!Array.isArray(options) || options.length === 0)
      throw new Error('options must be a non-empty array');
    return {
      code: text(question.code, 'code'),
      group: oneOf(question.group, ['CAPACITY', 'ATTITUDE'] as const, 'group'),
      text: text(question.text, 'text'),
      options: options.map((option) => {
        const value = record(option);
        return {
          code: text(value.code, 'option code'),
          text: text(value.text, 'option text'),
        };
      }),
    };
  });
}

export function decodeSuggestion(body: unknown): RiskSuggestion {
  const value = record(body);
  return {
    capacityScore: integer(value.capacityScore, 'capacityScore'),
    attitudeScore: integer(value.attitudeScore, 'attitudeScore'),
    suggestedProfile: oneOf(
      value.suggestedProfile,
      RISK_PROFILES,
      'suggestedProfile',
    ),
  };
}

/** Writes answer `{ messageCode }`; the caller shows MSG14 itself. */
export function decodeSaved(body: unknown): void {
  text(record(body).messageCode, 'messageCode');
}
