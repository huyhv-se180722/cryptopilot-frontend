import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CryptoPilotLogo } from '../../components/brand/CryptoPilotLogo';
import { ThemeToggle } from '../../components/layout/ThemeToggle';
import { useCopy } from '../../hooks/use-copy';
import { AuthBackdrop } from './AuthBackdrop';

/**
 * Figma Login frame: centred 400px column with ambient glow (SCR-02…06),
 * set on a card over a decorative backdrop from the larger phone width up.
 */
export function AuthShell() {
  const copy = useCopy();
  return (
    <div className="relative flex min-h-[calc(100dvh-var(--cp-banner-h))] flex-col overflow-hidden">
      <AuthBackdrop />
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
          <div className="mb-8">
            <Link to="/" aria-label={copy.nav.home}>
              <CryptoPilotLogo size="sm" />
            </Link>
          </div>
          <div className="sm:rounded-2xl sm:border sm:border-line sm:bg-surface/85 sm:p-6 sm:shadow-overlay sm:backdrop-blur-xl">
            <Outlet />
          </div>
          <p className="mx-auto mt-8 max-w-[360px] rounded-lg px-3 py-1.5 text-center text-[11px] leading-relaxed text-muted sm:bg-page/70 sm:backdrop-blur-sm">
            {copy.messages.MSG42}
          </p>
        </div>
      </main>
    </div>
  );
}
