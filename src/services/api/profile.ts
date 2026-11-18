import { checkFile, send } from './community';
import type { UploadForm } from './community-dto';
import type { ProfileService } from './contracts';
import { integer, list, record, text } from './decode';
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
    updateCommunityProfile: async () => integrationPending(),
    uploadProfileImage: async () => integrationPending(),
  };
}

/**
 * The signed form of `POST /me/profile-images/upload-signature` in the shape
 * the storage upload takes: an image, never overwriting, no duration.
 */
export function decodeProfileImageForm(body: unknown): UploadForm {
  const value = record(body);
  const uploadUrl = text(value.uploadUrl, 'uploadUrl');
  if (new URL(uploadUrl).protocol !== 'https:')
    throw new Error('uploadUrl must be https');
  const maxBytes = integer(value.maxBytes, 'maxBytes');
  if (maxBytes <= 0) throw new Error('maxBytes must be positive');
  return {
    uploadUrl,
    apiKey: text(value.apiKey, 'apiKey'),
    timestamp: integer(value.timestamp, 'timestamp'),
    signature: text(value.signature, 'signature'),
    publicId: text(value.publicId, 'publicId'),
    allowedFormats: list(value.allowedFormats, 'allowedFormats').map((f) =>
      text(f, 'allowedFormat').toLowerCase(),
    ),
    overwrite: false,
    kind: 'IMAGE',
    maxBytes,
    maxDurationSeconds: null,
  };
}

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/**
 * `/me/profile`, `/me/notification-preferences`, `/me/risk-profile`,
 * `/me/risk-questionnaire`, `/me/community-profile` and
 * `/me/profile-images/upload-signature` (Trader). `/me/password` is in the
 * auth adapter.
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
    updateCommunityProfile: (update) =>
      http.request({
        path: 'me/community-profile',
        method: 'PUT',
        body: update,
        decode: decodeSaved,
      }),
    uploadProfileImage: async (file, onProgress, signal) => {
      const form = await http.request({
        path: 'me/profile-images/upload-signature',
        method: 'POST',
        decode: decodeProfileImageForm,
        ...withSignal(signal),
      });
      checkFile(file, form, null);
      await send(file, form, onProgress, signal);
      return form.publicId;
    },
  };
}
