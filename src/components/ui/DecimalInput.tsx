import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import { groupThousands } from '../../utils/decimal-format';
import { Input } from './Input';

type Props = Omit<
  ComponentProps<typeof Input>,
  'value' | 'onChange' | 'inputMode' | 'ref'
> & {
  /** The plain decimal the form holds ("81320.5"), never grouped. */
  value: string;
  onValueChange: (value: string) => void;
};

/** What the field shows: a plain decimal grouped, anything else as typed. */
const shown = (value: string) =>
  /^\d*\.?\d*$/.test(value) ? groupThousands(value) : value;

/** Characters before `caret` that the field keeps (not commas or spaces). */
const kept = (text: string, caret: number) =>
  text.slice(0, caret).replace(/[,\s]/g, '').length;

/** The caret in `text` after `count` characters that are not grouping commas. */
function caretAfter(text: string, count: number): number {
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (seen === count) return i;
    if (text[i] !== ',') seen++;
  }
  return text.length;
}

/**
 * A decimal field grouped by thousands as on the exchange's panel, so that
 * "81,320" reads as the price it is and "81.32" cannot pass for it. The comma
 * groups and the point is the decimal mark, as everywhere the app shows a
 * number; a comma typed or pasted is dropped, and the caret keeps its place
 * among the digits while the grouping moves around it.
 */
export function DecimalInput({ value, onValueChange, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const text = shown(value);

  useLayoutEffect(() => {
    const element = input.current;
    if (caret.current === null || !element) return;
    if (element === document.activeElement) {
      const at = caretAfter(text, caret.current);
      element.setSelectionRange(at, at);
    }
    caret.current = null;
  }, [text]);

  return (
    <Input
      {...props}
      ref={input}
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        const typed = event.target.value;
        caret.current = kept(
          typed,
          event.target.selectionStart ?? typed.length,
        );
        onValueChange(typed.replace(/[,\s]/g, ''));
      }}
    />
  );
}
