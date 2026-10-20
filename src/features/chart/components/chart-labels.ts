/** Least gap between two axis labels, in pixels: one label's height. */
const LABEL_GAP_PX = 18;

/**
 * Which lines may show their label: each line that yields does when its
 * price lies at least one label's height from every label already shown
 * (`taken`, the last price and the lines that do not yield first).
 */
export function labelsShown(
  lines: readonly { y: number | null; yields?: boolean }[],
  taken: readonly number[],
): boolean[] {
  const held = [...taken];
  for (const line of lines)
    if (!line.yields && line.y !== null) held.push(line.y);
  return lines.map((line) => {
    if (!line.yields || line.y === null) return true;
    const y = line.y;
    const clear = held.every((other) => Math.abs(other - y) >= LABEL_GAP_PX);
    if (clear) held.push(y);
    return clear;
  });
}
