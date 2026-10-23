import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CryptoPilotLogo } from '../../components/brand/CryptoPilotLogo';
import { ThemeToggle } from '../../components/layout/ThemeToggle';
import { useCopy } from '../../hooks/use-copy';
import { AuthBrandPanel, CompassDial } from './AuthBrandPanel';

/**
 * Figma Login frame: centred 400px column (SCR-02…06). From the laptop
 * width the brand panel stands at the left and the form sits on the plain
 * surface at the right; narrower screens keep the form on a card over a
 * faint compass dial.
 */
export function AuthShell() {
  const copy = useCopy();
  return (
    <div className="flex min-h-[calc(100dvh-var(--cp-banner-h))]">
      <AuthBrandPanel className="hidden w-[44%] max-w-[640px] shrink-0 lg:flex" />
      <div className="relative flex flex-1 flex-col overflow-hidden lg:bg-surface">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden"
        >
          <div className="absolute -top-[180px] left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--cp-primary-bg)_0%,transparent_70%)]" />
          <CompassDial
            withMark={false}
            withCourse={false}
            className="absolute top-1/2 left-1/2 w-[820px] max-w-none -translate-x-1/2 -translate-y-1/2 text-primary opacity-20 dark:opacity-35"
          />
        </div>
        <div className="relative flex justify-end p-4">
          <ThemeToggle />
        </div>
        <main
          id="main-content"
          tabIndex={-1}
          className="relative flex flex-1 items-start justify-center outline-none sm:items-center"
        >
          <div className="w-full max-w-[400px] px-6 pb-12 sm:max-w-[448px] sm:px-0">
            <Link
              to="/"
              className="mb-8 inline-flex items-center gap-1.5 text-xs text-muted-dim no-underline hover:text-fg-2"
            >
              <ArrowLeft size={13} aria-hidden="true" />
              {copy.nav.backToMarkets}
            </Link>
            <div className="mb-8 lg:hidden">
              <Link to="/" aria-label={copy.nav.home}>
                <CryptoPilotLogo size="sm" />
              </Link>
            </div>
            <div className="sm:rounded-2xl sm:border sm:border-line sm:bg-surface/85 sm:p-6 sm:shadow-overlay sm:backdrop-blur-xl lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
              <Outlet />
            </div>
            <p className="mx-auto mt-8 max-w-[360px] text-center text-[11px] leading-relaxed text-muted lg:mx-0 lg:max-w-none lg:text-left">
              {copy.messages.MSG42}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
