import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react';
import {
  groupThousands,
  hasDecimalComma,
  readDecimal,
} from '../../utils/decimal-format';
import { Input } from './Input';

type Props = Omit<
  ComponentProps<typeof Input>,
  'value' | 'onChange' | 'inputMode' | 'ref'
> & {
  /** The plain decimal the form holds ("81320.5"), never grouped. */
  value: string;
  onValueChange: (value: string) => void;
};

const PLAIN = /^\d*\.?\d*$/;

/** What the field shows: a plain decimal grouped, anything else as typed. */
const shown = (value: string) =>
  PLAIN.test(value) ? groupThousands(value) : value;

const commas = (text: string) => text.split(',').length - 1;

/**
 * The text as the Trader typed it, without the commas the field put in to
 * group. A text shown as typed has none of the field's; otherwise only a
 * comma just typed at the caret is the Trader's, and a paste into an empty
 * field is the Trader's as a whole.
 */
function userText(typed: string, before: string, raw: boolean, at: number) {
  if (raw || commas(before) === 0) return typed;
  if (commas(typed) <= commas(before)) return typed.replace(/,/g, '');
  if (typed[at - 1] === ',')
    return (
      typed.slice(0, at - 1).replace(/,/g, '') +
      ',' +
      typed.slice(at).replace(/,/g, '')
    );
  return typed;
}

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
 * "81,320" reads as the price it is and "81.32" cannot pass for it. The point
 * is the decimal mark and commas group, as everywhere the app shows a number;
 * a lone comma that cannot group ("0,5") is taken as the decimal mark and
 * shown as typed until the field is left, so a Vietnamese habit never turns
 * 0.5 into 5. The caret keeps its place among the digits while the grouping
 * moves around it.
 */
export function DecimalInput({
  value,
  onValueChange,
  onBlur,
  ...props
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  // A decimal comma stays as typed while its value is the one in the form.
  const [typing, setTyping] = useState<{ text: string; value: string } | null>(
    null,
  );
  const raw = typing !== null && typing.value === value;
  const text = raw ? typing.text : shown(value);

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
      onBlur={(event) => {
        setTyping(null);
        onBlur?.(event);
      }}
      onChange={(event) => {
        const typed = event.target.value.replace(/\s/g, '');
        const at = event.target.selectionStart ?? typed.length;
        const own = userText(typed, text, raw, at);
        const next = readDecimal(own);
        const decimalComma = hasDecimalComma(own);
        if (decimalComma || !PLAIN.test(next)) {
          setTyping(decimalComma ? { text: own, value: next } : null);
          caret.current = null;
        } else {
          setTyping(null);
          caret.current = kept(typed, at);
        }
        onValueChange(next);
      }}
    />
  );
}
