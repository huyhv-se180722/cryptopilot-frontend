import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { problemOf } from '../../../services/api/errors';

/**
 * SRS 3.3.2: when Admin disables the pair while it is open, the analysis
 * answers 404 (MSG41); the screen says the pair is gone and returns to
 * SCR-09.
 */
export function useLeaveDisabledPair(error: unknown) {
  const copy = useCopy();
  const { show } = useToast();
  const navigate = useNavigate();
  const gone = problemOf(error)?.code === 'RESOURCE_NOT_FOUND';
  useEffect(() => {
    if (!gone) return;
    show({ tone: 'info', message: copy.analysis.pairGone });
    navigate('/markets', { replace: true });
  }, [gone, show, navigate, copy]);
}
