import type {
  RiskProfile,
  RiskProfileParams,
  RiskQuestion,
  RiskSuggestion,
  UserProfile,
} from '../../types/domain';

/**
 * DEVELOPMENT ONLY. A labelled profile for building SCR-07 without the
 * backend. Risk parameters are the BR-66 configuration values; the
 * questionnaire texts are placeholders, not the Technical Design wording.
 */
export const devProfile: UserProfile = {
  email: 'trader.pro@dev.local',
  displayName: 'Dev Trader (fixture)',
  avatarUrl: null,
  defaultCapital: '1000',
  defaultRiskPercent: '0.5',
  tradingStyle: 'SWING',
  riskProfile: 'CONSERVATIVE',
  notifyEmail: true,
  notifyPush: false,
};

export const devRiskParams: Readonly<Record<RiskProfile, RiskProfileParams>> = {
  CONSERVATIVE: {
    riskProfile: 'CONSERVATIVE',
    riskPerTradePercent: '0.5',
    maxFuturesLeverage: 3,
    maxTotalOpenRiskPercent: '2',
  },
  BALANCED: {
    riskProfile: 'BALANCED',
    riskPerTradePercent: '1',
    maxFuturesLeverage: 5,
    maxTotalOpenRiskPercent: '4',
  },
  AGGRESSIVE: {
    riskProfile: 'AGGRESSIVE',
    riskPerTradePercent: '2',
    maxFuturesLeverage: 10,
    maxTotalOpenRiskPercent: '6',
  },
};

const options = [
  { code: 'LOW', text: 'Development option A (fixture)' },
  { code: 'MEDIUM', text: 'Development option B (fixture)' },
  { code: 'HIGH', text: 'Development option C (fixture)' },
];
const question = (n: number, group: RiskQuestion['group']): RiskQuestion => ({
  code: 'DEV_' + group + '_' + n,
  group,
  text: 'Development ' + group.toLowerCase() + ' question ' + n + ' (fixture)',
  options,
});

export const devQuestionnaire: readonly RiskQuestion[] = [
  question(1, 'CAPACITY'),
  question(2, 'CAPACITY'),
  question(3, 'CAPACITY'),
  question(1, 'ATTITUDE'),
  question(2, 'ATTITUDE'),
  question(3, 'ATTITUDE'),
];

/** Scripted result: scoring is the backend's (BR-67), never recomputed here. */
export const devSuggestion: RiskSuggestion = {
  capacityScore: 6,
  attitudeScore: 7,
  suggestedProfile: 'BALANCED',
};
