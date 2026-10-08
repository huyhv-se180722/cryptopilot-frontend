import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/feedback/States';
import { buttonClassName } from '../components/ui/button-styles';
import { useCopy } from '../hooks/use-copy';

export function NotFoundPage() {
  const copy = useCopy();
  return (
    <EmptyState
      icon={Compass}
      title={copy.errors.notFoundTitle}
      description={copy.errors.notFoundBody}
      action={
        <Link to="/" className={buttonClassName('secondary')}>
          {copy.common.returnHome}
        </Link>
      }
    />
  );
}
