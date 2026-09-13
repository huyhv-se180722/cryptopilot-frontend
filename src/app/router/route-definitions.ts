/** Route metadata is UI configuration, never business data. */
export const guestRoutes = [
  { path: '/', title: 'CryptoPilot' },
  { path: '/markets', title: 'Markets' },
  { path: '/markets/:symbol', title: 'Coin analysis' },
  { path: '/community', title: 'Community' },
  { path: '/news', title: 'News' },
  { path: '/login', title: 'Sign in' },
  { path: '/register', title: 'Create account' },
] as const;
export const traderRoutes = [
  { path: '/dashboard', title: 'Dashboard' },
  { path: '/trading-plans', title: 'Trading plans' },
  { path: '/journal', title: 'Journal' },
  { path: '/alerts', title: 'Alerts' },
  { path: '/ai', title: 'AI assistant' },
  { path: '/profile', title: 'Profile' },
  { path: '/subscription', title: 'Subscription' },
] as const;
export const adminRoutes = [
  { path: '/admin', title: 'Admin overview' },
  { path: '/admin/users', title: 'Users' },
  { path: '/admin/coins', title: 'Supported coins' },
  { path: '/admin/packages', title: 'Packages' },
  { path: '/admin/subscriptions', title: 'Subscriptions' },
  { path: '/admin/moderation', title: 'Moderation' },
  { path: '/admin/official-posts', title: 'Official posts' },
  { path: '/admin/news-sources', title: 'News sources' },
  { path: '/admin/ai-config', title: 'AI configuration' },
  { path: '/admin/logs', title: 'System logs' },
] as const;
