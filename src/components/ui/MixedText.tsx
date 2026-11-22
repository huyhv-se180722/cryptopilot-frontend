import { Fragment } from 'react';

/**
 * A number standing alone in a text: digits with separators and decimals,
 * an optional sign and percent; "4h" or "BTC2" are words, not numbers.
 */
const NUMBER = /(?<![\p{L}\d.,])[-+−]?\d[\d,]*(?:\.\d+)?%?(?![\p{L}\d])/gu;

/**
 * A text that mixes words and numbers (an alert condition, "Entry 79.92"):
 * the words stay in the body font and only the numbers are set in the
 * tabular monospace font (D-161), so a sentence never turns monospace.
 */
export function MixedText({ text }: { text: string }) {
  const parts: { value: string; numeric: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(NUMBER)) {
    const start = match.index;
    if (start > last)
      parts.push({ value: text.slice(last, start), numeric: false });
    parts.push({ value: match[0], numeric: true });
    last = start + match[0].length;
  }
  if (last < text.length)
    parts.push({ value: text.slice(last), numeric: false });
  return (
    <>
      {parts.map((part, index) =>
        part.numeric ? (
          <span key={index} data-numeric className="font-mono tabular-nums">
            {part.value}
          </span>
        ) : (
          <Fragment key={index}>{part.value}</Fragment>
        ),
      )}
    </>
  );
}
