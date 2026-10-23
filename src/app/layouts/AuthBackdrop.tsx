/*
 * Every shape below is decoration drawn from fixed numbers: no price,
 * pair or figure the market or the backend gave, and no text.
 */

/** Bearing ticks every 5°, long every 30°; north is the needle's. */
const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);
const polar = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return [Math.sin(rad) * r, -Math.cos(rad) * r] as const;
};

/** A faint price path along the bottom, below the form and its notice. */
const PRICE = [
  -720, 432, -660, 410, -610, 440, -550, 398, -490, 420, -430, 380, -370, 406,
  -310, 360, -250, 386, -190, 342, -130, 370, -70, 326, -10, 352, 50, 308, 110,
  336, 170, 290, 230, 316, 290, 270, 350, 294, 410, 248, 470, 276, 530, 230,
  590, 256, 650, 208, 720, 230,
];
const PRICE_PATH = PRICE.reduce(
  (path, value, i) =>
    path + (i % 2 === 0 ? `${i === 0 ? 'M' : ' L'}${value}` : ` ${value}`),
  '',
);

/**
 * The course: from the lower left it climbs beside the form through its
 * waypoints, meets the dial at north-west and follows it to north.
 */
const MEET = polar(315, 400);
const WAYPOINTS = [[-620, 400], [-470, 200], [-330, -80], MEET] as const;
const COURSE =
  'M-620 400 C-560 330 -520 250 -470 200 C-420 150 -380 20 -330 -80' +
  ` C-300 -150 -300 -230 ${MEET.join(' ')} A400 400 0 0 1 0 -400`;

/**
 * Backdrop of the sign-in pages (no Figma frame; design without Figma,
 * awaiting a designer's review). It carries the logo's message on the
 * logo's navy: the form stands at the centre of a compass's bearing dial,
 * north marked by the needle's blue, and a course is plotted through
 * waypoints over a faint price path. Navy in both themes; the dial turns
 * slowly and the course runs, both stand still under reduced motion, and
 * assistive technology skips it.
 */
export function AuthBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-b from-brand-ink to-brand-ink-deep text-white"
    >
      <svg
        viewBox="-720 -450 1440 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <radialGradient id="auth-glow">
            <stop
              offset="0"
              stopColor="var(--cp-brand-needle)"
              stopOpacity="0.28"
            />
            <stop
              offset="1"
              stopColor="var(--cp-brand-needle)"
              stopOpacity="0"
            />
          </radialGradient>
        </defs>
        <circle r={520} fill="url(#auth-glow)" />
        <g fill="none" stroke="currentColor">
          <circle r={320} strokeOpacity={0.12} />
          <circle r={250} strokeOpacity={0.08} strokeDasharray="2 8" />
          <g className="auth-dial">
            <circle r={400} strokeOpacity={0.22} />
            <circle r={440} strokeOpacity={0.07} />
            {TICKS.map((deg) => {
              const long = deg % 30 === 0;
              const [x1, y1] = polar(deg, long ? 372 : 386);
              const [x2, y2] = polar(deg, 400);
              return (
                <line
                  key={deg}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeOpacity={long ? 0.4 : 0.2}
                  strokeWidth={long ? 1.5 : 1}
                />
              );
            })}
          </g>
          <path
            d="M0 -418 L-9 -402 L9 -402 Z"
            fill="var(--cp-brand-needle)"
            stroke="none"
          />
          <path
            d={PRICE_PATH}
            strokeOpacity={0.12}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <path
            d={COURSE}
            stroke="var(--cp-brand-needle)"
            strokeOpacity={0.7}
            strokeWidth={1.5}
            strokeDasharray="6 5"
            className="auth-course"
          />
          {WAYPOINTS.map(([x, y], i) => (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={10}
                stroke="var(--cp-brand-needle)"
                strokeOpacity={0.4}
              />
              <circle
                cx={x}
                cy={y}
                r={4}
                fill="var(--cp-brand-needle)"
                stroke="none"
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
