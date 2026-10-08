import { Link } from 'react-router-dom';
import { EmptyState } from '../components/feedback/States';
import { useCopy } from '../hooks/use-copy';

export function NotFoundPage() {
  const copy = useCopy();
  return (
    <>
      <EmptyState
        title={copy.errors.notFoundTitle}
        description={copy.errors.notFoundBody}
      />
      <Link to="/">{copy.common.returnHome}</Link>
    </>
  );
}
