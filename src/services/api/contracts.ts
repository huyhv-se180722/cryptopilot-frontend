import type {
  AdminLog,
  AiConversation,
  Alert,
  AlertListQuery,
  AlertPage,
  AlertRule,
  CommunityPost,
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
  /** DRAFT → ACTIVE after the server re-checks price, warnings and limit (UC-18). */
  activate(id: string): Promise<TradingPlan>;
  /** DRAFT or ACTIVE → CANCELLED (UC-19). */
  cancel(id: string): Promise<TradingPlan>;
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
  ): Promise<TradingPlan>;
}
/** The signed-in Trader's watchlist (`/watchlist/**`; SRS 3.4.1). */
export interface WatchlistService {
  get(signal?: AbortSignal): Promise<Watchlist>;
  /** Appends a pair; the UI cannot name one until FEQ-01 gives pair ids. */
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
}
export type JournalService = ReadService<JournalEntry>;
export type CommunityService = ReadService<CommunityPost>;
export type NewsService = ReadService<NewsArticle>;
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
