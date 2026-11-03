import { useCallback } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type { AuditLogQuery, SystemEventQuery } from '../../../types/domain';

const KEY = ['admin-audit'] as const;

/** How often the health panel reads the services again while open. */
export const HEALTH_REFRESH_MS = 30_000;

/** A page of the audit log, newest first, filtered by the server (UC-46). */
export function useAuditLog(query: AuditLogQuery) {
  const { adminAudit } = useServices();
  return useQuery({
    queryKey: [...KEY, 'audit', query],
    queryFn: ({ signal }) => adminAudit.auditLog(query, signal),
    placeholderData: keepPreviousData,
  });
}

/** A page of the system log, the latest failure first. */
export function useSystemEvents(query: SystemEventQuery, enabled = true) {
  const { adminAudit } = useServices();
  return useQuery({
    queryKey: [...KEY, 'events', query],
    queryFn: ({ signal }) => adminAudit.systemEvents(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** The health panel, read again every 30 seconds while the screen is open. */
export function useSystemHealth() {
  const { adminAudit } = useServices();
  return useQuery({
    queryKey: [...KEY, 'health'],
    queryFn: ({ signal }) => adminAudit.health(signal),
    refetchInterval: HEALTH_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}

/** The CSV text of the same audit search, for the browser to save. */
export function useExportAuditLog() {
  const { adminAudit } = useServices();
  return useMutation(
    useCallback(
      (query: Omit<AuditLogQuery, 'page'>) => adminAudit.exportAuditLog(query),
      [adminAudit],
    ),
  );
}
