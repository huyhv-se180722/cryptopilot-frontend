import { describe, expect, it, vi } from 'vitest';
import { createHttpAiAdminService, createHttpAiService } from './ai';
import {
  decodeAiAnswerPush,
  decodeAiConfiguration,
  decodeAiMessage,
  decodeAiQuota,
} from './ai-dto';
import { createHttpClient } from './http-client';

/** Shapes of the backend branch feature/UC-50 (T-073 to T-075, UC-50). */
const MESSAGE = {
  id: 'm1',
  conversationId: 'c1',
  role: 'USER',
  content: 'RSI 72 nghĩa là gì?',
  status: 'PENDING',
  createdAt: '2026-11-02T03:00:00Z',
};
const QUOTA = {
  limit: 30,
  used: 3,
  remaining: 27,
  resetsAt: '2026-11-02T17:00:00Z',
  canAsk: true,
  performanceContext: false,
};
const CONFIGURATION = {
  id: 'v1',
  modelName: 'gemini-3.5-flash-lite',
  systemPrompt: 'Explain, never advise.',
  temperature: '0.30',
  maxOutputTokens: 1024,
  disclaimer: 'Chỉ để tham khảo.',
  active: true,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  updatedBy: null,
};

function setup(reply: unknown, status = 200) {
  const calls: { url: URL; method: string; body: unknown }[] = [];
  const http = createHttpClient({
    baseUrl: 'https://api.example.test/api/v1',
    fetcher: vi.fn<typeof fetch>(async (input, init) => {
      calls.push({
        url: new URL(String(input)),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response(status === 204 ? null : JSON.stringify(reply), {
        status,
      });
    }),
    session: { accessToken: () => null, refresh: async () => 'ended' },
  });
  return {
    ai: createHttpAiService(http),
    admin: createHttpAiAdminService(http),
    calls,
  };
}

describe('AI assistant adapter (UC-35, UC-36, BR-50)', () => {
  it('decodes a failed answer without text, and refuses an unknown status', () => {
    expect(
      decodeAiMessage({
        ...MESSAGE,
        role: 'ASSISTANT',
        status: 'FAILED',
        content: null,
      }).content,
    ).toBe('');
    expect(() => decodeAiMessage({ ...MESSAGE, status: 'LOST' })).toThrow(
      'status',
    );
  });

  it('decodes an unlimited quota and a push without an answer', () => {
    expect(
      decodeAiQuota({ ...QUOTA, limit: null, remaining: null }).limit,
    ).toBeNull();
    expect(
      decodeAiAnswerPush({
        conversationId: 'c1',
        questionId: 'm1',
        status: 'FAILED',
        answer: null,
      }).answer,
    ).toBeNull();
  });

  it('asks with the market in capitals and only the chosen context', async () => {
    const { ai, calls } = setup({ question: MESSAGE, quota: QUOTA });

    const result = await ai.ask('c1', {
      question: 'RSI 72 nghĩa là gì?',
      pairId: 'p1',
      market: 'futures',
      timeframe: '4h',
    });

    expect(result.quota.remaining).toBe(27);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url.pathname).toBe('/api/v1/ai/conversations/c1/messages');
    expect(calls[0]?.body).toEqual({
      question: 'RSI 72 nghĩa là gì?',
      pairId: 'p1',
      market: 'FUTURES',
      timeframe: '4h',
    });
  });

  it('starts, renames and deletes conversations', async () => {
    const conversation = {
      id: 'c1',
      title: 'BTC',
      pairId: null,
      createdAt: '2026-11-02T03:00:00Z',
      updatedAt: '2026-11-02T03:00:00Z',
    };
    const started = setup(conversation);
    await started.ai.start(null);
    expect(started.calls[0]?.body).toEqual({});

    const renamed = setup(conversation);
    await renamed.ai.rename('c1', 'Mới');
    expect(renamed.calls[0]?.method).toBe('PATCH');
    expect(renamed.calls[0]?.body).toEqual({ title: 'Mới' });

    const removed = setup(null, 204);
    await removed.ai.remove('c1');
    expect(removed.calls[0]?.method).toBe('DELETE');
  });
});

describe('AI configuration adapter (UC-50)', () => {
  it('decodes a version and refuses a temperature that is not a decimal', () => {
    expect(decodeAiConfiguration(CONFIGURATION).updatedBy).toBeNull();
    expect(() =>
      decodeAiConfiguration({ ...CONFIGURATION, temperature: 'hot' }),
    ).toThrow('temperature');
  });

  it('creates and activates versions', async () => {
    const created = setup({ ...CONFIGURATION, active: false });
    await created.admin.create({
      modelName: 'gemini-3.5-flash-lite',
      systemPrompt: 'Explain, never advise.',
      temperature: '0.30',
      maxOutputTokens: 1024,
      disclaimer: 'Chỉ để tham khảo.',
    });
    expect(created.calls[0]?.url.pathname).toBe(
      '/api/v1/admin/ai-configurations',
    );
    expect(created.calls[0]?.body).toMatchObject({ temperature: '0.30' });

    const activated = setup(CONFIGURATION);
    await activated.admin.activate('v1');
    expect(activated.calls[0]?.url.pathname).toBe(
      '/api/v1/admin/ai-configurations/v1/activate',
    );
  });
});
