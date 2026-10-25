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
   * The other plain members of the body, e.g. `deviationR` of MSG51; read
   * only by the decoder of the refusal that carries them.
   */
  extensions?: Readonly<Record<string, string | number | boolean>>;
}

/** Members never kept as extensions: developer text and the fields above. */
const KNOWN = new Set([
  'type',
  'title',
  'status',
  'detail',
  'instance',
  'code',
  'messageCode',
  'messageArgs',
  'errors',
  'traceId',
]);

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
  const extensions: Record<string, string | number | boolean> = {};
  for (const [name, value] of Object.entries(body))
    if (
      !KNOWN.has(name) &&
      /^[A-Za-z]\w{0,63}$/.test(name) &&
      (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean')
    )
      extensions[name] = value;
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
