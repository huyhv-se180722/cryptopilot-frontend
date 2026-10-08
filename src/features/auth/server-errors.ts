import { problemOf } from '../../services/api/errors';
import { SERVER_FIELD_ALIASES } from './schemas';

/**
 * Pushes backend field errors (message ids) into a form. Returns true when
 * at least one landed on a field, so the caller can skip the banner.
 */
export function applyServerFieldErrors<TField extends string>(
  error: unknown,
  fields: readonly TField[],
  setError: (field: TField, error: { type: 'server'; message: string }) => void,
): boolean {
  const problem = problemOf(error);
  if (!problem) return false;
  let applied = false;
  for (const [key, messageId] of Object.entries(problem.fieldErrors)) {
    const field = (SERVER_FIELD_ALIASES[key] ?? key) as TField;
    if (!fields.includes(field)) continue;
    setError(field, { type: 'server', message: messageId });
    applied = true;
  }
  return applied;
}
