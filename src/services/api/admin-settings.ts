import type { SettingValueType, SystemSetting } from '../../types/domain';
import type { AdminSettingService } from './contracts';
import {
  instant,
  list,
  nullableDecimal,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';

const VALUE_TYPES: readonly SettingValueType[] = [
  'INT',
  'DECIMAL',
  'BOOLEAN',
  'STRING',
];

/**
 * `SystemSettingResponse` of `/admin/settings/**` (UC-51), checked against
 * backend develop @ 14fe5a4: decimals and bounds as strings.
 */
export function decodeSystemSetting(body: unknown): SystemSetting {
  const value = record(body, 'setting');
  return {
    key: text(value.key, 'key'),
    value: text(value.value, 'value'),
    valueType: oneOf(VALUE_TYPES, value.valueType, 'valueType'),
    description: text(value.description, 'description'),
    min: nullableDecimal(value.min, 'min'),
    max: nullableDecimal(value.max, 'max'),
    updatedBy: nullableText(value.updatedBy, 'updatedBy'),
    updatedAt: instant(value.updatedAt, 'updatedAt'),
  };
}

export const decodeSystemSettings = (body: unknown): SystemSetting[] =>
  list(body, 'settings').map(decodeSystemSetting);

/** Used while no API base URL is configured. */
export function createPendingAdminSettingService(): AdminSettingService {
  return {
    list: async () => integrationPending(),
    update: async () => integrationPending(),
  };
}

/**
 * `/admin/settings/**` (UC-51), Admin only: every setting by key with its
 * range, and one setting changed at a time (`PUT` with the value as text).
 */
export function createHttpAdminSettingService(
  http: HttpClient,
): AdminSettingService {
  return {
    list: (signal) =>
      http.request({
        path: 'admin/settings',
        decode: decodeSystemSettings,
        ...(signal ? { signal } : {}),
      }),
    update: (key, value) =>
      http.request({
        path: 'admin/settings/' + encodeURIComponent(key),
        method: 'PUT',
        body: { value },
        decode: decodeSystemSetting,
      }),
  };
}
