import { Link } from 'react-router-dom';
import { EmptyState } from '../components/feedback/States';
export function NotFoundPage() {
  return (
    <>
      <EmptyState
        title="Page not found"
        description="This route does not exist."
      />
      <Link to="/">Return home</Link>
    </>
  );
}
