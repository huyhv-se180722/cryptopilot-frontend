import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import {
  createHttpAdminSettingService,
  createPendingAdminSettingService,
  decodeSystemSetting,
} from './admin-settings';

/** `SystemSettingResponse` on develop @ 14fe5a4. */
const SETTING = {
  key: 'SPOT_TAKER_FEE',
  value: '0.00100000',
  valueType: 'DECIMAL',
  description: 'BR-36. Taker fee rate of a Spot fill.',
  min: '0',
  max: '0.1',
  updatedBy: null,
  updatedAt: '2026-01-01T00:00:00Z',
};

function setup(answer: (url: URL, init: RequestInit) => unknown) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input, init = {}) => {
      const url = new URL(String(input));
      calls.push({ url, init });
      return new Response(JSON.stringify(answer(url, init)), { status: 200 });
    }),
    session: { accessToken: () => 'token-1', refresh: async () => 'renewed' },
  });
  return { settings: createHttpAdminSettingService(http), calls };
}

describe('system setting decoder', () => {
  it('keeps the value and bounds as text, null bounds when only the type is checked', () => {
    expect(decodeSystemSetting(SETTING)).toEqual(SETTING);
    const free = decodeSystemSetting({
      ...SETTING,
      valueType: 'STRING',
      min: null,
      max: null,
      updatedBy: '0199a0f0-0000-7000-8000-00000000ad01',
    });
    expect(free.min).toBeNull();
    expect(free.updatedBy).toBe('0199a0f0-0000-7000-8000-00000000ad01');
  });

  it('rejects an unknown type or a number where a decimal belongs', () => {
    expect(() =>
      decodeSystemSetting({ ...SETTING, valueType: 'JSON' }),
    ).toThrow();
    expect(() => decodeSystemSetting({ ...SETTING, max: 0.1 })).toThrow();
  });
});

describe('HTTP admin setting adapter', () => {
  it('lists every setting and changes one by its key', async () => {
    const { settings, calls } = setup((_url, init) =>
      init.method === 'PUT' ? { ...SETTING, value: '0.00075000' } : [SETTING],
    );
    expect(await settings.list()).toHaveLength(1);
    const saved = await settings.update('SPOT_TAKER_FEE', '0.00075');
    expect(saved.value).toBe('0.00075000');
    expect(calls.map((c) => c.url.pathname)).toEqual([
      '/api/v1/admin/settings',
      '/api/v1/admin/settings/SPOT_TAKER_FEE',
    ]);
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({
      value: '0.00075',
    });
  });

  it('answers NOT_CONFIGURED without a backend', async () => {
    await expect(
      createPendingAdminSettingService().list(),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
