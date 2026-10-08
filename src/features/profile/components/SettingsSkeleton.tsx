import { Card } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';

/**
 * Loading state of an SCR-07 tab: card shapes with a section label and
 * field rows, so the layout does not jump when the data lands.
 */
export function SettingsSkeleton({ cards = 2 }: { cards?: number }) {
  const copy = useCopy();
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{copy.common.loading}</span>
      {Array.from({ length: cards }, (_, card) => (
        <Card key={card} padding="lg" className="mb-5">
          <Skeleton className="mb-5 h-2.5 w-24" />
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((field) => (
              <div key={field}>
                <Skeleton className="mb-2 h-3 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Loading state of the risk questionnaire: a question with its options. */
export function QuestionSkeleton() {
  const copy = useCopy();
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{copy.common.loading}</span>
      <Skeleton className="mb-2 h-2.5 w-20" />
      <Skeleton className="mb-4 h-4 w-4/5" />
      {[0, 1, 2].map((option) => (
        <Skeleton key={option} className="mb-2 h-10 w-full" />
      ))}
    </div>
  );
}
