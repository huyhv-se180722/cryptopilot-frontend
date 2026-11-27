import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
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
import { StyleChip } from '../../features/ai-assistant/components/StyleChip';
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
    <span aria-hidden="true" className="h-7 w-px bg-line-strong xl:hidden" />
  );
  return (
    <div className="flex flex-wrap items-center gap-4">
      <LiveFigure label={t.price}>
        {ticker?.lastPrice ? formatPrice(ticker.lastPrice, pair.tickSize) : '—'}
        {change !== null && (
          <span
            className={classNames(
              'ml-1.5 text-xs',
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
        <span className="text-xs leading-tight text-muted-dim">
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
  // Until the Trader sets the context of the "mine" page, it asks about their
  // first ACTIVE plan (else the first plan), or on PREMIUM without a plan
  // about the performance, so the page is ready to ask when it opens.
  const [contextTouched, setContextTouched] = useState(false);
  const [renaming, setRenaming] = useState<AiConversation | null>(null);
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState<AiConversation | null>(null);
  // An example picked in the side panel goes into the chat's box.
  const [draftRequest, setDraftRequest] = useState<{
    text: string;
    serial: number;
  } | null>(null);

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
  const performanceAllowed = quota.data?.performanceContext ?? false;
  const planList = plans.data ?? [];
  const untouchedMine =
    tab === 'mine' &&
    !contextTouched &&
    context.planId === '' &&
    !context.includePerformance;
  const fallbackPlan = untouchedMine
    ? (planList.find((item) => item.status === 'ACTIVE') ?? planList[0])
    : undefined;
  const fallbackPerformance =
    untouchedMine &&
    plans.data !== undefined &&
    planList.length === 0 &&
    performanceAllowed;
  let chosen: AiContextValue = context;
  if (fallback) chosen = { ...chosen, pairId: fallback.pairId };
  if (fallbackPlan) chosen = { ...chosen, planId: fallbackPlan.id };
  if (fallbackPerformance) chosen = { ...chosen, includePerformance: true };
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
    setContextTouched(true);
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
    if ((await startConversation()) !== null) {
      setSymbolHint(null);
      setContextTouched(false);
      setContext(initialContext(tab, new URLSearchParams()));
    }
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

  const mode = tab === 'market' ? t.modePair : t.modeMine;
  const hasMessages = (messages.data?.items.length ?? 0) > 0;
  const topicLink = (to: string, label: string, mine: boolean) => (
    <NavLink
      to={to}
      className={classNames(
        'inline-flex h-8 items-center rounded-lg px-3.5 text-sm font-semibold no-underline',
        tab === (mine ? 'mine' : 'market')
          ? 'bg-surface text-fg shadow-panel'
          : 'text-muted hover:text-fg',
      )}
    >
      {label}
    </NavLink>
  );

  return (
    <div className="w-full">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="sr-only">{mode}</h1>
        <p aria-hidden="true" className="m-0 text-xl font-semibold text-fg">
          {t.title}
        </p>
        <nav
          aria-label={t.title}
          className="inline-flex rounded-[10px] bg-raised p-0.5"
        >
          {topicLink('/ai/market', t.modePair, false)}
          {topicLink('/ai/my-trading', t.modeMine, true)}
        </nav>
        <p className="m-0 min-w-[200px] flex-1 text-xs text-muted">
          {(tab === 'market' ? t.modePairHint : t.modeMineHint) +
            ' ' +
            t.noAdvice}
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {onPlan && <StyleChip />}
          <QuotaBadge quota={quota.data} />
        </div>
      </header>
      {/* Conversations, chat and context: three columns from 1280 px, the
          context above the chat below that (T-139). */}
      <div
        className={classNames(
          'grid gap-4 lg:h-[calc(100dvh-196px)] lg:min-h-[640px] lg:grid-cols-[280px_minmax(0,1fr)]',
          onPlan &&
            'lg:grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_320px] xl:grid-rows-1',
        )}
      >
        <div
          className={classNames(
            'min-h-0',
            onPlan && 'lg:row-span-2 xl:row-span-1',
          )}
        >
          <ConversationList
            heading={
              tab === 'market' ? t.conversationsPair : t.conversationsMine
            }
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
                ? baseOf(symbolOf(conversation.pairId) ?? '').slice(0, 4) ||
                  null
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
        </div>
        {onPlan && (
          <div className="flex min-w-0 flex-col gap-3 lg:col-start-2 xl:col-start-3 xl:row-start-1 xl:min-h-0 xl:overflow-y-auto">
            {tab === 'market' ? (
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
                plans={planList}
                plansLoaded={plans.data !== undefined}
                symbolOf={symbolOf}
                planTimeframe={plan ? planTimeframe : undefined}
                performanceAllowed={performanceAllowed}
                onChange={change}
              />
            )}
            {hasMessages && (
              <section
                aria-labelledby="ai-panel-suggestions"
                className="hidden rounded-2xl border border-line bg-surface p-3.5 xl:block"
              >
                <h2
                  id="ai-panel-suggestions"
                  className="mb-2 text-sm font-semibold text-fg"
                >
                  {t.suggestionsTitle}
                </h2>
                <ul className="m-0 grid list-none gap-2 p-0">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.key}>
                      <button
                        type="button"
                        onClick={() => {
                          suggestion.onPick?.();
                          setDraftRequest((last) => ({
                            text: suggestion.text,
                            serial: (last?.serial ?? 0) + 1,
                          }));
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-line px-2.5 py-2 text-left text-xs font-medium text-fg hover:border-line-strong hover:bg-raised"
                      >
                        {suggestion.icon}
                        <span className="min-w-0 flex-1">
                          {suggestion.text}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
        <main
          className={classNames(
            'flex min-h-[640px] min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:min-h-0',
            onPlan && 'lg:col-start-2 lg:row-start-2 xl:row-start-1',
          )}
        >
          <ChatPanel
            messages={messages.data?.items ?? []}
            loading={messages.isPending && selectedId !== null}
            quota={quota.data}
            asking={ask.pending}
            placeholder={placeholder}
            attachments={attachments}
            emptyAttachmentText={
              tab === 'market'
                ? t.pairNeedsChoice
                : plans.data !== undefined &&
                    planList.length === 0 &&
                    !performanceAllowed
                  ? t.noPlansCreate
                  : t.mineNeedsChoice
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
            draftRequest={draftRequest}
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
