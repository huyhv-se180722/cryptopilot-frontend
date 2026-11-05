import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { aiErrorText } from '../../features/ai-assistant/ai-assistant-errors';
import { MessageCircle } from 'lucide-react';
import {
  askedPair,
  askedPlan,
  asksPerformance,
  isReady,
  NO_CONTEXT,
  toQuestion,
  type AiContextValue,
} from '../../features/ai-assistant/ai-context';
import { OPEN_AI_BUBBLE_EVENT } from '../../features/ai-assistant/components/AiChatBubble';
import { AskContext } from '../../features/ai-assistant/components/AskContext';
import {
  ChatPanel,
  type AskAttachment,
  type AskSuggestion,
} from '../../features/ai-assistant/components/ChatPanel';
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
import { formatCopy } from '../../i18n/copy';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { AiConversation, MarketPair } from '../../types/domain';

const TITLE_MAX = 100;
/** The pair "analyse a coin" starts on when none is chosen yet. */
const DEFAULT_SYMBOL = 'BTCUSDT';

/**
 * SCR-29 AI Assistant (SRS 3.9.1, UC-35, UC-36, T-076): the conversation
 * list beside the chat. Above the chat the Trader picks what the question
 * is about: the analysis of one coin, or their own plan and performance
 * summary; above the box, what goes with the question. General questions
 * (no data) are asked from the floating chat, which a tip here opens. An analysis screen opens it with
 * `?symbol=<pair>&market=<spot|futures>` (or `?pair=<id>`) on that coin.
 * The answer arrives later (pushed, or read again while pending); every
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
  const pairId = params.get('pair') ?? '';
  return {
    ...NO_CONTEXT,
    mode: 'pair',
    market:
      params.get('market')?.toLowerCase() === 'futures' ? 'futures' : 'spot',
    pairId,
  };
}

function marketLabel(market: AiContextValue['market']) {
  return market === 'futures' ? 'Futures' : 'Spot';
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
  // The coin "analyse a coin" falls back to while none is picked: the one
  // an analysis screen named, else BTCUSDT.
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
  const marketPairs: readonly MarketPair[] =
    (context.market === 'futures' ? futuresPairs : spotPairs).data ?? [];
  const fallback =
    context.mode === 'pair' && context.pairId === ''
      ? (marketPairs.find(
          (pair) => pair.symbol === (symbolHint ?? DEFAULT_SYMBOL),
        ) ?? marketPairs[0])
      : undefined;
  const chosen: AiContextValue = fallback
    ? { ...context, pairId: fallback.pairId }
    : context;
  const start = useStartConversation();
  const rename = useRenameConversation();
  const removal = useDeleteConversation();
  const ask = useAskQuestion();

  function symbolOf(pairId: string) {
    return [...(spotPairs.data ?? []), ...(futuresPairs.data ?? [])].find(
      (pair) => pair.pairId === pairId,
    )?.symbol;
  }

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

  function change(next: AiContextValue) {
    setSymbolHint(null);
    setContext(next);
  }

  async function startConversation(): Promise<string | null> {
    const result = await start.run(askedPair(chosen));
    if (result.status === 'success') {
      select(result.data.id);
      return result.data.id;
    }
    if (result.status === 'error')
      show({ tone: 'error', message: aiErrorText(copy, result.error) });
    return null;
  }

  async function newConversation() {
    // A new conversation starts on the market analysis of the default coin.
    if ((await startConversation()) !== null) change(NO_CONTEXT);
  }

  async function askQuestion(text: string): Promise<boolean> {
    // The first question of a Trader without a conversation starts one.
    const conversationId = selectedId ?? (await startConversation());
    if (!conversationId) return false;
    const result = await ask.run(conversationId, toQuestion(text, chosen));
    if (result.status === 'error') {
      show({ tone: 'error', message: aiErrorText(copy, result.error) });
      return false;
    }
    return result.status === 'success';
  }

  const pairId = askedPair(chosen);
  const pairSymbol = pairId === null ? undefined : symbolOf(pairId);
  const planId = askedPlan(chosen);
  const plan = plans.data?.find((item) => item.id === planId);
  const attachments: AskAttachment[] = [];
  if (pairId !== null)
    attachments.push({
      key: 'pair',
      label: formatCopy(t.pairChip, {
        symbol: pairSymbol ?? '…',
        market: marketLabel(chosen.market),
        timeframe: chosen.timeframe,
      }),
    });
  if (plan)
    attachments.push({
      key: 'plan',
      label: formatCopy(t.planChip, {
        symbol: symbolOf(plan.pairId) ?? '',
        direction: plan.direction,
      }),
      onRemove: () => change({ ...chosen, planId: '' }),
    });
  if (asksPerformance(chosen))
    attachments.push({
      key: 'performance',
      label: t.performanceChip,
      onRemove: () => change({ ...chosen, includePerformance: false }),
    });
  const ready = isReady(chosen);
  let placeholder: string;
  if (chosen.mode === 'mine') placeholder = t.placeholderMine;
  else
    placeholder = formatCopy(t.placeholderPair, {
      symbol: pairSymbol ?? '',
      market: marketLabel(chosen.market),
      timeframe: chosen.timeframe,
    });
  const suggestions: AskSuggestion[] = [
    {
      key: 'pair',
      text: t.suggestionPair,
      onPick: () => {
        setContext({
          ...chosen,
          mode: 'pair',
          market: 'spot',
          pairId: '',
          timeframe: '4h',
        });
        setSymbolHint(DEFAULT_SYMBOL);
      },
    },
    {
      key: 'setup',
      text: t.suggestionSetup,
      onPick: () => change({ ...chosen, mode: 'pair' }),
    },
    {
      key: 'performance',
      text: t.suggestionPerformance,
      onPick: () => change({ ...chosen, mode: 'mine' }),
    },
  ];

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
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-fg-2">
        <MessageCircle size={14} aria-hidden="true" className="text-primary" />
        <span>{t.generalTip}</span>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_AI_BUBBLE_EVENT))}
          className="font-semibold text-primary hover:underline"
        >
          {t.generalTipAction}
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <ConversationList
          conversations={items}
          loading={conversations.isPending}
          selectedId={selectedId}
          canStart={onPlan}
          starting={start.pending}
          onSelect={select}
          onStart={() => void newConversation()}
          onRename={(conversation) => {
            setRenaming(conversation);
            setTitle(conversation.title ?? '');
          }}
          onDelete={setDeleting}
        />
        <div className="flex min-w-0 flex-col gap-3">
          {onPlan && (
            <AskContext
              value={chosen}
              pairs={marketPairs}
              plans={plans.data ?? []}
              symbolOf={symbolOf}
              performanceAllowed={quota.data?.performanceContext ?? false}
              onChange={change}
            />
          )}
          <ChatPanel
            messages={messages.data?.items ?? []}
            loading={messages.isPending && selectedId !== null}
            quota={quota.data}
            asking={ask.pending}
            placeholder={placeholder}
            attachments={attachments}
            emptyAttachmentText={
              chosen.mode === 'mine' ? t.mineNeedsChoice : t.pairNeedsChoice
            }
            canSend={ready}
            suggestions={suggestions}
            onAsk={askQuestion}
          />
        </div>
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
