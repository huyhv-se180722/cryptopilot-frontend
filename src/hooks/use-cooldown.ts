import { useCallback, useEffect, useState } from 'react';

/**
 * Client-side resend cooldown (SRS 3.2.2: once per 60 s). The server limit
 * is authoritative once implemented; this only prevents double requests.
 */
export function useCooldown(seconds: number) {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= now) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until, now]);

  const start = useCallback(() => {
    const started = Date.now();
    setNow(started);
    setUntil(started + seconds * 1000);
  }, [seconds]);

  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  return { remaining, active: remaining > 0, start };
}
