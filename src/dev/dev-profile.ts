import type { ProfileService } from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import {
  devProfile,
  devQuestionnaire,
  devRiskParams,
  devSuggestion,
} from './fixtures/profile';

/**
 * DEVELOPMENT ONLY. In-memory `/me/*` adapter with the backend's refusals
 * (UC-06, UC-08): field rules (MSG01, MSG15) and MSG48. A reload restores
 * the fixture.
 */
function refuse(
  code: string,
  messageCode: string,
  fieldErrors: Readonly<Record<string, string>> = {},
): never {
  throw new ServiceError('Development profile refusal.', 'HTTP_ERROR', 400, {
    status: 400,
    code,
    messageCode,
    messageArgs: [],
    fieldErrors,
  });
}

const DECIMAL = /^\d+(\.\d+)?$/;
const decimals = (value: string) => value.split('.')[1]?.length ?? 0;

export function createDevelopmentProfile(): ProfileService {
  let profile = { ...devProfile };
  return {
    async get(signal) {
      signal?.throwIfAborted();
      return { ...profile };
    },
    async update(update) {
      const errors: Record<string, string> = {};
      const name = update.displayName.trim();
      if (name.length < 2 || name.length > 50) errors.displayName = 'MSG01';
      const capital = update.defaultCapital;
      if (
        capital !== null &&
        (!DECIMAL.test(capital) ||
          Number(capital) <= 0 ||
          decimals(capital) > 8)
      )
        errors.defaultCapital = 'MSG15';
      const risk = update.defaultRiskPercent;
      if (
        risk !== null &&
        (!DECIMAL.test(risk) ||
          Number(risk) < 0.1 ||
          Number(risk) > 10 ||
          decimals(risk) > 3)
      )
        errors.defaultRiskPercent = 'MSG15';
      if (Object.keys(errors).length > 0)
        refuse('VALIDATION_FAILED', 'MSG01', errors);
      profile = { ...profile, ...update, displayName: name };
    },
    async updateNotifications({ email, push }) {
      profile = { ...profile, notifyEmail: email, notifyPush: push };
    },
    async getRiskProfile(signal) {
      signal?.throwIfAborted();
      return devRiskParams[profile.riskProfile];
    },
    async chooseRiskProfile(riskProfile, confirmAggressive) {
      if (riskProfile === 'AGGRESSIVE' && !confirmAggressive)
        refuse('RISK_PROFILE_CONFIRMATION_REQUIRED', 'MSG48');
      profile = { ...profile, riskProfile };
    },
    async getQuestionnaire(signal) {
      signal?.throwIfAborted();
      return devQuestionnaire;
    },
    async suggestRiskProfile(answers) {
      const answered = devQuestionnaire.every((question) =>
        question.options.some(
          (option) => option.code === answers[question.code],
        ),
      );
      if (!answered) refuse('VALIDATION_FAILED', 'MSG01');
      return devSuggestion;
    },
  };
}
