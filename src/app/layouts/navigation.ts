import {
  BarChart2,
  Bell,
  BellRing,
  BookOpen,
  CandlestickChart,
  Bot,
  Coins,
  CreditCard,
  FileText,
  LayoutDashboard,
  Layers,
  MessageSquare,
  Newspaper,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Star,
  TrendingUp,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Copy } from '../../i18n/locales/en';
import { paperTradingEnabled } from '../config/features';

/** Navigation is UI configuration; paths match app/router/route-definitions. */
export interface NavItem {
  to: string;
  labelKey: keyof Copy['nav'];
  icon: LucideIcon;
  /** Match only the exact path (for index-like destinations). */
  end?: boolean;
}

export interface AdminNavItem {
  to: string;
  labelKey: keyof Copy['admin'];
  icon: LucideIcon;
  end?: boolean;
}

export interface AdminNavGroup {
  headingKey?: keyof Copy['admin'];
  items: readonly AdminNavItem[];
}

/** Figma TopNav destinations (Alerts added from the Figma sidebar). */
export const traderNav: readonly NavItem[] = [
  { to: '/dashboard', labelKey: 'overview', icon: LayoutDashboard },
  { to: '/markets', labelKey: 'markets', icon: TrendingUp },
  // Demo trading (D-86) only behind its flag (D-101).
  ...(paperTradingEnabled
    ? [
        {
          to: '/trade/spot',
          labelKey: 'trade',
          icon: CandlestickChart,
        } as const,
      ]
    : []),
  { to: '/watchlist', labelKey: 'watchlist', icon: Star },
  { to: '/alerts', labelKey: 'alerts', icon: Bell },
  { to: '/plans', labelKey: 'plans', icon: FileText },
  { to: '/journal', labelKey: 'journal', icon: BookOpen },
  { to: '/performance', labelKey: 'performance', icon: BarChart2 },
  { to: '/ai', labelKey: 'ai', icon: Bot },
  { to: '/news', labelKey: 'news', icon: Newspaper },
  { to: '/community', labelKey: 'community', icon: Users },
];

/** Account destinations (avatar menu, bell, plan chip). */
export const traderAccountNav: readonly NavItem[] = [
  { to: '/notifications', labelKey: 'notifications', icon: BellRing },
  { to: '/profile', labelKey: 'profile', icon: User },
  {
    to: '/subscription',
    labelKey: 'subscription',
    icon: CreditCard,
    end: true,
  },
  { to: '/subscription/payments', labelKey: 'payments', icon: Receipt },
];

/** Figma floating mobile dock; the rest is under "More". */
export const traderDock: readonly NavItem[] = [
  { to: '/dashboard', labelKey: 'overview', icon: LayoutDashboard },
  { to: '/markets', labelKey: 'markets', icon: TrendingUp },
  { to: '/plans', labelKey: 'plansShort', icon: FileText },
  { to: '/ai', labelKey: 'ai', icon: Bot },
];

export const adminNav: readonly AdminNavGroup[] = [
  {
    items: [
      { to: '/admin', labelKey: 'overview', icon: LayoutDashboard, end: true },
    ],
  },
  {
    headingKey: 'groupPlatform',
    items: [
      { to: '/admin/users', labelKey: 'users', icon: Users },
      { to: '/admin/pairs', labelKey: 'pairs', icon: Coins },
      { to: '/admin/leverage-brackets', labelKey: 'brackets', icon: Layers },
      { to: '/admin/packages', labelKey: 'packages', icon: Package },
      { to: '/admin/payments', labelKey: 'payments', icon: CreditCard },
    ],
  },
  {
    headingKey: 'groupContent',
    items: [
      { to: '/admin/reports', labelKey: 'reports', icon: MessageSquare },
      { to: '/admin/news-sources', labelKey: 'newsSources', icon: Newspaper },
    ],
  },
  {
    headingKey: 'groupSystem',
    items: [
      { to: '/admin/ai-config', labelKey: 'aiConfig', icon: Bot },
      { to: '/admin/settings', labelKey: 'settings', icon: Settings },
      { to: '/admin/audit-log', labelKey: 'auditLog', icon: ScrollText },
      { to: '/admin/account', labelKey: 'account', icon: ShieldCheck },
    ],
  },
];
