import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  GraduationCap,
  Lock,
  Menu as MenuIcon,
  Newspaper,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { CryptoPilotLogo } from '../../components/brand/CryptoPilotLogo';
import { DisclaimerFooter } from '../../components/layout/DisclaimerFooter';
import { ThemeToggle } from '../../components/layout/ThemeToggle';
import { Menu } from '../../components/ui/Menu';
import { buttonClassName } from '../../components/ui/button-styles';
import {
  AccessGate,
  type GatedFeature,
} from '../../features/auth/components/AccessGate';
import { useCopy } from '../../hooks/use-copy';
import { classNames } from '../../utils/class-names';

const navItemClass =
  'relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium pointer-coarse:py-3';

/**
 * Figma GuestShell header, promo strip and footer. Guests read the
 * community (D-99) and the Academy (T-114); News is Trader-only (SRS 3.1.3), so for guests it
 * opens the access gate.
 */
export function GuestShell() {
  const copy = useCopy();
  const navigate = useNavigate();
  const [gate, setGate] = useState<GatedFeature | null>(null);
  const open = [
    { to: '/', end: true, label: copy.nav.markets, icon: TrendingUp },
    { to: '/community', end: false, label: copy.nav.community, icon: Users },
    {
      to: '/academy',
      end: false,
      label: copy.nav.academy,
      icon: GraduationCap,
    },
  ];
  const gated: { feature: GatedFeature; label: string; icon: typeof Users }[] =
    [{ feature: 'news', label: copy.nav.news, icon: Newspaper }];

  return (
    <div className="flex min-h-[calc(100dvh-var(--cp-banner-h))] flex-col">
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-page-alt/95 px-4 backdrop-blur-xl sm:px-6 dark:bg-(--cp-dock-bg)">
        <Link
          to="/"
          aria-label={copy.nav.home}
          className="flex shrink-0 items-center hover:opacity-85"
        >
          <CryptoPilotLogo size="sm" />
        </Link>

        <nav
          aria-label={copy.nav.primary}
          className="mx-auto hidden items-center gap-0.5 md:flex"
        >
          {open.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) =>
                classNames(
                  navItemClass,
                  isActive
                    ? 'text-primary'
                    : 'text-muted hover:bg-raised hover:text-fg-2',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={14} aria-hidden="true" className="opacity-70" />
                  {/* Icons only from md to lg, where the header is tight. */}
                  <span className="sr-only lg:not-sr-only">{label}</span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-2 bottom-0 h-px rounded-full bg-primary"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
          {gated.map(({ feature, label, icon: Icon }) => (
            <button
              key={feature}
              type="button"
              onClick={() => setGate(feature)}
              title={label}
              className={classNames(
                navItemClass,
                'text-muted hover:bg-raised hover:text-fg-2',
              )}
            >
              <Icon size={14} aria-hidden="true" className="opacity-60" />
              <span className="sr-only lg:not-sr-only">{label}</span>
              <Lock size={10} aria-hidden="true" className="text-muted-x" />
            </button>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <div className="hidden sm:block">
            <Link
              to="/login"
              className={buttonClassName(
                'secondary',
                'md',
                'bg-transparent text-[13px] font-medium',
              )}
            >
              {copy.nav.signIn}
            </Link>
          </div>
          <Link
            to="/register"
            className={buttonClassName(
              'primary',
              'md',
              'rounded-xl text-[13px]',
            )}
          >
            {copy.nav.getStarted}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
          <div className="md:hidden">
            <Menu
              label={copy.nav.openMenu}
              trigger={
                <span className="inline-flex size-9 items-center justify-center rounded-lg border border-line bg-raised text-muted-dim">
                  <MenuIcon size={16} aria-hidden="true" />
                </span>
              }
              items={[
                ...open.map(({ to, label }) => ({
                  id: to,
                  label,
                  onSelect: () => navigate(to),
                })),
                ...gated.map(({ feature, label }) => ({
                  id: feature,
                  label,
                  onSelect: () => setGate(feature),
                })),
                {
                  id: 'sign-in',
                  label: copy.nav.signIn,
                  onSelect: () => navigate('/login'),
                },
              ]}
              header={<ThemeToggle />}
            />
          </div>
        </div>
      </header>

      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-linear-to-r from-primary-soft to-accent-soft px-4 py-2 sm:px-6">
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-fg-2">
          <Zap size={11} aria-hidden="true" className="shrink-0 text-accent" />
          <span className="truncate">
            {copy.guest.promo}{' '}
            <span className="font-semibold text-accent">
              {copy.guest.promoHighlight}
            </span>
          </span>
        </p>
        <div className="ml-auto hidden shrink-0 sm:block">
          <Link to="/register" className={buttonClassName('primary', 'sm')}>
            {copy.guest.promoAction}
          </Link>
        </div>
      </div>

      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </main>
      <DisclaimerFooter />
      <AccessGate feature={gate} onClose={() => setGate(null)} />
    </div>
  );
}
