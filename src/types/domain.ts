/**
 * Frontend domain vocabulary derived from the requirement baseline.
 * These are NOT approved backend wire schemas. Adapters must validate and map DTOs.
 * Financial decimal values remain strings until an agreed decimal calculation layer exists.
 */
export type Decimal = string;
export type ISODateTime = string;
export type MarketType = 'spot' | 'futures';
export type Role = 'Guest' | 'Trader' | 'Admin';
export type AccountRole = Exclude<Role, 'Guest'>;
export type AccountStatus = 'active' | 'suspended' | 'banned';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: AccountRole;
  status: AccountStatus;
}
export interface Entitlements {
  aiAccess: boolean;
  videoPosting: boolean;
}
export interface Session {
  user: User;
  entitlements: Entitlements;
}
export interface MarketQuote {
  symbol: string;
  name: string;
  marketType: MarketType;
  price: Decimal;
  changePercent24h: Decimal;
  volume24h: Decimal;
  observedAt: ISODateTime;
}
export interface CoinAnalysis {
  symbol: string;
  marketType: MarketType;
  timeframe: string;
  observedAt: ISODateTime;
  indicators: ReadonlyArray<{ name: string; value: Decimal | null }>;
}
export interface TradingPlan {
  id: string;
  symbol: string;
  marketType: MarketType;
  entry: Decimal;
  stopLoss: Decimal | null;
  takeProfit: Decimal;
  capital: Decimal;
  leverage: Decimal;
}
export interface JournalEntry {
  id: string;
  planId: string;
  actualPnl: Decimal;
  notes: string;
  closedAt: ISODateTime;
}
export interface PriceAlert {
  id: string;
  symbol: string;
  marketType: MarketType;
  threshold: Decimal;
  triggeredAt: ISODateTime | null;
}
export interface CommunityPost {
  id: string;
  authorId: string;
  body: string;
  publishedAt: ISODateTime;
}
export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  originalUrl: string;
  publishedAt: ISODateTime;
}
export interface AiConversation {
  id: string;
  title: string;
  updatedAt: ISODateTime;
}
export interface SubscriptionPackage {
  id: string;
  name: string;
  price: Decimal;
  currency: string;
  durationDays: number;
  entitlements: Entitlements;
}
export interface AdminLog {
  id: string;
  action: string;
  createdAt: ISODateTime;
}
