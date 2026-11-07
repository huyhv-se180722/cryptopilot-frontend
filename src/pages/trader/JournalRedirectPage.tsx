import { Navigate } from 'react-router-dom';

/**
 * A journal entry has no read of its own (`GET /journal/{id}` is planned):
 * its detail opens from the row on SCR-20, so its address leads there.
 */
export function JournalRedirectPage() {
  return <Navigate to="/journal" replace />;
}
