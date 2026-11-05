import type {
  AiAnswerPush,
  AiAskResult,
  AiConfiguration,
  AiConversation,
  AiConversationPage,
  AiMessage,
  AiMessagePage,
  AiMessageStatus,
  AiQuota,
  AiSenderRole,
} from '../../types/domain';
import {
  decimal,
  flag,
  instant,
  integer,
  list,
  nullableText,
  oneOf,
  record,
  text,
} from './decode';

/**
 * Decoders for `/ai/**` and `/admin/ai-configurations` (UC-35, UC-36,
 * UC-50, BR-50), checked against backend `feature/UC-50`
 * (`ConversationResponse`, `MessageResponse`, `AskResponse`,
 * `QuotaResponse`, `AiAnswerPush`, `AiConfigurationResponse`).
 */
const ROLES: readonly AiSenderRole[] = ['USER', 'ASSISTANT'];
const STATUSES: readonly AiMessageStatus[] = ['PENDING', 'COMPLETED', 'FAILED'];

function count(value: unknown, name: string): number {
  const n = integer(value, name);
  if (n < 0) throw new Error(name + ' must not be negative');
  return n;
}

function nullableCount(value: unknown, name: string): number | null {
  return value === null || value === undefined ? null : count(value, name);
}

export function decodeAiConversation(body: unknown): AiConversation {
  const value = record(body, 'conversation');
  return {
    id: text(value.id, 'id'),
    title: nullableText(value.title, 'title'),
    pairId: nullableText(value.pairId, 'pairId'),
    createdAt: instant(value.createdAt, 'createdAt'),
    updatedAt: instant(value.updatedAt, 'updatedAt'),
  };
}

export function decodeAiConversationPage(body: unknown): AiConversationPage {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(decodeAiConversation),
    page: count(value.page, 'page'),
    pageSize: count(value.pageSize, 'pageSize'),
    total: count(value.total, 'total'),
  };
}

export function decodeAiMessage(body: unknown): AiMessage {
  const value = record(body, 'message');
  return {
    id: text(value.id, 'id'),
    conversationId: text(value.conversationId, 'conversationId'),
    role: oneOf(ROLES, value.role, 'role'),
    // A failed answer has no text.
    content: typeof value.content === 'string' ? value.content : '',
    status: oneOf(STATUSES, value.status, 'status'),
    createdAt: instant(value.createdAt, 'createdAt'),
  };
}

export function decodeAiMessagePage(body: unknown): AiMessagePage {
  const value = record(body);
  return {
    items: list(value.items, 'items').map(decodeAiMessage),
    page: count(value.page, 'page'),
    pageSize: count(value.pageSize, 'pageSize'),
    total: count(value.total, 'total'),
  };
}

export function decodeAiQuota(body: unknown): AiQuota {
  const value = record(body, 'quota');
  return {
    limit: nullableCount(value.limit, 'limit'),
    used: count(value.used, 'used'),
    remaining: nullableCount(value.remaining, 'remaining'),
    resetsAt: instant(value.resetsAt, 'resetsAt'),
    canAsk: flag(value.canAsk, 'canAsk'),
    performanceContext: flag(value.performanceContext, 'performanceContext'),
  };
}

export function decodeAiAskResult(body: unknown): AiAskResult {
  const value = record(body);
  return {
    question: decodeAiMessage(value.question),
    quota: decodeAiQuota(value.quota),
  };
}

export function decodeAiAnswerPush(body: unknown): AiAnswerPush {
  const value = record(body, 'push');
  return {
    conversationId: text(value.conversationId, 'conversationId'),
    questionId: text(value.questionId, 'questionId'),
    status: oneOf(STATUSES, value.status, 'status'),
    answer:
      value.answer === null || value.answer === undefined
        ? null
        : decodeAiMessage(value.answer),
  };
}

export function decodeAiConfiguration(body: unknown): AiConfiguration {
  const value = record(body, 'configuration');
  return {
    id: text(value.id, 'id'),
    modelName: text(value.modelName, 'modelName'),
    systemPrompt: text(value.systemPrompt, 'systemPrompt'),
    temperature: decimal(value.temperature, 'temperature'),
    maxOutputTokens: count(value.maxOutputTokens, 'maxOutputTokens'),
    disclaimer: text(value.disclaimer, 'disclaimer'),
    active: flag(value.active, 'active'),
    createdAt: instant(value.createdAt, 'createdAt'),
    updatedAt: instant(value.updatedAt, 'updatedAt'),
    updatedBy: nullableText(value.updatedBy, 'updatedBy'),
  };
}

export function decodeAiConfigurations(
  body: unknown,
): readonly AiConfiguration[] {
  return list(body, 'configurations').map(decodeAiConfiguration);
}
