import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type {
  NewPackage,
  PackageChange,
  TierLimits,
} from '../../../services/api/admin-packages';
import type { PlanTier } from '../../../types/domain';
import { BILLING_KEY } from '../../subscription/hooks/use-billing';

export {
  AI_QUOTA_MAX,
  LIMIT_COUNT_MAX,
  PACKAGE_CODE_MAX,
  PACKAGE_DURATION_MAX,
  PACKAGE_NAME_MAX,
  PACKAGE_PRICE_MAX,
  PACKAGE_TIERS,
  PAID_TIERS,
  type AdminPackage,
  type NewPackage,
  type PackageChange,
  type TierLimits,
} from '../../../services/api/admin-packages';

export const ADMIN_PACKAGES_KEY = ['admin-packages'] as const;

/** Every package, inactive ones included, lowest tier first (UC-42). */
export function useAdminPackages() {
  const { adminPackages } = useServices();
  return useQuery({
    queryKey: ADMIN_PACKAGES_KEY,
    queryFn: ({ signal }) => adminPackages.list(signal),
  });
}

/** After a change the list is read again: a change may touch several rows. */
function useChanged() {
  const client = useQueryClient();
  return useCallback(async () => {
    await client.invalidateQueries({ queryKey: ADMIN_PACKAGES_KEY });
    // The plans page and the Trader's entitlements follow the change.
    await client.invalidateQueries({ queryKey: [...BILLING_KEY, 'packages'] });
  }, [client]);
}

export function useCreatePackage() {
  const { adminPackages } = useServices();
  const changed = useChanged();
  return useMutation(
    useCallback(
      async (input: NewPackage) => {
        const created = await adminPackages.create(input);
        await changed();
        return created;
      },
      [adminPackages, changed],
    ),
  );
}

export function useUpdatePackage() {
  const { adminPackages } = useServices();
  const changed = useChanged();
  return useMutation(
    useCallback(
      async (packageId: string, change: PackageChange) => {
        const saved = await adminPackages.update(packageId, change);
        await changed();
        return saved;
      },
      [adminPackages, changed],
    ),
  );
}

export function useSetPackageActive() {
  const { adminPackages } = useServices();
  const changed = useChanged();
  return useMutation(
    useCallback(
      async (packageId: string, active: boolean) => {
        const saved = await adminPackages.setActive(packageId, active);
        await changed();
        return saved;
      },
      [adminPackages, changed],
    ),
  );
}

export function useDeletePackage() {
  const { adminPackages } = useServices();
  const changed = useChanged();
  return useMutation(
    useCallback(
      async (packageId: string) => {
        await adminPackages.remove(packageId);
        await changed();
      },
      [adminPackages, changed],
    ),
  );
}

export function useSaveTierLimits() {
  const { adminPackages } = useServices();
  const changed = useChanged();
  return useMutation(
    useCallback(
      async (tier: PlanTier, limits: TierLimits) => {
        const saved = await adminPackages.saveTierLimits(tier, limits);
        await changed();
        return saved;
      },
      [adminPackages, changed],
    ),
  );
}
