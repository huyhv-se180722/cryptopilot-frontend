import type { Copy } from './locales/en';
import { formatCopy } from './copy';
import { ServiceError } from '../services/api/errors';

export type MessageId = keyof Copy['messages'];

export function isMessageId(copy: Copy, id: string): id is MessageId {
  return Object.hasOwn(copy.messages, id);
}

/**
 * Fills placeholders: named values first, then positional `messageArgs`
 * in the order the placeholders appear (backend D-25 convention).
 */
export function messageText(
  copy: Copy,
  id: string,
  args: readonly string[] = [],
  named: Readonly<Record<string, string | number>> = {},
): string {
  const template = isMessageId(copy, id)
    ? copy.messages[id]
    : copy.messages.MSG43;
  const names = [
    ...new Set(
      [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? ''),
    ),
  ].filter((name) => !(name in named));
  const positional: Record<string, string> = {};
  names.forEach((name, index) => {
    const value = args[index];
    if (value !== undefined) positional[name] = value;
  });
  return formatCopy(template, {
    code: copy.errors.unknownReference,
    ...positional,
    ...named,
  });
}

/** Text for a field error id, filling {field} with the visible label. */
export function fieldErrorText(copy: Copy, id: string, fieldLabel: string) {
  return messageText(copy, id, [], { field: fieldLabel.toLowerCase() });
}

/**
 * True when `errorText` falls back to MSG43 (unexpected error). SRS 5.3
 * shows MSG43 as a toast; every other failure keeps its own placement.
 */
export function isUnexpectedError(copy: Copy, error: unknown): boolean {
  if (!(error instanceof ServiceError)) return true;
  const problem = error.problem;
  if (problem) {
    if (
      problem.code === 'RATE_LIMITED' ||
      problem.code === 'ACCOUNT_NOT_ACTIVE'
    )
      return false;
    return (
      !isMessageId(copy, problem.messageCode) || problem.messageCode === 'MSG43'
    );
  }
  return !['NOT_CONFIGURED', 'NETWORK_ERROR', 'TIMEOUT'].includes(error.code);
}

/** User-facing text for any service failure; never backend developer text. */
export function errorText(copy: Copy, error: unknown): string {
  if (error instanceof ServiceError) {
    const problem = error.problem;
    if (problem) {
      if (problem.code === 'RATE_LIMITED')
        return formatCopy(copy.errors.rateLimited, {
          seconds: problem.messageArgs[0] ?? '60',
        });
      if (problem.code === 'ACCOUNT_NOT_ACTIVE')
        return messageText(copy, 'MSG10', [], {
          status:
            problem.messageArgs[0] === 'BANNED'
              ? copy.blocked.statusBanned
              : copy.blocked.statusLocked,
        });
      const text = messageText(
        copy,
        problem.messageCode,
        problem.messageArgs,
        problem.traceId ? { code: problem.traceId } : {},
      );
      // A field message (MSG01, MSG15…) shown away from the form that
      // would name its field has nothing to fill {field} with: never show
      // the placeholder itself.
      return /\{\w+\}/.test(text) ? copy.errors.invalidRequest : text;
    }
    if (error.code === 'NOT_CONFIGURED') return copy.errors.notConfigured;
    if (error.code === 'NETWORK_ERROR') return copy.errors.network;
    if (error.code === 'TIMEOUT') return copy.errors.timeout;
  }
  return messageText(copy, 'MSG43');
}
