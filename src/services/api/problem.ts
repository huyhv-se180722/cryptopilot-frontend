/**
 * RFC 9457 problem detail as returned by the CryptoPilot backend, reduced to
 * the fields the UI may use. `title` and `detail` are developer text and are
 * deliberately dropped so they can never reach the screen.
 */
export interface ApiProblem {
  status: number;
  /** Stable error code to branch on, e.g. INVALID_CREDENTIALS. */
  code: string;
  /** SRS message id to display, e.g. MSG08. */
  messageCode: string;
  /** Values for the message placeholders, in order. */
  messageArgs: readonly string[];
  /** Field (or pseudo-field) → message id. Binding notes become MSG01. */
  fieldErrors: Readonly<Record<string, string>>;
  /** Reference shown in MSG43. */
  traceId?: string;
  /**
   * RFC 9457 extension members carrying values, e.g. `deviationR` of MSG51
   * (TP-C): decimal texts and booleans only; text members never pass.
   */
  extensions?: Readonly<Record<string, string | boolean>>;
}

/** Members of the problem itself, never extensions (title and detail are developer text). */
const STANDARD = new Set([
  'type',
  'title',
  'status',
  'detail',
  'instance',
  'code',
  'messageCode',
  'traceId',
  'messageArgs',
  'errors',
]);
const DECIMAL_TEXT = /^-?\d{1,30}(\.\d{1,20})?$/;

function extensionsOf(
  body: Record<string, unknown>,
): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(body)) {
    if (STANDARD.has(key) || !/^[a-z][A-Za-z0-9]{0,63}$/.test(key)) continue;
    if (typeof value === 'boolean') values[key] = value;
    else if (typeof value === 'string' && DECIMAL_TEXT.test(value))
      values[key] = value;
  }
  return values;
}

const MESSAGE_ID = /^MSG\d{2}$/;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns undefined for anything that is not a recognisable problem body. */
export function decodeProblem(
  body: unknown,
  status: number,
): ApiProblem | undefined {
  if (!isRecord(body)) return undefined;
  const { code, messageCode, messageArgs, errors, traceId } = body;
  if (typeof code !== 'string' || !CODE.test(code)) return undefined;
  if (typeof messageCode !== 'string' || !MESSAGE_ID.test(messageCode))
    return undefined;
  const args = Array.isArray(messageArgs)
    ? messageArgs.filter((arg): arg is string => typeof arg === 'string')
    : [];
  const fieldErrors: Record<string, string> = {};
  if (isRecord(errors)) {
    for (const [field, value] of Object.entries(errors)) {
      if (typeof value !== 'string' || !/^[A-Za-z][\w.]{0,63}$/.test(field))
        continue;
      fieldErrors[field] = MESSAGE_ID.test(value) ? value : 'MSG01';
    }
  }
  const extensions = extensionsOf(body);
  return {
    status,
    code,
    messageCode,
    messageArgs: args,
    fieldErrors,
    ...(typeof traceId === 'string' && /^[\w.:-]{1,64}$/.test(traceId)
      ? { traceId }
      : {}),
    ...(Object.keys(extensions).length > 0 ? { extensions } : {}),
  };
}
