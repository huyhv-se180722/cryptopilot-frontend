import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { PageHeader } from '../layout/PageHeader';
import { useCopy } from '../../hooks/use-copy';

export function RoutePlaceholder({ title }: { title: string }) {
  const copy = useCopy();
  return (
    <section>
      <PageHeader title={title} description={copy.product.description} />
      <Card>
        <Badge tone="info">{copy.placeholder.badge}</Badge>
        <h2 className="mt-3 text-sm font-semibold">{copy.placeholder.title}</h2>
        <p className="mt-1 text-xs text-muted-dim">{copy.placeholder.body}</p>
      </Card>
    </section>
  );
}
