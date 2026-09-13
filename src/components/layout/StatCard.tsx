import type { ReactNode } from 'react';
import { Card } from '../ui/Card';
export function StatCard({
  label,
  value,
  status,
}: {
  label: string;
  value: ReactNode;
  status?: ReactNode;
}) {
  return (
    <Card>
      <dl>
        <dt>{label}</dt>
        <dd className="stat-value numeric">{value}</dd>
      </dl>
      {status}
    </Card>
  );
}
