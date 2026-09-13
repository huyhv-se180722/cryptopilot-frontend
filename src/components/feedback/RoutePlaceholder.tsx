import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { PageHeader } from '../layout/PageHeader';

export function RoutePlaceholder({ title }: { title: string }) {
  return (
    <section>
      <PageHeader title={title} description="Crypto Trading Support System" />
      <Card>
        <Badge tone="info">Foundation</Badge>
        <h2>Ready for feature development</h2>
        <p>
          This route is reserved. Its screen and backend integration will be
          implemented in a dedicated feature branch.
        </p>
      </Card>
    </section>
  );
}
