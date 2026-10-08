import { applyServerFieldErrors as apply } from '../../utils/server-field-errors';
import { SERVER_FIELD_ALIASES } from './schemas';

/** Backend field errors into an auth form (`confirmPasswordMatching` included). */
export function applyServerFieldErrors<TField extends string>(
  error: unknown,
  fields: readonly TField[],
  setError: (field: TField, error: { type: 'server'; message: string }) => void,
): boolean {
  return apply(error, fields, setError, SERVER_FIELD_ALIASES);
}
