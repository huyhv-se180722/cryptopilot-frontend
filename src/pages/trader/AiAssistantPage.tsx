import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  ChartCandlestick,
  ClipboardList,
  Gauge,
  Layers,
  Percent,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { aiErrorText } from '../../features/ai-assistant/ai-assistant-errors';
import {
  askedPair,
  askedPlan,
  asksPerformance,
  baseOf,
  isReady,
  NO_CONTEXT,
  toQuestion,
  type AiContextValue,
} from '../../features/ai-assistant/ai-context';
import { OPEN_AI_BUBBLE_EVENT } from '../../features/ai-assistant/components/AiChatBubble';
import {
  LiveFigure,
  MarketContextBar,
  MineContextBar,
} from '../../features/ai-assistant/components/AskContext';
import {
  ChatPanel,
  QuotaBadge,
  SuggestionIcon,
  type AskAttachment,
  type AskSuggestion,
  type ChatAccent,
} from '../../features/ai-assistant/components/ChatPanel';
import { ConversationList } from '../../features/ai-assistant/components/ConversationList';
import {
  useAiAnswerPush,
  useAiConversations,
  useAiMessages,
  useAiPlan,
  useAiPlans,
  useAiQuota,
  useAskQuestion,
  useDeleteConversation,
  useRenameConversation,
  useStartConversation,
} from '../../features/ai-assistant/hooks/use-ai-assistant';
import { useLiveTicker } from '../../features/analysis/hooks/use-live-ticker';
import { usePairAnalysis } from '../../features/analysis/hooks/use-pair-analysis';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import { I18nProvider } from '../../i18n/I18nProvider';
import type {
  AiConversation,
  AiConversationTopic,
  MarketPair,
  MarketType,
  PlanTimeframe,
} from '../../types/domain';
import { classNames } from '../../utils/class-names';
import { formatPrice, toFixedDecimal } from '../../utils/decimal-format';

const TITLE_MAX = 100;
/** The pair the market page starts on when none is chosen yet. */
const DEFAULT_SYMBOL = 'BTCUSDT';
/** The series the backend analyses a pair on when a plan names none. */
const DEFAULT_TIMEFRAME = '1h';

type Tab = 'market' | 'mine';
const TOPIC: Record<Tab, AiConversationTopic> = {
  market: 'MARKET',
  mine: 'MY_TRADING',
};
const ACCENT: Record<Tab, ChatAccent> = { market: 'primary', mine: 'purple' };
const TILE: Record<Tab, string> = {
  market: 'bg-primary-soft text-primary',
  mine: 'bg-purple-soft text-purple',
};

/**
 * SCR-29 AI Assistant (SRS 3.9.1, UC-35, UC-36, T-076), split in two pages
 * the AI entry of the TopNav opens: `/ai/market` (market analysis, blue)
 * and `/ai/my-trading` (my plan and performance, purple). Each page has its
 * own conversations (a conversation keeps its topic), its own context bar
 * above the chat and its own example questions, so a question never mixes
 * the two (BR-51). General questions (no data) are asked from the floating
 * chat, which a link under the box opens. An analysis screen opens the
 * market page with `?symbol=<pair>&market=<spot|futures>` (or `?pair=<id>`);
 * `/ai` stays the market page. The answer arrives later (pushed, or read
 * again while pending); every answer carries the disclaimer (BR-51). On FREE
 * the conversations stay readable with the upgrade prompt (BR-50, BR-52).
 * The screen is in Vietnamese, like the answers.
 */
export function AiMarketPage() {
  return (
    <I18nProvider locale="vi">
      <AiAssistantScreen tab="market" />
    </I18nProvider>
  );
}

/** SCR-29, "my plan and performance": see {@link AiMarketPage}. */
export function AiMyTradingPage() {
  return (
    <I18nProvider locale="vi">
      <AiAssistantScreen tab="mine" />
    </I18nProvider>
  );
}

function AiAssistantScreen({ tab }: { tab: Tab }) {
  useAiAnswerPush();
  return <TopicWorkspace tab={tab} />;
}

function initialContext(tab: Tab, params: URLSearchParams): AiContextValue {
  if (tab === 'mine') return { ...NO_CONTEXT, mode: 'mine' };
  return {
    ...NO_CONTEXT,
    mode: 'pair',
    market:
      params.get('market')?.toLowerCase() === 'futures' ? 'futures' : 'spot',
    pairId: params.get('pair') ?? '',
  };
}

function marketLabel(market: AiContextValue['market']) {
  return market === 'futures' ? 'Futures' : 'Spot';
}

function scoreTone(score: number) {
  if (score >= 70) return 'bg-positive-soft text-positive';
  if (score >= 40) return 'bg-warning-soft text-warning';
  return 'bg-negative-soft text-negative';
}

/** The live price, RSI and setup score of the market page's pair. */
function MarketLive({
  market,
  pair,
  timeframe,
}: {
  market: MarketType;
  pair: MarketPair;
  timeframe: PlanTimeframe;
}) {
  const t = useCopy().aiAssistant;
  const { ticker } = useLiveTicker(market, pair.symbol);
  const analysis = usePairAnalysis(market, pair.symbol, timeframe);
  const change = ticker?.changePercent24h ?? null;
  const rsi = analysis.data?.indicators.rsi14 ?? null;
  const score = analysis.data?.setupScore.score ?? null;
  const divider = (
    <span aria-hidden="true" className="h-7 w-px bg-line-strong" />
  );
  return (
    <div className="flex flex-wrap items-center gap-4">
      <LiveFigure label={t.price}>
        {ticker?.lastPrice ? formatPrice(ticker.lastPrice, pair.tickSize) : '—'}
        {change !== null && (
          <span
            className={classNames(
              'ml-1.5 text-[11.5px]',
              change.startsWith('-') ? 'text-negative' : 'text-positive',
            )}
          >
            {(change.startsWith('-') ? '' : '+') +
              toFixedDecimal(change, 2) +
              '%'}
          </span>
        )}
      </LiveFigure>
      {divider}
      <LiveFigure label={t.rsi}>
        {rsi === null ? '—' : toFixedDecimal(rsi, 1)}
      </LiveFigure>
      {divider}
      <span className="inline-flex items-center gap-2">
        <span className="text-[10.5px] leading-tight text-muted-dim">
          {t.setupScore}
        </span>
        <span
          className={classNames(
            'inline-flex h-7 min-w-11 items-center justify-center rounded-lg px-2 font-mono text-sm font-bold',
            score === null ? 'bg-raised text-muted' : scoreTone(score),
          )}
        >
          {score ?? '—'}
        </span>
      </span>
    </div>
  );
}

/** One page: its conversations, its context and its chat. */
function TopicWorkspace({ tab }: { tab: Tab }) {
  const copy = useCopy();
  const t = copy.aiAssistant;
  const { show } = useToast();
  const topic = TOPIC[tab];
  const accent = ACCENT[tab];
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('c');
  const [context, setContext] = useState<AiContextValue>(() =>
    initialContext(tab, params),
  );
  // The coin the market page falls back to while none is picked: the one an
  // analysis screen named, else BTCUSDT.
  const [symbolHint, setSymbolHint] = useState(params.get('symbol'));
  const [renaming, setRenaming] = useState<AiConversation | null>(null);
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState<AiConversation | null>(null);

  const conversations = useAiConversations(topic);
  const quota = useAiQuota();
  const messages = useAiMessages(selectedId);
  const onPlan = quota.data !== undefined && quota.data.limit !== 0;
  const spotPairs = useMarketPairs('spot');
  const futuresPairs = useMarketPairs('futures');
  const plans = useAiPlans(onPlan && tab === 'mine');
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
  // Open the latest conversation of this page when none is chosen.
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
    const result = await start.run(
      topic,
      tab === 'market' ? askedPair(chosen) : null,
    );
    if (result.status === 'success') {
      select(result.data.id);
      return result.data.id;
    }
    if (result.status === 'error')
      show({ tone: 'error', message: aiErrorText(copy, result.error) });
    return null;
  }

  async function newConversation() {
    if ((await startConversation()) !== null)
      change(initialContext(tab, new URLSearchParams()));
  }

  async function askQuestion(text: string): Promise<boolean> {
    // The first question of a page without a conversation starts one.
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
  const livePair = marketPairs.find((pair) => pair.pairId === pairId);
  const planId = askedPlan(chosen);
  const plan = plans.data?.find((item) => item.id === planId);
  const planDetail = useAiPlan(plan ? plan.id : null);
  const planTimeframe =
    planDetail.data?.analysisTimeframe ??
    (planDetail.isPending ? undefined : DEFAULT_TIMEFRAME);
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
  // A plan goes with the analysis of its own pair, on its market and on the
  // timeframe it was made on; it cannot be dropped apart from the plan.
  if (plan)
    attachments.push({
      key: 'plan-market',
      label: formatCopy(t.planMarketChip, {
        symbol: symbolOf(plan.pairId) ?? '',
        market: marketLabel(plan.market),
        timeframe: planTimeframe ?? '…',
      }),
    });
  if (asksPerformance(chosen))
    attachments.push({
      key: 'performance',
      label: t.performanceChip,
      onRemove: () => change({ ...chosen, includePerformance: false }),
    });
  const placeholder =
    tab === 'mine'
      ? t.placeholderMine
      : formatCopy(t.placeholderPair, {
          symbol: pairSymbol ?? '',
          market: marketLabel(chosen.market),
          timeframe: chosen.timeframe,
        });
  const performanceAllowed = quota.data?.performanceContext ?? false;
  const icon = (node: ReactNode, tone: string) => (
    <SuggestionIcon className={tone}>{node}</SuggestionIcon>
  );
  const suggestions: AskSuggestion[] =
    tab === 'market'
      ? [
          {
            key: 'pair',
            text: t.suggestionPair,
            hint: t.suggestionPairHint,
            icon: icon(
              <TrendingUp size={16} />,
              'bg-primary-soft text-primary',
            ),
            onPick: () => {
              setContext({
                ...chosen,
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
            hint: t.suggestionSetupHint,
            icon: icon(<Gauge size={16} />, 'bg-warning-soft text-warning'),
          },
          {
            key: 'levels',
            text: t.suggestionLevels,
            hint: t.suggestionLevelsHint,
            icon: icon(<Layers size={16} />, 'bg-accent-soft text-accent'),
          },
          {
            key: 'funding',
            text: t.suggestionFunding,
            hint: t.suggestionFundingHint,
            icon: icon(<Zap size={16} />, 'bg-purple-soft text-purple'),
            onPick: () => change({ ...chosen, market: 'futures', pairId: '' }),
          },
        ]
      : [
          {
            key: 'plan',
            text: t.suggestionPlanRisk,
            hint: t.suggestionPlanRiskHint,
            icon: icon(
              <AlertTriangle size={16} />,
              'bg-negative-soft text-negative',
            ),
          },
          {
            key: 'score',
            text: t.suggestionPlanScore,
            hint: t.suggestionPlanScoreHint,
            icon: icon(
              <TrendingUp size={16} />,
              'bg-primary-soft text-primary',
            ),
          },
          {
            key: 'fees',
            text: t.suggestionPlanFees,
            hint: t.suggestionPlanFeesHint,
            icon: icon(<Percent size={16} />, 'bg-warning-soft text-warning'),
          },
          {
            key: 'performance',
            text: t.suggestionPerformance,
            hint: t.suggestionPerformanceHint,
            icon: icon(<BarChart3 size={16} />, 'bg-purple-soft text-purple'),
            onPick: () => {
              if (performanceAllowed)
                change({ ...chosen, includePerformance: true });
            },
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
      <div className="grid gap-4 lg:h-[calc(100dvh-136px)] lg:min-h-[640px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <ConversationList
          heading={tab === 'market' ? t.conversationsPair : t.conversationsMine}
          emptyHint={
            tab === 'market'
              ? t.noConversationsPairHint
              : t.noConversationsMineHint
          }
          conversations={items}
          loading={conversations.isPending}
          selectedId={selectedId}
          canStart={onPlan}
          starting={start.pending}
          accent={accent}
          badgeOf={(conversation) =>
            conversation.pairId
              ? baseOf(symbolOf(conversation.pairId) ?? '').slice(0, 4) || null
              : null
          }
          onSelect={select}
          onStart={() => void newConversation()}
          onRename={(conversation) => {
            setRenaming(conversation);
            setTitle(conversation.title ?? '');
          }}
          onDelete={setDeleting}
        />
        <main className="flex min-h-[640px] min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:min-h-0">
          <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <span
              aria-hidden="true"
              className={classNames(
                'inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]',
                TILE[tab],
              )}
            >
              {tab === 'market' ? (
                <ChartCandlestick size={19} />
              ) : (
                <ClipboardList size={19} />
              )}
            </span>
            <div className="min-w-[200px] flex-1">
              <p className="m-0 text-[10.5px] font-semibold tracking-wider text-muted-dim uppercase">
                {t.title}
              </p>
              <h1 className="m-0 text-base font-semibold text-fg">
                {tab === 'market' ? t.modePair : t.modeMine}
              </h1>
              <p className="m-0 mt-0.5 text-xs text-muted">
                {(tab === 'market' ? t.modePairHint : t.modeMineHint) +
                  ' ' +
                  t.noAdvice}
              </p>
            </div>
            <QuotaBadge quota={quota.data} />
          </header>
          {onPlan &&
            (tab === 'market' ? (
              <MarketContextBar
                value={chosen}
                pairs={marketPairs}
                symbol={pairSymbol}
                live={
                  livePair && (
                    <MarketLive
                      market={chosen.market}
                      pair={livePair}
                      timeframe={chosen.timeframe}
                    />
                  )
                }
                onChange={change}
              />
            ) : (
              <MineContextBar
                value={chosen}
                plans={plans.data ?? []}
                symbolOf={symbolOf}
                planTimeframe={plan ? planTimeframe : undefined}
                performanceAllowed={performanceAllowed}
                onChange={change}
              />
            ))}
          <ChatPanel
            messages={messages.data?.items ?? []}
            loading={messages.isPending && selectedId !== null}
            quota={quota.data}
            asking={ask.pending}
            placeholder={placeholder}
            attachments={attachments}
            emptyAttachmentText={
              tab === 'mine' ? t.mineNeedsChoice : t.pairNeedsChoice
            }
            canSend={isReady(chosen)}
            accent={accent}
            welcome={
              tab === 'market'
                ? { title: t.welcomePairTitle, body: t.welcomePairBody }
                : { title: t.welcomeMineTitle, body: t.welcomeMineBody }
            }
            suggestions={suggestions}
            footer={
              <>
                {t.privacy + ' ' + t.generalTip + ' '}
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(new Event(OPEN_AI_BUBBLE_EVENT))
                  }
                  className="font-semibold text-primary hover:underline"
                >
                  {t.generalTipAction}
                </button>
              </>
            }
            onAsk={askQuestion}
          />
        </main>
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
