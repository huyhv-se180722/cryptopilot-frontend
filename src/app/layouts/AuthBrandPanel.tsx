import { ChartCandlestick, FlaskConical, ShieldCheck } from 'lucide-react';
import { CryptoPilotLogo } from '../../components/brand/CryptoPilotLogo';
import { useCopy } from '../../hooks/use-copy';
import { classNames } from '../../utils/class-names';

/*
 * Every shape below is decoration drawn from fixed numbers: no price,
 * pair or figure the market or the backend gave, and no text.
 */

/**
 * The brand mark traced from the owner's logo artwork (viewBox 0 0 270 288):
 * a compass star in a broken diamond, its north needle long and blue.
 */
const MARK_NEEDLES = ['137 2 106 150 164 150', '104 161 164 161 132 250'];
const MARK_WEDGES = [
  '110 51 96 117 60 150 1 150',
  '161 51 174 117 210 150 268 150',
  '1 161 60 161 112 210 127 285',
  '268 161 208 161 156 210 141 285',
];
const MARK_SCALE = 0.62;
const MARK_ORIGIN = `translate(${-134 * MARK_SCALE} ${-155 * MARK_SCALE}) scale(${MARK_SCALE})`;

/** Bearing ticks every 5°, long every 30°; north is the needle's. */
const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);
const polar = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return [Math.sin(rad) * r, -Math.cos(rad) * r] as const;
};

/** A faint price path under the dial and the course plotted across it. */
const PRICE = [
  -300, 182, -260, 170, -228, 188, -190, 160, -150, 176, -112, 150, -70, 168,
  -30, 138, 10, 158, 52, 126, 96, 146, 138, 112, 182, 134, 226, 98, 268, 120,
  300, 92,
];
const PRICE_PATH = PRICE.reduce(
  (path, value, i) =>
    path + (i % 2 === 0 ? `${i === 0 ? 'M' : ' L'}${value}` : ` ${value}`),
  '',
);
const WAYPOINTS = [[-236, 196], [-92, 128], polar(45, 190)] as const;
const COURSE = `M${WAYPOINTS[0].join(' ')} Q-170 140 ${WAYPOINTS[1].join(' ')} Q190 140 ${WAYPOINTS[2].join(' ')}`;

/**
 * The compass dial: bearing rings and ticks around the brand mark. Colours
 * follow `currentColor`, so the same dial lights the navy panel and,
 * without the mark, sits faintly behind the form on narrower screens.
 */
export function CompassDial({
  className,
  withMark = true,
  withCourse = true,
}: {
  className?: string;
  withMark?: boolean;
  withCourse?: boolean;
}) {
  return (
    <svg
      viewBox="-300 -210 600 440"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <radialGradient id="auth-dial-glow">
          <stop
            offset="0"
            stopColor="var(--cp-brand-needle)"
            stopOpacity="0.35"
          />
          <stop offset="1" stopColor="var(--cp-brand-needle)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {withMark && <circle r={170} fill="url(#auth-dial-glow)" />}
      <g fill="none" stroke="currentColor">
        <circle r={150} strokeOpacity={0.22} />
        <circle r={110} strokeOpacity={0.14} strokeDasharray="2 6" />
        <g className="auth-dial">
          <circle r={190} strokeOpacity={0.3} />
          {TICKS.map((deg) => {
            const long = deg % 30 === 0;
            const [x1, y1] = polar(deg, long ? 172 : 182);
            const [x2, y2] = polar(deg, 190);
            return (
              <line
                key={deg}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeOpacity={long ? 0.55 : 0.28}
                strokeWidth={long ? 1.5 : 1}
              />
            );
          })}
        </g>
        <path
          d={`M0 -206 L-7 -192 L7 -192 Z`}
          fill="var(--cp-brand-needle)"
          stroke="none"
        />
      </g>
      {withCourse && (
        <g fill="none">
          <path
            d={PRICE_PATH}
            stroke="currentColor"
            strokeOpacity={0.16}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <path
            d={COURSE}
            stroke="var(--cp-brand-needle)"
            strokeOpacity={0.85}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            className="auth-course"
          />
          {WAYPOINTS.map(([x, y], i) => (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={9}
                stroke="var(--cp-brand-needle)"
                strokeOpacity={0.45}
              />
              <circle cx={x} cy={y} r={3.5} fill="var(--cp-brand-needle)" />
            </g>
          ))}
        </g>
      )}
      {withMark && (
        <g transform={MARK_ORIGIN}>
          {MARK_WEDGES.map((points) => (
            <polygon
              key={points}
              points={points}
              fill="currentColor"
              fillOpacity={0.92}
            />
          ))}
          {MARK_NEEDLES.map((points) => (
            <polygon
              key={points}
              points={points}
              fill="var(--cp-brand-needle)"
            />
          ))}
        </g>
      )}
    </svg>
  );
}

/**
 * Brand panel beside the sign-in form on wide screens (no Figma frame;
 * design without Figma, awaiting a designer's review). It carries the
 * logo's message: a compass star on a bearing dial, a course plotted
 * through waypoints over a price path, and what the product does and
 * never does. Navy in both themes; assistive technology reads the copy
 * and skips the drawing.
 */
export function AuthBrandPanel({ className }: { className?: string }) {
  const copy = useCopy();
  const points = [
    { Icon: ChartCandlestick, text: copy.auth.brandPointAnalysis },
    { Icon: ShieldCheck, text: copy.auth.brandPointPlan },
    { Icon: FlaskConical, text: copy.auth.brandPointPaper },
  ];
  return (
    <aside
      className={classNames(
        'relative flex-col overflow-hidden border-r border-white/10 bg-gradient-to-b from-brand-ink to-brand-ink-deep px-10 py-10 text-white xl:px-12',
        className,
      )}
    >
      <div className="relative">
        <CryptoPilotLogo size="md" onDark />
      </div>
      <div className="relative flex flex-1 items-center py-8">
        <CompassDial className="mx-auto w-full max-w-[520px] text-white" />
      </div>
      <div className="relative max-w-[440px]">
        <p className="text-2xl leading-tight font-semibold tracking-tight xl:text-[28px]">
          {copy.auth.brandTagline}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          {copy.auth.brandLead}
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {points.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-brand-needle">
                <Icon size={16} aria-hidden="true" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
