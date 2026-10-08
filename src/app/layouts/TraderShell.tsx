import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BellRing,
  Command,
  CreditCard,
  LogOut,
  Receipt,
  Search,
  User,
} from 'lucide-react';
import { CryptoPilotLogo } from '../../components/brand/CryptoPilotLogo';
import { DisclaimerFooter } from '../../components/layout/DisclaimerFooter';
import { ThemeToggle } from '../../components/layout/ThemeToggle';
import { Menu } from '../../components/ui/Menu';
import { useAuth } from '../../hooks/use-auth';
import { useCopy } from '../../hooks/use-copy';
import { classNames } from '../../utils/class-names';
import { CommandPalette } from './CommandPalette';
import { MobileDock } from './MobileDock';
import { traderAccountNav, traderDock, traderNav } from './navigation';

const paletteItems = [...traderNav, ...traderAccountNav];
const dockPaths = new Set(traderDock.map((item) => item.to));
const moreItems = paletteItems.filter((item) => !dockPaths.has(item.to));

/** Figma trader TopNav (52px, horizontal) with mobile dock below md. */
export function TraderShell() {
  const copy = useCopy();
  const auth = useAuth();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const user = auth.session?.user;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function signOut() {
    try {
      await auth.logout();
    } finally {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center border-b border-line bg-page-alt px-3 dark:bg-(--cp-dock-bg) dark:shadow-panel dark:backdrop-blur-xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-px bg-linear-to-r from-transparent via-primary/50 to-transparent dark:block"
        />
        <Link
          to="/dashboard"
          aria-label={copy.nav.home}
          className="mr-4 flex shrink-0 items-center hover:opacity-85"
        >
          <CryptoPilotLogo size="sm" />
        </Link>

        <nav
          aria-label={copy.nav.primary}
          className="hidden min-w-0 flex-1 items-center overflow-x-auto md:flex"
        >
          {traderNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  classNames(
                    'relative flex h-[52px] shrink-0 items-center gap-1.5 px-3 text-[12px] font-medium whitespace-nowrap no-underline',
                    isActive ? 'text-primary' : 'text-muted hover:text-fg-2',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={13}
                      aria-hidden="true"
                      className={isActive ? undefined : 'opacity-60'}
                    />
                    {copy.nav[item.labelKey]}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary dark:bg-linear-to-r dark:from-primary dark:to-accent dark:shadow-glow-primary"
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 pl-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label={copy.palette.open}
            className="flex items-center gap-2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-muted-x hover:border-line-strong hover:text-muted-dim"
          >
            <Search size={11} aria-hidden="true" />
            <span className="hidden text-[11px] sm:block">
              {copy.palette.trigger}
            </span>
            <kbd className="hidden items-center gap-0.5 rounded border border-line bg-surface px-1.5 font-mono text-[10px] sm:inline-flex">
              <Command size={8} aria-hidden="true" />K
            </kbd>
          </button>

          <div
            aria-hidden="true"
            className="hidden h-5 w-px bg-line sm:block"
          />
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <NavLink
            to="/notifications"
            aria-label={copy.nav.notifications}
            title={copy.nav.notifications}
            className={({ isActive }) =>
              classNames(
                'relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg pointer-coarse:size-11',
                isActive
                  ? 'bg-raised text-primary'
                  : 'text-muted-dim hover:bg-raised hover:text-fg-2',
              )
            }
          >
            <BellRing size={14} aria-hidden="true" />
          </NavLink>

          <Link
            to="/subscription"
            className="hidden rounded-full border border-primary-line bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary no-underline sm:inline-block"
          >
            {copy.nav.plansChip}
          </Link>

          <Menu
            label={copy.nav.account}
            trigger={
              <span className="inline-flex size-8 items-center justify-center rounded-full border border-line bg-raised text-muted-dim hover:border-line-strong pointer-coarse:size-11">
                <User size={13} aria-hidden="true" />
              </span>
            }
            header={
              user ? (
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-fg">
                    {user.fullName}
                  </div>
                  <div className="truncate text-[11px] text-muted-dim">
                    {user.email}
                  </div>
                  <div className="mt-2 sm:hidden">
                    <ThemeToggle />
                  </div>
                </div>
              ) : undefined
            }
            items={[
              {
                id: 'profile',
                label: copy.nav.profile,
                icon: <User size={14} />,
                onSelect: () => navigate('/profile'),
              },
              {
                id: 'subscription',
                label: copy.nav.subscription,
                icon: <CreditCard size={14} />,
                onSelect: () => navigate('/subscription'),
              },
              {
                id: 'payments',
                label: copy.nav.payments,
                icon: <Receipt size={14} />,
                onSelect: () => navigate('/subscription/payments'),
              },
              {
                id: 'sign-out',
                label: copy.nav.signOut,
                icon: <LogOut size={14} />,
                tone: 'danger',
                onSelect: () => void signOut(),
              },
            ]}
          />
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 pb-24 outline-none md:pb-0"
      >
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </main>
      <div className="pb-24 md:pb-0">
        <DisclaimerFooter />
      </div>

      <MobileDock items={traderDock} more={moreItems} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={paletteItems}
      />
    </div>
  );
}
