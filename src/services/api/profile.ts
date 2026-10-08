import type { ProfileService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import {
  decodeProfile,
  decodeQuestionnaire,
  decodeRiskProfile,
  decodeSaved,
  decodeSuggestion,
} from './profile-dto';

/** Used while no API base URL is configured. */
export function createPendingProfileService(): ProfileService {
  return {
    get: async () => integrationPending(),
    update: async () => integrationPending(),
    updateNotifications: async () => integrationPending(),
    getRiskProfile: async () => integrationPending(),
    chooseRiskProfile: async () => integrationPending(),
    getQuestionnaire: async () => integrationPending(),
    suggestRiskProfile: async () => integrationPending(),
    changePassword: async () => integrationPending(),
  };
}

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/**
 * `/me/profile`, `/me/notification-preferences`, `/me/risk-profile`,
 * `/me/risk-questionnaire` (Trader) and `/me/password` (Trader and Admin).
 */
export function createHttpProfileService(http: HttpClient): ProfileService {
  return {
    get: (signal) =>
      http.request({
        path: 'me/profile',
        decode: decodeProfile,
        ...withSignal(signal),
      }),
    update: (update) =>
      http.request({
        path: 'me/profile',
        method: 'PUT',
        body: update,
        decode: decodeSaved,
      }),
    updateNotifications: (preferences) =>
      http.request({
        path: 'me/notification-preferences',
        method: 'PUT',
        body: preferences,
        decode: decodeSaved,
      }),
    getRiskProfile: (signal) =>
      http.request({
        path: 'me/risk-profile',
        decode: decodeRiskProfile,
        ...withSignal(signal),
      }),
    chooseRiskProfile: (riskProfile, confirmAggressive) =>
      http.request({
        path: 'me/risk-profile',
        method: 'PUT',
        body: { riskProfile, confirmAggressive },
        decode: decodeSaved,
      }),
    getQuestionnaire: (signal) =>
      http.request({
        path: 'me/risk-questionnaire',
        decode: decodeQuestionnaire,
        ...withSignal(signal),
      }),
    suggestRiskProfile: (answers) =>
      http.request({
        path: 'me/risk-questionnaire',
        method: 'POST',
        body: { answers },
        decode: decodeSuggestion,
      }),
    changePassword: (change) =>
      http.request({
        path: 'me/password',
        method: 'PUT',
        body: change,
        decode: decodeSaved,
      }),
  };
}
