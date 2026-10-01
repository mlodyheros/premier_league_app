import { useEffect, useState } from 'preact/hooks';
import { msUntilTomorrow } from '../lib/rng';

/** "hh:mm:ss" until local midnight, ticking while `active`. */
export function useCountdown(active = true): string {
  const [ms, setMs] = useState(msUntilTomorrow);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setMs(msUntilTomorrow()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
