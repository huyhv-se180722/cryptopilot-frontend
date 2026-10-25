import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http-client';
import { ServiceError } from './errors';

const decode = () => undefined;

function problemResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

describe('HTTP problem details', () => {
  it('attaches only whitelisted problem fields to the error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      problemResponse(409, {
        title: 'Conflict',
        detail: 'Internal explanation',
        code: 'EMAIL_ALREADY_REGISTERED',
        messageCode: 'MSG04',
      }),
    );
    const error = await createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
    })
      .request({ path: 'auth/register', method: 'POST', body: {}, decode })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ServiceError);
    expect((error as ServiceError).problem).toEqual({
      status: 409,
      code: 'EMAIL_ALREADY_REGISTERED',
      messageCode: 'MSG04',
      messageArgs: [],
      fieldErrors: {},
    });
    expect(JSON.stringify(error)).not.toContain('Internal explanation');
  });

  it('keeps field errors of list items, keyed by their index', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      problemResponse(400, {
        code: 'VALIDATION_FAILED',
        messageCode: 'MSG01',
        errors: {
          'brackets[0].maxLeverage': 'MSG15',
          'bad key<script>': 'MSG01',
        },
      }),
    );
    const error = await createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
    })
      .request({ path: 'admin/pairs/p/brackets', method: 'PUT', decode })
      .catch((caught: unknown) => caught);
    expect((error as ServiceError).problem?.fieldErrors).toEqual({
      'brackets[0].maxLeverage': 'MSG15',
    });
  });

  it('treats a sign-in 401 as wrong credentials, not an ended session', async () => {
    const onUnauthorized = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      problemResponse(401, {
        code: 'INVALID_CREDENTIALS',
        messageCode: 'MSG08',
      }),
    );
    const client = createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      onUnauthorized,
    });
    await expect(
      client.request({
        path: 'auth/login',
        method: 'POST',
        body: {},
        decode,
        anonymous: true,
      }),
    ).rejects.toMatchObject({ problem: { messageCode: 'MSG08' } });
    expect(onUnauthorized).not.toHaveBeenCalled();
    await expect(
      client.request({ path: 'me/profile', decode }),
    ).rejects.toBeTruthy();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('keeps errors without a usable body problem-free', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<html>502</html>', { status: 502 }));
    await expect(
      createHttpClient({
        baseUrl: 'https://api.example.test',
        fetcher,
      }).request({
        path: 'health',
        decode,
      }),
    ).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      status: 502,
      problem: undefined,
    });
  });
});
