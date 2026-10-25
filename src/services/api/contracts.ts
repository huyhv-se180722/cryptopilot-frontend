import type {
  AdminLog,
  AiConversation,
  Alert,
  AlertListQuery,
  AlertPage,
  AlertRule,
  AnnouncementDraft,
  CoinDiscussion,
  CommentPage,
  Engagement,
  FeedQuery,
  MemberProfile,
  PostComment,
  PostDetail,
  PostDraft,
  PostMediaKind,
  PostMediaRef,
  PostPage,
  PostReport,
  OfficialCategory,
  AppNotification,
  ModerationAction,
  ModerationCase,
  ModerationQueuePage,
  ModerationResult,
  NotificationPage,
  JournalEntry,
  Candle,
  CandleTimeframe,
  FuturesMetrics,
  ISODateTime,
  KlineUpdate,
  MarketOverview,
  MarketPair,
  MarketTicker,
  MarketTrade,
  OrderBook,
  MarketType,
  PairAnalysis,
  PaperAccount,
  PaperAccountEvent,
  PaperEquity,
  SpotPnl,
  PaperFill,
  PaperHistoryQuery,
  PaperLedgerEntry,
  PaperLedgerQuery,
  PaperOrder,
  PaperPage,
  PaperTransfer,
  PaperWallet,
  PaperWalletType,
  PlacePaperOrder,
  PlacePaperOrderList,
  PaperOrderList,
  PlanCalculation,
  PlanInputs,
  PlanListQuery,
  PlanPage,
  NewsArticle,
  ProfileUpdate,
  RiskProfile,
  RiskProfileParams,
  RiskQuestion,
  RiskSuggestion,
  UserProfile,
  SubscriptionPackage,
  TradingPlan,
  Watchlist,
  WatchlistItem,
  WatchlistItemUpdate,
} from '../../types/domain';

/** UI-facing contracts only. Pagination and transport DTOs need backend agreement. */
export interface ListRequest {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}
export interface ListResponse<T> {
  items: readonly T[];
  nextCursor: string | null;
}
export interface ReadService<T> {
  list(request?: ListRequest): Promise<ListResponse<T>>;
}
export interface CandlesRequest {
  market: MarketType;
  symbol: string;
  timeframe: CandleTimeframe;
  limit: number;
  /** Only candles opened before this instant (the backend's `to`). */
  before?: ISODateTime;
  signal?: AbortSignal;
}
/** Public market data (`/market/**`, SRS 3.3.1); no token needed. */
export interface MarketService {
  /** Every enabled pair of a market, in admin display order. */
  listPairs(
    market: MarketType,
    signal?: AbortSignal,
  ): Promise<readonly MarketPair[]>;
  /** Closed candles, oldest first. */
  getCandles(request: CandlesRequest): Promise<readonly Candle[]>;
  /**
   * Stored ticker snapshot (up to about a minute old) for the Delayed
   * fallback (CR-09); null until the backend has one.
   */
  getTicker(
    market: MarketType,
    symbol: string,
    signal?: AbortSignal,
  ): Promise<MarketTicker | null>;
  /**
   * Open interest, long/short ratio and settled funding series of a
   * Futures pair from `from` to now (at most 7 days; SRS 3.3.3).
   */
  getFuturesMetrics(
    symbol: string,
    from: ISODateTime,
    signal?: AbortSignal,
  ): Promise<FuturesMetrics>;
}

export type FeedStatus = 'connecting' | 'open' | 'closed' | 'unavailable';
/** Realtime market topics over STOMP (TD 9); public, no token. */
export interface MarketFeed {
  status(): FeedStatus;
  onStatus(listener: () => void): () => void;
  subscribeOverview(
    market: MarketType,
    listener: (overview: MarketOverview) => void,
  ): () => void;
  /** One pair's ticker, at most once a second (`/topic/ticker.*`). */
  subscribeTicker(
    market: MarketType,
    symbol: string,
    listener: (ticker: MarketTicker) => void,
  ): () => void;
  /** Closed and forming candles of one series (`/topic/kline.*`). */
  subscribeKline(
    market: MarketType,
    symbol: string,
    timeframe: CandleTimeframe,
    listener: (update: KlineUpdate) => void,
  ): () => void;
}
/**
 * Order book and market trades of the trading screens (TR-03, public):
 * `GET /market/{market}/{symbol}/depth` and `/trades`, then the topics
 * `/topic/depth.*` (a whole newer book each time) and `/topic/trades.*`
 * (the trades since the previous push, oldest first).
 */
export interface TradingMarketService {
  getDepth(
    market: MarketType,
    symbol: string,
    signal?: AbortSignal,
  ): Promise<OrderBook>;
  /** The latest trades, newest first (at most 50). */
  getTrades(
    market: MarketType,
    symbol: string,
    limit: number,
    signal?: AbortSignal,
  ): Promise<readonly MarketTrade[]>;
  subscribeDepth(
    market: MarketType,
    symbol: string,
    listener: (book: OrderBook) => void,
  ): () => void;
  subscribeTrades(
    market: MarketType,
    symbol: string,
    listener: (trades: readonly MarketTrade[]) => void,
  ): () => void;
}
/** `GET /analysis/{market}/{symbol}` (Trader; SRS 3.3.2, 3.3.3). */
export interface AnalysisService {
  get(
    market: MarketType,
    symbol: string,
    timeframe: CandleTimeframe,
    signal?: AbortSignal,
  ): Promise<PairAnalysis>;
}
/** Trading plans of the signed-in Trader (`/plans/**`; SRS 3.5.1–3.5.3). */
export interface TradingPlanService {
  list(query: PlanListQuery, signal?: AbortSignal): Promise<PlanPage>;
  get(id: string, signal?: AbortSignal): Promise<TradingPlan>;
  /**
   * DRAFT → ACTIVE after the server re-checks price, warnings and limit
   * (UC-18). A MARKET entry that moved 0.25 R or more is refused with MSG51
   * until repeated with `confirmDeviation` (TP-C); beyond the limit, MSG52.
   */
  activate(id: string, confirmDeviation?: boolean): Promise<TradingPlan>;
  /** DRAFT or ACTIVE → CANCELLED (UC-19). */
  cancel(id: string): Promise<TradingPlan>;
  /**
   * A new plan on a pair of the market lists (UC-16): a DRAFT, or ACTIVE
   * with `activate`; nothing is saved when activation is refused (MSG18,
   * MSG27). 403 MSG29 for a Futures plan outside the caller's plan.
   */
  create(
    pairId: string,
    inputs: PlanInputs,
    activate: boolean,
    confirmDeviation?: boolean,
  ): Promise<TradingPlan>;
  /** SCR-17 risk panel for the values entered; nothing is saved. */
  calculate(
    pairId: string,
    inputs: PlanInputs,
    signal?: AbortSignal,
  ): Promise<PlanCalculation>;
  /**
   * Replaces a DRAFT's inputs (UC-17); with `activate` it is activated in the
   * same request, and nothing is saved when activation is refused.
   */
  update(
    id: string,
    inputs: PlanInputs,
    activate: boolean,
    confirmDeviation?: boolean,
  ): Promise<TradingPlan>;
}
/** The signed-in Trader's watchlist (`/watchlist/**`; SRS 3.4.1). */
export interface WatchlistService {
  get(signal?: AbortSignal): Promise<Watchlist>;
  /** Appends a pair, named by the id the market list gives (FEQ-01). */
  add(pairId: string): Promise<WatchlistItem>;
  update(id: string, update: WatchlistItemUpdate): Promise<WatchlistItem>;
  /**
   * Removes the row and all its alerts (BR-16). Without `confirmedAlerts`
   * the server refuses with MSG26 when the row has alerts; pass the `n` the
   * Trader confirmed, and it refuses again if the count changed meanwhile.
   */
  remove(id: string, confirmedAlerts?: number): Promise<void>;
}
/** The signed-in Trader's alerts (`/alerts/**`; SRS 3.4.2, 3.4.3). */
export interface AlertsService {
  list(query: AlertListQuery, signal?: AbortSignal): Promise<AlertPage>;
  /** ACTIVE at once; the pair joins the watchlist if needed (BR-16). */
  create(pairId: string, rule: AlertRule): Promise<Alert>;
  /** A TRIGGERED or EXPIRED alert becomes ACTIVE; a PAUSED one stays PAUSED. */
  update(id: string, rule: AlertRule): Promise<Alert>;
  remove(id: string): Promise<void>;
  pause(id: string): Promise<Alert>;
  /** PAUSED → ACTIVE within the current plan's limits (BR-17, BR-64). */
  resume(id: string): Promise<Alert>;
}
/**
 * Demo trading (`/paper/**`, D-86, Trader only): virtual funds, never an
 * exchange. Grows with TR-F2…F5 (wallets, orders, positions).
 */
export interface PaperTradingService {
  /** Opens the caller's account with its virtual funds, once; idempotent (TR-04). */
  openAccount(signal?: AbortSignal): Promise<PaperAccount>;
  /** One wallet with its balances valued in USDT and BTC (TR-04). */
  getWallet(
    wallet: PaperWalletType,
    signal?: AbortSignal,
  ): Promise<PaperWallet>;
  /** Moves USDT out of `from` into the other wallet, once per `clientTransferId`. */
  transfer(transfer: {
    asset: 'USDT';
    from: PaperWalletType;
    amount: string;
    clientTransferId: string;
  }): Promise<PaperTransfer>;
  /** Transfers between the wallets, newest first. */
  transfers(
    query: { page: number; pageSize: number },
    signal?: AbortSignal,
  ): Promise<PaperPage<PaperTransfer>>;
  /** Every balance change (transaction history), newest first. */
  ledger(
    query: PaperLedgerQuery,
    signal?: AbortSignal,
  ): Promise<PaperPage<PaperLedgerEntry>>;
  /** Places a Spot order of any Spot type, once per `clientOrderId` (TR-06, TR-09, TR-11, TR-12). */
  placeOrder(order: PlacePaperOrder): Promise<PaperOrder>;
  /** Places an OCO, OTO or OTOCO (TR-10). */
  placeOrderList(list: PlacePaperOrderList): Promise<PaperOrderList>;
  /** Cancels a working order and releases what it locked; for an order of a group, the group. */
  cancelOrder(orderId: string): Promise<PaperOrder>;
  /** Cancels every order of a group that works or waits. */
  cancelOrderList(listId: string): Promise<PaperOrderList>;
  /** Cancels every working order on one pair. */
  cancelAll(pairId: string): Promise<readonly PaperOrder[]>;
  /** Working orders, newest first; every pair when `pairId` is null (TR-07). */
  openOrders(
    pairId: string | null,
    signal?: AbortSignal,
  ): Promise<readonly PaperOrder[]>;
  /** Order history, newest first. */
  orders(
    query: PaperHistoryQuery,
    signal?: AbortSignal,
  ): Promise<PaperPage<PaperOrder>>;
  /** Trade history (every fill), newest first. */
  fills(
    query: PaperHistoryQuery,
    signal?: AbortSignal,
  ): Promise<PaperPage<PaperFill>>;
  /** Each Spot coin's average cost, value and unrealised PnL (TR-13). */
  spotPnl(signal?: AbortSignal): Promise<SpotPnl>;
  /** The account's worth now, today's PnL and the last `days` days (1–365). */
  equity(days: number, signal?: AbortSignal): Promise<PaperEquity>;
  /**
   * The pushes of the caller's account (TR-08), each after its change was
   * committed. A push missed (while not open) shows on the next read.
   */
  subscribeAccount(listener: (event: PaperAccountEvent) => void): () => void;
  /** 'open' while the pushes arrive; screens read on a rhythm otherwise. */
  accountFeedStatus(): FeedStatus;
  onAccountFeedStatus(listener: () => void): () => void;
}
export type JournalService = ReadService<JournalEntry>;
/** What a reaction is on: a post (like, save) or a comment (like only). */
export type ReactionTarget =
  | { kind: 'post'; id: string; action: 'like' | 'save' }
  | { kind: 'comment'; id: string; action: 'like' };

/**
 * The community (SRS 3.7, D-98, D-99): Guests read the feed, a post, its
 * comments and member pages; writing, reacting and reporting are a
 * Trader's. Media goes straight from the browser to the media storage on a
 * form the backend signs, and the post names it by its key.
 */
export interface CommunityService {
  feed(query: FeedQuery, signal?: AbortSignal): Promise<PostPage>;
  /** Published announcements, newest first (BR-61). */
  pinned(
    query: { category?: OfficialCategory; page: number; pageSize: number },
    signal?: AbortSignal,
  ): Promise<PostPage>;
  coinDiscussion(symbol: string, signal?: AbortSignal): Promise<CoinDiscussion>;
  post(id: string, signal?: AbortSignal): Promise<PostDetail>;
  create(draft: PostDraft): Promise<PostDetail>;
  /** Files of the post not named again are deleted. */
  update(id: string, draft: PostDraft): Promise<PostDetail>;
  remove(id: string): Promise<void>;
  react(target: ReactionTarget, active: boolean): Promise<Engagement>;
  comments(
    postId: string,
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ): Promise<CommentPage>;
  comment(
    postId: string,
    content: string,
    parentCommentId: string | null,
  ): Promise<PostComment>;
  editComment(id: string, content: string): Promise<PostComment>;
  removeComment(id: string): Promise<void>;
  report(postId: string, report: PostReport): Promise<void>;
  member(id: string, signal?: AbortSignal): Promise<MemberProfile>;
  /**
   * Signs a form, checks the file against its limits (MSG32) and uploads
   * it; the key goes into the post. `onProgress` gets 0–1.
   */
  upload(
    file: File,
    kind: PostMediaKind,
    onProgress?: (share: number) => void,
    signal?: AbortSignal,
  ): Promise<PostMediaRef>;
}
export type NewsService = ReadService<NewsArticle>;

/**
 * The report moderation queue of SCR-36 (SRS 3.11.3, UC-43), Admin only:
 * posts with open reports, opening one (its reports become REVIEWING),
 * deciding all its reports at once, reading any post and restoring a
 * hidden one. Every decision is audited by the backend (BR-57).
 */
export interface ModerationService {
  queue(
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ): Promise<ModerationQueuePage>;
  open(postId: string, signal?: AbortSignal): Promise<ModerationCase>;
  decide(
    postId: string,
    action: ModerationAction,
    note: string | null,
  ): Promise<ModerationResult>;
  post(id: string, signal?: AbortSignal): Promise<PostDetail>;
  restore(id: string): Promise<PostDetail>;
}

/**
 * The official announcements of the administration console (UC-44,
 * BR-61), Admin only: published and hidden ones, newest first; written
 * with the SCR-26 form and a category, pinned above the community feed.
 */
export interface AnnouncementService {
  list(
    query: { category?: OfficialCategory; page: number; pageSize: number },
    signal?: AbortSignal,
  ): Promise<PostPage>;
  /** Any post by id, whatever its status (BR-47). */
  get(id: string, signal?: AbortSignal): Promise<PostDetail>;
  create(draft: AnnouncementDraft): Promise<PostDetail>;
  update(id: string, draft: AnnouncementDraft): Promise<PostDetail>;
  remove(id: string): Promise<void>;
}

/**
 * The notification center and the bell (SRS 3.4.5, UC-15): the caller's
 * notifications newest first, the unread count, marking read, and the
 * pushes of new ones on the signed-in connection.
 */
export interface NotificationService {
  list(
    query: { unreadOnly: boolean; page: number; pageSize: number },
    signal?: AbortSignal,
  ): Promise<NotificationPage>;
  unreadCount(signal?: AbortSignal): Promise<number>;
  /** Opening a notification marks it read; a read one keeps its time. */
  markRead(id: string): Promise<AppNotification>;
  /** Resolves with the unread count after, zero. */
  markAllRead(): Promise<number>;
  /** New notifications as they are written; a missed one shows on the next read. */
  subscribe(listener: (notification: AppNotification) => void): () => void;
  /** 'open' while the pushes arrive; the bell reads on a rhythm otherwise. */
  feedStatus(): FeedStatus;
  onFeedStatus(listener: () => void): () => void;
}
export type AiService = ReadService<AiConversation>;
export type SubscriptionService = ReadService<SubscriptionPackage>;
export type AdminService = ReadService<AdminLog>;

/** Account settings of the signed-in Trader (`/me/*`; the password is in `AuthService`). */
export interface ProfileService {
  get(signal?: AbortSignal): Promise<UserProfile>;
  update(update: ProfileUpdate): Promise<void>;
  updateNotifications(preferences: {
    email: boolean;
    push: boolean;
  }): Promise<void>;
  getRiskProfile(signal?: AbortSignal): Promise<RiskProfileParams>;
  /** AGGRESSIVE requires the MSG48 confirmation first. */
  chooseRiskProfile(
    profile: RiskProfile,
    confirmAggressive: boolean,
  ): Promise<void>;
  getQuestionnaire(signal?: AbortSignal): Promise<readonly RiskQuestion[]>;
  suggestRiskProfile(
    answers: Readonly<Record<string, string>>,
  ): Promise<RiskSuggestion>;
}
