import type { AiAdminService, AiService } from './contracts';
import {
  decodeAiAnswerPush,
  decodeAiAskResult,
  decodeAiConfiguration,
  decodeAiConfigurations,
  decodeAiConversation,
  decodeAiConversationPage,
  decodeAiMessagePage,
  decodeAiQuota,
} from './ai-dto';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import type { AccountFeed } from './paper-trading';

export const AI_ANSWER_QUEUE = '/user/queue/ai';
const CONVERSATIONS = 'ai/conversations';
const CONFIGURATIONS = 'admin/ai-configurations';

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});
const id = (value: string) => encodeURIComponent(value);
const noContent = () => undefined;

/** Used while no API base URL is configured. */
export function createPendingAiService(): AiService {
  return {
    conversations: async () => integrationPending(),
    start: async () => integrationPending(),
    rename: async () => integrationPending(),
    remove: async () => integrationPending(),
    messages: async () => integrationPending(),
    ask: async () => integrationPending(),
    quota: async () => integrationPending(),
    subscribeAnswers: () => () => undefined,
  };
}

/**
 * `/ai/**` (UC-35, UC-36, BR-50 to BR-52): Traders only. A question is
 * answered later; the answer is pushed on the signed-in STOMP connection
 * when there is one, otherwise the screen reads the conversation again.
 */
export function createHttpAiService(
  http: HttpClient,
  feed: AccountFeed | null = null,
): AiService {
  return {
    conversations: (page, pageSize, topic, signal) =>
      http.request({
        path:
          CONVERSATIONS +
          '?' +
          new URLSearchParams({
            ...(topic ? { topic } : {}),
            page: String(page),
            pageSize: String(pageSize),
          }).toString(),
        decode: decodeAiConversationPage,
        ...withSignal(signal),
      }),
    start: (topic, pairId) =>
      http.request({
        path: CONVERSATIONS,
        method: 'POST',
        body: pairId ? { topic, pairId } : { topic },
        decode: decodeAiConversation,
      }),
    rename: (conversationId, title) =>
      http.request({
        path: CONVERSATIONS + '/' + id(conversationId),
        method: 'PATCH',
        body: { title },
        decode: decodeAiConversation,
      }),
    remove: (conversationId) =>
      http.request({
        path: CONVERSATIONS + '/' + id(conversationId),
        method: 'DELETE',
        decode: noContent,
      }),
    messages: (conversationId, page, pageSize, signal) =>
      http.request({
        path:
          CONVERSATIONS +
          '/' +
          id(conversationId) +
          '/messages?' +
          new URLSearchParams({
            page: String(page),
            pageSize: String(pageSize),
          }).toString(),
        decode: decodeAiMessagePage,
        ...withSignal(signal),
      }),
    ask: (conversationId, question) =>
      http.request({
        path: CONVERSATIONS + '/' + id(conversationId) + '/messages',
        method: 'POST',
        // The API names the markets in capitals.
        body: {
          ...question,
          ...(question.market ? { market: question.market.toUpperCase() } : {}),
        },
        decode: decodeAiAskResult,
      }),
    quota: (signal) =>
      http.request({
        path: 'ai/quota',
        decode: decodeAiQuota,
        ...withSignal(signal),
      }),
    subscribeAnswers: (listener) =>
      feed
        ? feed.subscribeTopic(AI_ANSWER_QUEUE, decodeAiAnswerPush, listener)
        : () => undefined,
  };
}

/** Used while no API base URL is configured. */
export function createPendingAiAdminService(): AiAdminService {
  return {
    list: async () => integrationPending(),
    create: async () => integrationPending(),
    activate: async () => integrationPending(),
  };
}

/** `/admin/ai-configurations` (UC-50): every change is audited by the backend (BR-57). */
export function createHttpAiAdminService(http: HttpClient): AiAdminService {
  return {
    list: (signal) =>
      http.request({
        path: CONFIGURATIONS,
        decode: decodeAiConfigurations,
        ...withSignal(signal),
      }),
    create: (draft) =>
      http.request({
        path: CONFIGURATIONS,
        method: 'POST',
        body: {
          modelName: draft.modelName,
          systemPrompt: draft.systemPrompt,
          temperature: draft.temperature,
          maxOutputTokens: draft.maxOutputTokens,
          disclaimer: draft.disclaimer,
        },
        decode: decodeAiConfiguration,
      }),
    activate: (configurationId) =>
      http.request({
        path: CONFIGURATIONS + '/' + id(configurationId) + '/activate',
        method: 'POST',
        decode: decodeAiConfiguration,
      }),
  };
}
