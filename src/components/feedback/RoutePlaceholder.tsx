import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { PageHeader } from '../layout/PageHeader';
import { useCopy } from '../../hooks/use-copy';

export function RoutePlaceholder({
  title,
  screen,
}: {
  title: string;
  screen?: string;
}) {
  const copy = useCopy();
  return (
    <section>
      <PageHeader title={title} description={copy.product.description} />
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info" withDot>
            {copy.placeholder.badge}
          </Badge>
          {screen && <Badge>{screen}</Badge>}
        </div>
        <h2 className="mt-3 text-sm font-semibold">{copy.placeholder.title}</h2>
        <p className="mt-1 text-xs text-muted-dim">{copy.placeholder.body}</p>
      </Card>
    </section>
  );
}
