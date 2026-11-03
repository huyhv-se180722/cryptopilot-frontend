import { useCopy } from '../../../hooks/use-copy';
import { isKnownAction, isKnownEntity } from '../components/audit-format';

/** The words for an audit action and an audited object; a new code shows as sent. */
export function useAuditLabels() {
  const t = useCopy().adminAuditLog;
  return {
    action: (action: string) =>
      isKnownAction(action) ? t[`action${action}`] : action,
    entity: (type: string | null) =>
      type === null ? t.none : isKnownEntity(type) ? t[`entity${type}`] : type,
  };
}
