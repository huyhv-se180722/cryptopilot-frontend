import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { aiErrorText } from '../../features/ai-assistant/ai-assistant-errors';
import { ChatPanel } from '../../features/ai-assistant/components/ChatPanel';
import { ContextSelector } from '../../features/ai-assistant/components/ContextSelector';
import {
  NO_CONTEXT,
  type AiContextValue,
} from '../../features/ai-assistant/ai-context';
import { ConversationList } from '../../features/ai-assistant/components/ConversationList';
import {
  useAiAnswerPush,
  useAiConversations,
  useAiMessages,
  useAiPlans,
  useAiQuota,
  useAskQuestion,
  useDeleteConversation,
  useRenameConversation,
  useStartConversation,
} from '../../features/ai-assistant/hooks/use-ai-assistant';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { AiConversation, AiQuestion } from '../../types/domain';

const TITLE_MAX = 100;

/**
 * SCR-29 AI Assistant (SRS 3.9.1, UC-35, UC-36, T-076): the conversation
 * list, the chat panel and the context selector. An analysis screen opens
 * it with `?symbol=<pair>&market=<spot|futures>` (or `?pair=<id>`) to
 * pre-fill the pair. The
 * answer arrives later (pushed, or read again while pending); every
 * answer carries the disclaimer (BR-51). On FREE the conversations stay
 * readable with the upgrade prompt (BR-50, BR-52). The screen is in
 * Vietnamese, like the answers.
 */
export function AiAssistantPage() {
  return (
    <I18nProvider locale="vi">
      <AiAssistantScreen />
    </I18nProvider>
  );
}

function initialContext(params: URLSearchParams): AiContextValue {
  return {
    ...NO_CONTEXT,
    market:
      params.get('market')?.toLowerCase() === 'futures' ? 'futures' : 'spot',
    pairId: params.get('pair') ?? '',
  };
}

function question(text: string, context: AiContextValue): AiQuestion {
  const scoped = context.pairId !== '' || context.planId !== '';
  return {
    question: text,
    ...(context.pairId !== ''
      ? { pairId: context.pairId, market: context.market }
      : {}),
    ...(scoped ? { timeframe: context.timeframe } : {}),
    ...(context.planId !== '' ? { planId: context.planId } : {}),
    ...(context.includePerformance ? { includePerformance: true } : {}),
  };
}

function AiAssistantScreen() {
  const copy = useCopy();
  const t = copy.aiAssistant;
  const { show } = useToast();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('c');
  const [context, setContext] = useState<AiContextValue>(() =>
    initialContext(params),
  );
  // The analysis screens name the pair by symbol; it is chosen once the
  // market's pairs are known, until the Trader picks another.
  const [symbolHint, setSymbolHint] = useState(params.get('symbol'));
  const [renaming, setRenaming] = useState<AiConversation | null>(null);
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState<AiConversation | null>(null);

  useAiAnswerPush();
  const conversations = useAiConversations();
  const quota = useAiQuota();
  const messages = useAiMessages(selectedId);
  const onPlan = quota.data !== undefined && quota.data.limit !== 0;
  const spotPairs = useMarketPairs('spot');
  const futuresPairs = useMarketPairs('futures');
  const plans = useAiPlans(onPlan);
  const hintPairs = context.market === 'futures' ? futuresPairs : spotPairs;
  const hinted = symbolHint
    ? hintPairs.data?.find((pair) => pair.symbol === symbolHint)?.pairId
    : undefined;
  const chosen: AiContextValue =
    context.pairId === '' && hinted ? { ...context, pairId: hinted } : context;
  const start = useStartConversation();
  const rename = useRenameConversation();
  const removal = useDeleteConversation();
  const ask = useAskQuestion();

  const items = conversations.data?.items ?? [];
  const firstId = items[0]?.id ?? null;
  // Open the latest conversation when none is chosen.
  useEffect(() => {
    if (selectedId === null && firstId !== null)
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set('c', firstId);
          return next;
        },
        { replace: true },
      );
  }, [selectedId, firstId, setParams]);

  function select(id: string | null) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id === null) next.delete('c');
      else next.set('c', id);
      return next;
    });
  }

  async function startConversation(): Promise<string | null> {
    const result = await start.run(chosen.pairId === '' ? null : chosen.pairId);
    if (result.status === 'success') {
      select(result.data.id);
      return result.data.id;
    }
    if (result.status === 'error')
      show({ tone: 'error', message: aiErrorText(copy, result.error) });
    return null;
  }

  async function askQuestion(text: string): Promise<boolean> {
    // The first question of a Trader without a conversation starts one.
    const conversationId = selectedId ?? (await startConversation());
    if (!conversationId) return false;
    const result = await ask.run(conversationId, question(text, chosen));
    if (result.status === 'error') {
      show({ tone: 'error', message: aiErrorText(copy, result.error) });
      return false;
    }
    return result.status === 'success';
  }

  async function confirmRename() {
    if (!renaming) return;
    const value = title.trim();
    if (value === '' || value.length > TITLE_MAX) return;
    const result = await rename.run(renaming.id, value);
    if (result.status === 'success') setRenaming(null);
    else if (result.status === 'error')
      show({ tone: 'error', message: aiErrorText(copy, result.error) });
  }

  async function confirmDelete() {
    if (!deleting) return;
    const result = await removal.run(deleting.id);
    const removed = deleting.id;
    setDeleting(null);
    if (result.status === 'success') {
      if (removed === selectedId) select(null);
      show({ tone: 'success', message: t.deleted });
    } else if (result.status === 'error')
      show({ tone: 'error', message: aiErrorText(copy, result.error) });
  }

  return (
    <div className="w-full">
      <PageHeader title={t.title} description={t.subtitle} />
      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)_260px]">
        <ConversationList
          conversations={items}
          loading={conversations.isPending}
          selectedId={selectedId}
          canStart={onPlan}
          starting={start.pending}
          onSelect={select}
          onStart={() => void startConversation()}
          onRename={(conversation) => {
            setRenaming(conversation);
            setTitle(conversation.title);
          }}
          onDelete={setDeleting}
        />
        <ChatPanel
          messages={messages.data?.items ?? []}
          loading={messages.isPending && selectedId !== null}
          quota={quota.data}
          asking={ask.pending}
          onAsk={askQuestion}
        />
        <ContextSelector
          value={chosen}
          spotPairs={spotPairs.data ?? []}
          futuresPairs={futuresPairs.data ?? []}
          plans={plans.data ?? []}
          performanceAllowed={quota.data?.performanceContext ?? false}
          onChange={(next) => {
            setSymbolHint(null);
            setContext(next);
          }}
        />
      </div>
      <Dialog
        open={renaming !== null}
        onOpenChange={(next) => !next && setRenaming(null)}
        title={t.renameTitle}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)}>
              {t.cancel}
            </Button>
            <Button
              disabled={rename.pending || title.trim() === ''}
              onClick={() => void confirmRename()}
            >
              {t.save}
            </Button>
          </>
        }
      >
        <Input
          label={t.renameLabel}
          value={title}
          maxLength={TITLE_MAX}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Dialog>
      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title={t.deleteTitle}
        description={t.deleteBody}
        size="sm"
        accent="negative"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={removal.pending}
              onClick={() => void confirmDelete()}
            >
              {t.delete}
            </Button>
          </>
        }
      />
    </div>
  );
}
