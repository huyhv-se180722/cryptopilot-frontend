import { Navigate } from 'react-router-dom';

/**
 * The journal (SCR-20) is the left column of Trading Plans: its old
 * addresses lead there.
 */
export function JournalRedirectPage() {
  return <Navigate to="/plans" replace />;
}
