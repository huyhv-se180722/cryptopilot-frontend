import { useId } from 'react';
import { useTheme } from '../../hooks/use-theme';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg';

const MARK_PX: Record<LogoSize, number> = { xs: 18, sm: 24, md: 32, lg: 44 };
const TEXT_PX: Record<LogoSize, number> = { xs: 11, sm: 14, md: 18, lg: 24 };

/*
 * Brand asset ported from the prototype. Its colours are brand colours, not
 * theme tokens, so they stay literal here and nowhere else.
 */
function Mark({ px, dark }: { px: number; dark: boolean }) {
  const uid = useId().replace(/:/g, '_');
  const id = (name: string) => name + uid;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className="shrink-0 overflow-visible"
      style={
        dark
          ? {
              filter: `drop-shadow(0 0 ${Math.round(px * 0.35)}px rgba(37,99,235,0.55))`,
            }
          : undefined
      }
    >
      <defs>
        {dark && (
          <>
            <linearGradient
              id={id('nw')}
              x1="4"
              y1="50"
              x2="50"
              y2="4"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
            <linearGradient
              id={id('ne')}
              x1="96"
              y1="50"
              x2="50"
              y2="4"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#1D4ED8" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
            <linearGradient
              id={id('se')}
              x1="96"
              y1="50"
              x2="50"
              y2="96"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#1E3A8A" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
            <linearGradient
              id={id('sw')}
              x1="4"
              y1="50"
              x2="50"
              y2="96"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#1E40AF" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </linearGradient>
            <filter
              id={id('glow')}
              x="-60%"
              y="-60%"
              width="220%"
              height="220%"
            >
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </>
        )}
        <linearGradient
          id={id('ns')}
          x1="50"
          y1="4"
          x2="50"
          y2="49"
          gradientUnits="userSpaceOnUse"
        >
          {dark ? (
            <>
              <stop offset="0%" stopColor="#00F0FF" />
              <stop offset="55%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0EA5E9" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#7DD3FC" />
              <stop offset="100%" stopColor="#2563EB" />
            </>
          )}
        </linearGradient>
        <linearGradient
          id={id('ss')}
          x1="50"
          y1="51"
          x2="50"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          {dark ? (
            <>
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="50%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#00E5FF" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#93C5FD" />
            </>
          )}
        </linearGradient>
      </defs>
      <path
        d="M50,4 L28,30 L4,50 L50,50 Z"
        fill={dark ? `url(#${id('nw')})` : '#0B192C'}
      />
      <path
        d="M50,4 L72,30 L96,50 L50,50 Z"
        fill={dark ? `url(#${id('ne')})` : '#0B192C'}
      />
      <path
        d="M96,50 L72,70 L50,96 L50,50 Z"
        fill={dark ? `url(#${id('se')})` : '#0B192C'}
      />
      <path
        d="M4,50 L28,70 L50,96 L50,50 Z"
        fill={dark ? `url(#${id('sw')})` : '#0B192C'}
      />
      {dark && (
        <g stroke="#00050F" strokeLinecap="round" opacity="0.9">
          <line x1="50" y1="4" x2="50" y2="50" strokeWidth="2.2" />
          <line x1="96" y1="50" x2="50" y2="50" strokeWidth="2.2" />
          <line x1="50" y1="96" x2="50" y2="50" strokeWidth="2.2" />
          <line x1="4" y1="50" x2="50" y2="50" strokeWidth="2.2" />
          <line x1="28" y1="30" x2="50" y2="50" strokeWidth="1.6" />
          <line x1="72" y1="30" x2="50" y2="50" strokeWidth="1.6" />
          <line x1="72" y1="70" x2="50" y2="50" strokeWidth="1.6" />
          <line x1="28" y1="70" x2="50" y2="50" strokeWidth="1.6" />
        </g>
      )}
      <path
        d="M50,4 L43,49 L57,49 Z"
        fill={`url(#${id('ns')})`}
        filter={dark ? `url(#${id('glow')})` : undefined}
      />
      <path
        d="M50,96 L43,51 L57,51 Z"
        fill={`url(#${id('ss')})`}
        filter={dark ? `url(#${id('glow')})` : undefined}
      />
      <rect
        x="40"
        y="47.5"
        width="20"
        height="5"
        rx="1.5"
        fill="#FFFFFF"
        filter={dark ? `url(#${id('glow')})` : undefined}
      />
    </svg>
  );
}

/** CryptoPilot compass mark + wordmark; adapts to the resolved theme. */
export function CryptoPilotLogo({
  size = 'sm',
  showText = true,
}: {
  size?: LogoSize;
  showText?: boolean;
}) {
  const dark = useTheme().resolved === 'dark';
  const px = MARK_PX[size];
  return (
    <span
      className="inline-flex items-center"
      style={{ gap: Math.round(px * 0.32) }}
    >
      <Mark px={px} dark={dark} />
      {showText && (
        <span
          aria-hidden="true"
          className="inline-flex items-baseline leading-none font-bold tracking-[-0.01em] select-none"
          style={{ fontSize: TEXT_PX[size] }}
        >
          <span style={{ color: dark ? '#FFFFFF' : '#0B192C' }}>Crypto</span>
          <span
            style={{
              color: dark ? '#00E5FF' : '#0080FF',
              textShadow: dark ? '0 0 18px rgba(0,229,255,0.65)' : undefined,
            }}
          >
            Pilot
          </span>
        </span>
      )}
    </span>
  );
}
