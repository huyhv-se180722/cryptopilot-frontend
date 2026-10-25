import type { ComponentType } from 'react';

type PageModule = () => Promise<{ Component: ComponentType }>;

/** Routes whose real screen exists; every other route shows its placeholder. */
export const screenPages: Readonly<Record<string, PageModule>> = {
  '/': async () => ({
    Component: (await import('../../pages/guest/PublicHomePage'))
      .PublicHomePage,
  }),
  '/login': async () => ({
    Component: (await import('../../pages/guest/LoginPage')).LoginPage,
  }),
  '/register': async () => ({
    Component: (await import('../../pages/guest/RegisterPage')).RegisterPage,
  }),
  '/verify-email': async () => ({
    Component: (await import('../../pages/guest/VerifyEmailPage'))
      .VerifyEmailPage,
  }),
  '/forgot-password': async () => ({
    Component: (await import('../../pages/guest/ForgotPasswordPage'))
      .ForgotPasswordPage,
  }),
  '/reset-password': async () => ({
    Component: (await import('../../pages/guest/ResetPasswordPage'))
      .ResetPasswordPage,
  }),
  '/dashboard': async () => ({
    Component: (await import('../../pages/trader/DashboardPage')).DashboardPage,
  }),
  '/markets': async () => ({
    Component: (await import('../../pages/trader/MarketsPage')).MarketsPage,
  }),
  '/markets/spot/:symbol': async () => ({
    Component: (await import('../../pages/trader/SpotAnalysisPage'))
      .SpotAnalysisPage,
  }),
  '/markets/futures/:symbol': async () => ({
    Component: (await import('../../pages/trader/FuturesAnalysisPage'))
      .FuturesAnalysisPage,
  }),
  '/trade/spot': async () => ({
    Component: (await import('../../pages/trader/TradeSpotPage')).TradeSpotPage,
  }),
  '/trade/spot/:symbol': async () => ({
    Component: (await import('../../pages/trader/TradeSpotPage')).TradeSpotPage,
  }),
  '/trade/wallet': async () => ({
    Component: (await import('../../pages/trader/TradeWalletPage'))
      .TradeWalletPage,
  }),
  '/trade/orders': async () => ({
    Component: (await import('../../pages/trader/TradeOrdersPage'))
      .TradeOrdersPage,
  }),
  '/trade/pnl': async () => ({
    Component: (await import('../../pages/trader/TradePnlPage')).TradePnlPage,
  }),
  '/watchlist': async () => ({
    Component: (await import('../../pages/trader/WatchlistPage')).WatchlistPage,
  }),
  '/alerts': async () => ({
    Component: (await import('../../pages/trader/AlertsPage')).AlertsPage,
  }),
  '/notifications': async () => ({
    Component: (await import('../../pages/trader/NotificationsPage'))
      .NotificationsPage,
  }),
  '/plans': async () => ({
    Component: (await import('../../pages/trader/PlansPage')).PlansPage,
  }),
  '/plans/new': async () => ({
    Component: (await import('../../pages/trader/PlanCreatePage'))
      .PlanCreatePage,
  }),
  '/plans/:planId/edit': async () => ({
    Component: (await import('../../pages/trader/PlanEditPage')).PlanEditPage,
  }),
  '/plans/:planId': async () => ({
    Component: (await import('../../pages/trader/PlanDetailPage'))
      .PlanDetailPage,
  }),
  '/community': async () => ({
    Component: (await import('../../pages/trader/CommunityPage')).CommunityPage,
  }),
  '/community/topics': async () => ({
    Component: (await import('../../pages/trader/CommunityTopicsPage'))
      .CommunityTopicsPage,
  }),
  '/community/articles': async () => ({
    Component: (await import('../../pages/trader/CommunityArticlesPage'))
      .CommunityArticlesPage,
  }),
  '/community/new': async () => ({
    Component: (await import('../../pages/trader/PostEditorPage'))
      .PostEditorPage,
  }),
  '/community/:postId/edit': async () => ({
    Component: (await import('../../pages/trader/PostEditorPage'))
      .PostEditorPage,
  }),
  '/community/:postId': async () => ({
    Component: (await import('../../pages/trader/PostDetailPage'))
      .PostDetailPage,
  }),
  '/community/members/:memberId': async () => ({
    Component: (await import('../../pages/trader/MemberPage')).MemberPage,
  }),
  '/news': async () => ({
    Component: (await import('../../pages/trader/NewsPage')).NewsPage,
  }),
  '/news/:articleId': async () => ({
    Component: (await import('../../pages/trader/NewsArticlePage'))
      .NewsArticlePage,
  }),
  '/academy': async () => ({
    Component: (await import('../../pages/guest/AcademyPage')).AcademyPage,
  }),
  '/academy/glossary': async () => ({
    Component: (await import('../../pages/guest/AcademyGlossaryPage'))
      .AcademyGlossaryPage,
  }),
  '/academy/:slug': async () => ({
    Component: (await import('../../pages/guest/AcademyArticlePage'))
      .AcademyArticlePage,
  }),
  '/profile': async () => ({
    Component: (await import('../../pages/trader/ProfilePage')).ProfilePage,
  }),
  '/admin/reports': async () => ({
    Component: (await import('../../pages/admin/AdminReportsPage'))
      .AdminReportsPage,
  }),
  '/admin/pairs': async () => ({
    Component: (await import('../../pages/admin/AdminPairsPage'))
      .AdminPairsPage,
  }),
  '/admin/leverage-brackets': async () => ({
    Component: (await import('../../pages/admin/AdminBracketsPage'))
      .AdminBracketsPage,
  }),
  '/admin/settings': async () => ({
    Component: (await import('../../pages/admin/AdminSettingsPage'))
      .AdminSettingsPage,
  }),
  '/admin/announcements': async () => ({
    Component: (await import('../../pages/admin/AdminAnnouncementsPage'))
      .AdminAnnouncementsPage,
  }),
  '/admin/announcements/new': async () => ({
    Component: (await import('../../pages/admin/AdminAnnouncementEditorPage'))
      .AdminAnnouncementEditorPage,
  }),
  '/admin/announcements/:postId': async () => ({
    Component: (await import('../../pages/admin/AdminAnnouncementEditorPage'))
      .AdminAnnouncementEditorPage,
  }),
  '/admin/news-sources': async () => ({
    Component: (await import('../../pages/admin/AdminNewsSourcesPage'))
      .AdminNewsSourcesPage,
  }),
  '/admin/news-articles': async () => ({
    Component: (await import('../../pages/admin/AdminNewsArticlesPage'))
      .AdminNewsArticlesPage,
  }),
  '/admin/account': async () => ({
    Component: (await import('../../pages/admin/AdminAccountPage'))
      .AdminAccountPage,
  }),
};
