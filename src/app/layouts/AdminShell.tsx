import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu as MenuIcon, ShieldAlert, X } from 'lucide-react';
import { CryptoPilotLogo } from '../../components/brand/CryptoPilotLogo';
import { ThemeToggle } from '../../components/layout/ThemeToggle';
import { IconButton } from '../../components/ui/IconButton';
import { useAuth } from '../../hooks/use-auth';
import { useCopy } from '../../hooks/use-copy';
import { classNames } from '../../utils/class-names';
import { adminNav } from './navigation';

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const copy = useCopy();
  const auth = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    try {
      await auth.logout();
    } finally {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="flex h-full w-56 flex-col border-r border-line bg-page-alt">
      <div className="border-b border-line px-4 py-5">
        <div className="mb-4">
          <CryptoPilotLogo size="xs" />
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-negative-line bg-negative-soft px-2.5 py-1.5">
          <ShieldAlert
            size={11}
            aria-hidden="true"
            className="shrink-0 text-negative"
          />
          <span className="text-[10px] font-bold tracking-[0.12em] text-negative">
            {copy.admin.console}
          </span>
        </div>
      </div>

      <nav
        aria-label={copy.nav.primary}
        className="flex-1 overflow-y-auto px-3 py-3"
      >
        {adminNav.map((group, index) => (
          <div key={group.headingKey ?? index} className={index ? 'mt-5' : ''}>
            {group.headingKey && (
              <div className="mb-2 px-2 text-[9px] font-bold tracking-[0.14em] text-muted-x">
                {copy.admin[group.headingKey]}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end ?? false}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    classNames(
                      'mb-0.5 flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-[12px] no-underline pointer-coarse:py-3',
                      isActive
                        ? 'border-primary-line bg-linear-135 from-primary-soft to-accent-soft font-semibold text-primary'
                        : 'border-transparent text-muted-dim hover:border-line hover:bg-raised hover:text-muted',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={14}
                        aria-hidden="true"
                        className={isActive ? undefined : 'opacity-65'}
                      />
                      {copy.admin[item.labelKey]}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-xs text-muted-dim hover:border-negative-line hover:bg-negative-soft hover:text-negative"
        >
          <LogOut size={13} aria-hidden="true" />
          {copy.nav.signOut}
        </button>
      </div>
    </div>
  );
}

/** Figma admin console: grouped sidebar (drawer below lg) + content. */
export function AdminShell() {
  const copy = useCopy();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="flex min-h-[calc(100dvh-var(--cp-banner-h))]">
      <aside className="sticky top-0 hidden h-[calc(100dvh-var(--cp-banner-h))] shrink-0 self-start lg:block">
        <Sidebar />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={copy.common.close}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-(--cp-backdrop) backdrop-blur-sm"
          />
          <div className="relative h-full w-56 shadow-overlay">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
            <IconButton
              label={copy.common.close}
              icon={<X size={14} aria-hidden="true" />}
              onClick={() => setDrawerOpen(false)}
              className="absolute top-3 -right-11 bg-surface"
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b border-line bg-page-alt px-3 lg:hidden">
          <IconButton
            label={copy.nav.openMenu}
            icon={<MenuIcon size={16} aria-hidden="true" />}
            outlined
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          />
          <CryptoPilotLogo size="xs" />
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          key={location.pathname}
          className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-8 sm:py-7"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
