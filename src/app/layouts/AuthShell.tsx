import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CryptoPilotLogo } from '../../components/brand/CryptoPilotLogo';
import { ThemeToggle } from '../../components/layout/ThemeToggle';
import { useCopy } from '../../hooks/use-copy';
import { AuthBackdrop } from './AuthBackdrop';

/**
 * Figma Login frame: centred 400px column (SCR-02…06), set on a card at
 * the centre of the navy compass backdrop at every width.
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
        <div className="w-full max-w-[448px] px-4 pb-12 sm:px-0">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-white/60 no-underline hover:text-white"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            {copy.nav.backToMarkets}
          </Link>
          <div className="mb-6">
            <Link to="/" aria-label={copy.nav.home}>
              <CryptoPilotLogo size="sm" onDark />
            </Link>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-overlay sm:p-6">
            <Outlet />
          </div>
          <p className="mx-auto mt-6 max-w-[380px] text-center text-[11px] leading-relaxed text-white/60">
            {copy.messages.MSG42}
          </p>
        </div>
      </main>
    </div>
  );
}
