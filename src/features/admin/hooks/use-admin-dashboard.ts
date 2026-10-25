import { useCallback } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type { AdminPeriod, ReportGrouping } from '../../../types/domain';

const KEY = ['admin-dashboard'] as const;

/** SCR-33 indicators of the period (UC-40). */
export function useAdminDashboard(period: AdminPeriod) {
  const { adminDashboard } = useServices();
  return useQuery({
    queryKey: [...KEY, 'indicators', period],
    queryFn: ({ signal }) => adminDashboard.dashboard(period, signal),
    placeholderData: keepPreviousData,
  });
}

/** The management report of the period by day, week or month (UC-41). */
export function useAdminReport(period: AdminPeriod, groupBy: ReportGrouping) {
  const { adminDashboard } = useServices();
  return useQuery({
    queryKey: [...KEY, 'report', period, groupBy],
    queryFn: ({ signal }) => adminDashboard.report(period, groupBy, signal),
    placeholderData: keepPreviousData,
  });
}

/** The CSV text of the same report, for the browser to save. */
export function useExportReport() {
  const { adminDashboard } = useServices();
  return useMutation(
    useCallback(
      (period: AdminPeriod, groupBy: ReportGrouping) =>
        adminDashboard.exportReport(period, groupBy),
      [adminDashboard],
    ),
  );
}
