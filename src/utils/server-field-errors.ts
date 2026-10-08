import { problemOf } from '../services/api/errors';

/**
 * Pushes backend field errors (message ids) into a form. `aliases` maps a
 * server field name to the form field it belongs to. Returns true when at
 * least one landed on a field, so the caller can skip the banner.
 */
export function applyServerFieldErrors<TField extends string>(
  error: unknown,
  fields: readonly TField[],
  setError: (field: TField, error: { type: 'server'; message: string }) => void,
  aliases: Readonly<Record<string, string>> = {},
): boolean {
  const problem = problemOf(error);
  if (!problem) return false;
  let applied = false;
  for (const [key, messageId] of Object.entries(problem.fieldErrors)) {
    const field = (aliases[key] ?? key) as TField;
    if (!fields.includes(field)) continue;
    setError(field, { type: 'server', message: messageId });
    applied = true;
  }
  return applied;
}
