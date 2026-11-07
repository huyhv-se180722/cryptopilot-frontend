import { useCallback, useEffect } from 'react';
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type {
  AiConversationTopic,
  AiMessagePage,
  AiQuestion,
  PlanTab,
} from '../../../types/domain';

export const AI_KEY = ['ai'] as const;
const CONVERSATIONS_KEY = [...AI_KEY, 'conversations'] as const;
const MESSAGES_KEY = [...AI_KEY, 'messages'] as const;
const QUOTA_KEY = [...AI_KEY, 'quota'] as const;
export const CONVERSATIONS_PAGE_SIZE = 50;
export const MESSAGES_PAGE_SIZE = 100;
/** How often a pending question is read again when no answer was pushed. */
export const PENDING_POLL_MS = 3_000;
/** The plans a question may be asked about: those not finished yet, and executed ones. */
const PLAN_TABS: readonly PlanTab[] = ['DRAFT', 'ACTIVE', 'EXECUTED'];

/** The Trader's conversations of one topic, the latest first (SCR-29). */
export function useAiConversations(topic: AiConversationTopic) {
  const { ai } = useServices();
  return useQuery({
    queryKey: [...CONVERSATIONS_KEY, topic],
    queryFn: ({ signal }) =>
      ai.conversations(1, CONVERSATIONS_PAGE_SIZE, topic, signal),
  });
}

const hasPending = (page: AiMessagePage | undefined) =>
  page?.items.some((message) => message.status === 'PENDING') ?? false;

/**
 * The messages of one conversation, the newest first. While a question is
 * pending it is read again every few seconds, so the answer shows even
 * without the push (TD 9 fallback).
 */
export function useAiMessages(conversationId: string | null) {
  const { ai } = useServices();
  return useQuery({
    queryKey: [...MESSAGES_KEY, conversationId],
    enabled: conversationId !== null,
    queryFn: ({ signal }) =>
      ai.messages(conversationId ?? '', 1, MESSAGES_PAGE_SIZE, signal),
    refetchInterval: (query) =>
      hasPending(query.state.data) ? PENDING_POLL_MS : false,
  });
}

/** Today's question quota (BR-50). */
export function useAiQuota() {
  const { ai } = useServices();
  return useQuery({
    queryKey: QUOTA_KEY,
    queryFn: ({ signal }) => ai.quota(signal),
  });
}

/** The Trader's plans for the context selector. */
export function useAiPlans(enabled: boolean) {
  const { tradingPlan } = useServices();
  return useQuery({
    queryKey: [...AI_KEY, 'plans'],
    enabled,
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(
        PLAN_TABS.map((tab) =>
          tradingPlan.list({ tab, page: 1, pageSize: 50 }, signal),
        ),
      );
      return pages.flatMap((page) => page.items);
    },
  });
}

/**
 * One plan in full, for the timeframe the backend analyses its pair on with
 * the question (the list rows do not carry it).
 */
export function useAiPlan(planId: string | null) {
  const { tradingPlan } = useServices();
  return useQuery({
    queryKey: [...AI_KEY, 'plan', planId],
    enabled: planId !== null,
    queryFn: ({ signal }) => tradingPlan.get(planId ?? '', signal),
  });
}

async function refresh(client: QueryClient, conversationId?: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
    client.invalidateQueries({ queryKey: QUOTA_KEY }),
    conversationId
      ? client.invalidateQueries({
          queryKey: [...MESSAGES_KEY, conversationId],
        })
      : Promise.resolve(),
  ]);
}

/**
 * Reads the conversation and the quota again when an answer is pushed on
 * `/user/queue/ai`.
 */
export function useAiAnswerPush() {
  const { ai } = useServices();
  const client = useQueryClient();
  useEffect(
    () =>
      ai.subscribeAnswers((push) => {
        void refresh(client, push.conversationId);
      }),
    [ai, client],
  );
}

export function useStartConversation() {
  const { ai } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (topic: AiConversationTopic, pairId: string | null = null) => {
        const conversation = await ai.start(topic, pairId);
        await client.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        return conversation;
      },
      [ai, client],
    ),
  );
}

export function useRenameConversation() {
  const { ai } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (conversationId: string, title: string) => {
        const conversation = await ai.rename(conversationId, title);
        await client.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        return conversation;
      },
      [ai, client],
    ),
  );
}

export function useDeleteConversation() {
  const { ai } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (conversationId: string) => {
        await ai.remove(conversationId);
        await client.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      },
      [ai, client],
    ),
  );
}

/** Asks a question; it shows as pending until the answer arrives. */
export function useAskQuestion() {
  const { ai } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (conversationId: string, question: AiQuestion) => {
        const result = await ai.ask(conversationId, question);
        client.setQueryData(QUOTA_KEY, result.quota);
        await refresh(client, conversationId);
        return result;
      },
      [ai, client],
    ),
  );
}
