const SIZE = 16;

/**
 * A pattern drawn as the swings it is made of, on a 16 × 16 grid; `fill`
 * shades its first triangle as a harmonic pattern's figure does.
 */
export function Swings({
  points,
  fill = false,
}: {
  points: readonly (readonly [number, number])[];
  fill?: boolean;
}) {
  const path = points.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {fill && (
        <polygon
          points={points
            .slice(0, 3)
            .map(([x, y]) => `${x},${y}`)
            .join(' ')}
          fill="currentColor"
          fillOpacity={0.25}
          stroke="none"
        />
      )}
      <polyline points={path} />
    </svg>
  );
}
