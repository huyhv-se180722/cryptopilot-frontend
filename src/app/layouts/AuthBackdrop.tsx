import type { CSSProperties, ReactNode } from 'react';
import { classNames } from '../../utils/class-names';

/*
 * Every shape below is decoration drawn from fixed numbers: no price,
 * pair or figure the market or the backend gave, and no text.
 */

/** A depth chart side: cumulative steps rising away from the middle. */
function depthPath(side: 'bid' | 'ask') {
  const steps = [6, 9, 7, 12, 10, 15, 13, 18, 16, 22, 20, 26];
  let x = 600;
  let y = 196;
  let path = `M${x} 200 L${x} ${y}`;
  steps.forEach((step, i) => {
    x += (side === 'bid' ? -1 : 1) * (40 + (i % 3) * 6);
    path += ` L${x} ${y}`;
    y -= step;
    path += ` L${x} ${y}`;
  });
  const edge = side === 'bid' ? 0 : 1200;
  return {
    line: path + ` L${edge} ${y}`,
    area: path + ` L${edge} ${y} L${edge} 200 Z`,
  };
}
const BIDS = depthPath('bid');
const ASKS = depthPath('ask');

/** Corners of the wireframe crystal (a stretched octahedron, front view). */
const CRYSTAL = {
  top: [130, 8],
  bottom: [130, 292],
  left: [18, 150],
  right: [242, 150],
  front: [150, 162],
  back: [104, 136],
} as const;
const EDGES: readonly (readonly [
  keyof typeof CRYSTAL,
  keyof typeof CRYSTAL,
])[] = [
  ['top', 'left'],
  ['top', 'right'],
  ['top', 'front'],
  ['top', 'back'],
  ['bottom', 'left'],
  ['bottom', 'right'],
  ['bottom', 'front'],
  ['bottom', 'back'],
  ['left', 'front'],
  ['front', 'right'],
  ['right', 'back'],
  ['back', 'left'],
];
const point = (name: keyof typeof CRYSTAL) => CRYSTAL[name].join(' ');

/** Nodes of the network at the right and the links between them. */
const NODES = [
  [40, 60],
  [150, 30],
  [250, 90],
  [110, 140],
  [210, 190],
  [60, 230],
  [170, 270],
  [270, 250],
] as const;
const LINKS = [
  [0, 1],
  [1, 2],
  [0, 3],
  [1, 3],
  [3, 4],
  [2, 4],
  [3, 5],
  [5, 6],
  [4, 6],
  [4, 7],
  [6, 7],
] as const;

const MINI_CANDLES = [
  [0, 34, 20, true],
  [1, 30, 14, false],
  [2, 26, 22, true],
  [3, 18, 16, true],
  [4, 22, 12, false],
  [5, 12, 20, true],
  [6, 8, 14, true],
] as const;

function GlassCard({
  className,
  delay,
  children,
}: {
  className: string;
  delay: string;
  children: ReactNode;
}) {
  return (
    <div
      className={classNames(
        'auth-float absolute hidden rounded-xl border border-line bg-surface/60 p-3 shadow-panel backdrop-blur-md xl:block',
        className,
      )}
      style={{ animationDelay: delay } as CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Backdrop of the sign-in pages (no Figma frame; design without Figma,
 * awaiting a designer's review). In the manner of an exchange's sign-in:
 * a perspective grid running to a horizon where an order book's depth
 * chart stands, bids in green and asks in red; a wireframe crystal that
 * echoes the brand mark, orbited by a node; a network of linked nodes;
 * and, on wide screens, glass cards with a candle chart, book bars and a
 * risk gauge. Colours come from the theme tokens, it moves slowly and
 * stands still under reduced motion, and assistive technology skips it.
 */
export function AuthBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Light: three soft glows. */}
      <div className="absolute -top-[180px] left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--cp-primary-bg)_0%,transparent_70%)]" />
      <div className="absolute -right-[180px] bottom-[18%] h-[480px] w-[560px] rounded-full bg-[radial-gradient(ellipse_at_center,var(--cp-accent-bg)_0%,transparent_70%)]" />
      <div className="absolute top-[30%] -left-[200px] h-[460px] w-[520px] rounded-full bg-[radial-gradient(ellipse_at_center,var(--cp-purple-bg)_0%,transparent_70%)] opacity-70" />

      {/* Floor: a grid in perspective, drifting towards the viewer. */}
      <div className="absolute inset-x-0 bottom-0 h-[46%] [mask-image:linear-gradient(to_top,black_25%,transparent)] [perspective:520px]">
        <div className="auth-floor absolute -inset-x-1/2 -bottom-1/2 top-0 opacity-50 dark:opacity-60" />
      </div>

      {/* Horizon: the order book's depth chart. */}
      <svg
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-[15%] hidden h-[26%] w-full opacity-35 sm:block dark:opacity-45"
      >
        <defs>
          <linearGradient id="auth-bid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--cp-positive)" stopOpacity="0.5" />
            <stop offset="1" stopColor="var(--cp-positive)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="auth-ask" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--cp-negative)" stopOpacity="0.5" />
            <stop offset="1" stopColor="var(--cp-negative)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={BIDS.area} fill="url(#auth-bid)" />
        <path d={ASKS.area} fill="url(#auth-ask)" />
        <path
          d={BIDS.line}
          fill="none"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          className="stroke-positive"
        />
        <path
          d={ASKS.line}
          fill="none"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          className="stroke-negative"
        />
      </svg>

      {/* Crystal with its orbit, at the left. */}
      <svg
        viewBox="-60 -40 380 380"
        className="auth-float absolute top-[12%] left-[6%] hidden h-[340px] w-[340px] opacity-70 lg:block dark:opacity-90"
      >
        <defs>
          <linearGradient id="auth-crystal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--cp-accent)" />
            <stop offset="1" stopColor="var(--cp-primary)" />
          </linearGradient>
          <linearGradient id="auth-facet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--cp-accent)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--cp-primary)" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <polygon
          points={`${point('top')} ${point('left')} ${point('front')}`}
          fill="url(#auth-facet)"
        />
        <polygon
          points={`${point('top')} ${point('front')} ${point('right')}`}
          fill="url(#auth-facet)"
          opacity={0.6}
        />
        <polygon
          points={`${point('bottom')} ${point('left')} ${point('front')}`}
          fill="url(#auth-facet)"
          opacity={0.4}
        />
        {EDGES.map(([from, to]) => (
          <line
            key={from + to}
            x1={CRYSTAL[from][0]}
            y1={CRYSTAL[from][1]}
            x2={CRYSTAL[to][0]}
            y2={CRYSTAL[to][1]}
            stroke="url(#auth-crystal)"
            strokeWidth={from === 'back' || to === 'back' ? 0.75 : 1.5}
            strokeDasharray={
              from === 'back' || to === 'back' ? '3 4' : undefined
            }
          />
        ))}
        <ellipse
          cx={130}
          cy={150}
          rx={170}
          ry={46}
          fill="none"
          strokeWidth={1}
          strokeDasharray="2 6"
          className="auth-orbit stroke-primary"
          opacity={0.6}
          transform="rotate(-18 130 150)"
        />
        <g transform="rotate(-18 130 150)">
          <circle cx={300} cy={150} r={4} className="fill-accent" />
          <circle
            cx={300}
            cy={150}
            r={10}
            className="auth-pulse fill-accent"
            opacity={0.25}
          />
        </g>
      </svg>

      {/* Network of linked nodes, at the right. */}
      <svg
        viewBox="0 0 310 300"
        className="absolute top-[8%] right-[5%] hidden h-[300px] w-[310px] opacity-60 lg:block dark:opacity-80"
      >
        {LINKS.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={NODES[a][0]}
            y1={NODES[a][1]}
            x2={NODES[b][0]}
            y2={NODES[b][1]}
            strokeWidth={1}
            className="stroke-primary"
            opacity={0.35}
          />
        ))}
        {NODES.map(([x, y], i) => (
          <g key={`${x}-${y}`}>
            <circle
              cx={x}
              cy={y}
              r={9}
              className="auth-pulse fill-primary"
              opacity={0.18}
              style={{ animationDelay: `${i * 0.45}s` }}
            />
            <rect
              x={x - 4}
              y={y - 4}
              width={8}
              height={8}
              rx={2}
              className={i % 3 === 0 ? 'fill-accent' : 'fill-primary'}
            />
          </g>
        ))}
      </svg>

      {/* Glass cards: a candle chart, book bars and a risk gauge. */}
      <GlassCard className="top-[46%] right-[9%] w-[180px] rotate-3" delay="0s">
        <svg viewBox="0 0 154 60" className="h-[60px] w-full">
          {MINI_CANDLES.map(([i, top, height, up]) => (
            <g key={i} className={up ? 'fill-positive' : 'fill-negative'}>
              <rect
                x={i * 22 + 9.5}
                y={top - 5}
                width={1}
                height={height + 10}
              />
              <rect
                x={i * 22 + 5}
                y={top}
                width={10}
                height={height}
                rx={1.5}
              />
            </g>
          ))}
        </svg>
        <div className="mt-2 flex gap-1.5">
          <span className="h-1.5 w-10 rounded-full bg-positive/60" />
          <span className="h-1.5 w-6 rounded-full bg-line-strong" />
        </div>
      </GlassCard>
      <GlassCard
        className="bottom-[14%] left-[10%] w-[170px] -rotate-3"
        delay="1.6s"
      >
        <div className="flex flex-col gap-1">
          {[78, 64, 52, 36].map((width) => (
            <span
              key={'ask' + width}
              className="ml-auto h-2 rounded-sm bg-negative/35"
              style={{ width: `${width}%` }}
            />
          ))}
          <span className="my-1 h-px w-full bg-line-strong" />
          {[40, 58, 70, 86].map((width) => (
            <span
              key={'bid' + width}
              className="ml-auto h-2 rounded-sm bg-positive/35"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      </GlassCard>
      <GlassCard
        className="top-[20%] right-[24%] w-[118px] -rotate-6"
        delay="3.2s"
      >
        <svg viewBox="0 0 100 58" className="h-[52px] w-full">
          <path
            d="M10 52 A40 40 0 0 1 90 52"
            fill="none"
            strokeWidth={8}
            strokeLinecap="round"
            className="stroke-line-strong"
          />
          <path
            d="M10 52 A40 40 0 0 1 64 14"
            fill="none"
            strokeWidth={8}
            strokeLinecap="round"
            className="stroke-primary"
          />
          <circle cx={50} cy={52} r={4} className="fill-fg-2" />
          <line
            x1={50}
            y1={52}
            x2={68}
            y2={26}
            strokeWidth={2.5}
            strokeLinecap="round"
            className="stroke-fg-2"
          />
        </svg>
      </GlassCard>
    </div>
  );
}
