import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CryptoPilotLogo } from '../../components/brand/CryptoPilotLogo';
import { ThemeToggle } from '../../components/layout/ThemeToggle';
import { useCopy } from '../../hooks/use-copy';

/** Figma Login frame: centred 400px column with ambient glow (SCR-02…06). */
export function AuthShell() {
  const copy = useCopy();
  return (
    <div className="relative flex min-h-[calc(100dvh-var(--cp-banner-h))] flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[120px] left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--cp-primary-bg)_0%,transparent_70%)]"
      />
      <div className="relative flex justify-end p-4">
        <ThemeToggle />
      </div>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative flex flex-1 items-start justify-center outline-none sm:items-center"
      >
        <div className="w-full max-w-[400px] px-6 pb-12">
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
          <Outlet />
          <p className="mx-auto mt-8 max-w-[340px] text-center text-[11px] leading-relaxed text-muted-x">
            {copy.messages.MSG42}
          </p>
        </div>
      </main>
    </div>
  );
}
