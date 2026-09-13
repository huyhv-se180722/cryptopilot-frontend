import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';

function decodeMessage(value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('message' in value) ||
    typeof value.message !== 'string'
  )
    throw new Error('Invalid shape');
  return value.message;
}

describe('HTTP boundary', () => {
  it('does not send requests without a base URL', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createHttpClient({ baseUrl: '', fetcher });
    await expect(
      client.request({ path: 'health', decode: decodeMessage }),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('preserves the API prefix and validates unknown responses', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ message: 'ok' })));
    const client = createHttpClient({
      baseUrl: 'https://api.example.test/v1',
      fetcher,
    });
    await expect(
      client.request({ path: '/health', decode: decodeMessage }),
    ).resolves.toBe('ok');
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      'https://api.example.test/v1/health',
    );
  });
  it('rejects unexpected JSON shapes and malformed JSON', async () => {
    for (const body of ['{}', 'not JSON']) {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(body));
      await expect(
        createHttpClient({
          baseUrl: 'https://api.example.test/',
          fetcher,
        }).request({ path: 'health', decode: decodeMessage }),
      ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });
  it('handles a 204 response through its decoder', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const decode = vi.fn((body: unknown) => {
      expect(body).toBeUndefined();
    });
    await createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
    }).request({ path: 'session', method: 'DELETE', decode });
    expect(decode).toHaveBeenCalledOnce();
  });
  it('notifies on unauthorized without leaking backend response text', async () => {
    const onUnauthorized = vi.fn();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('private diagnostic', { status: 401 }));
    await expect(
      createHttpClient({
        baseUrl: 'https://api.example.test',
        fetcher,
        onUnauthorized,
      }).request({ path: 'session', decode: decodeMessage }),
    ).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      status: 401,
      message: 'The request could not be completed.',
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
  it('rejects absolute cross-origin and parent traversal paths before fetching', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createHttpClient({
      baseUrl: 'https://api.example.test/v1/',
      fetcher,
    });
    for (const path of ['https://other.example.test/data', '../outside']) {
      await expect(
        client.request({ path, decode: decodeMessage }),
      ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('distinguishes timeout from user cancellation', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(init.signal?.reason),
              { once: true },
            );
          }),
      );
      const client = createHttpClient({
        baseUrl: 'https://api.example.test',
        fetcher,
        timeoutMs: 100,
      });
      const pending = client.request({ path: 'slow', decode: decodeMessage });
      const assertion = expect(pending).rejects.toMatchObject({
        code: 'TIMEOUT',
      });
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
      const controller = new AbortController();
      const cancelled = client.request({
        path: 'slow',
        decode: decodeMessage,
        signal: controller.signal,
      });
      const cancellation = expect(cancelled).rejects.toMatchObject({
        name: 'AbortError',
      });
      controller.abort();
      await cancellation;
    } finally {
      vi.useRealTimers();
    }
  });
  it('normalizes a network failure', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      createHttpClient({
        baseUrl: 'https://api.example.test',
        fetcher,
      }).request({ path: 'health', decode: decodeMessage }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
