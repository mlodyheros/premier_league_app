import { useEffect, useRef, useState } from 'preact/hooks';
import { reducedMotion } from '../lib/motion';

/**
 * A number that counts up to `target` when `run` is true (ease-out), and
 * simply shows `target` otherwise or when motion is reduced.
 */
export function useCountUp(target: number, run = true, duration = 900, from = 0): number {
  const [value, setValue] = useState(run && !reducedMotion() && !document.hidden ? from : target);
  const frame = useRef(0);

  useEffect(() => {
    // A hidden tab gets no animation frames: show the result rather than a frozen zero.
    if (!run || reducedMotion() || document.hidden) {
      setValue(target);
      return;
    }
    const skip = () => document.hidden && setValue(target);
    document.addEventListener('visibilitychange', skip);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(from + (target - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame.current);
      document.removeEventListener('visibilitychange', skip);
    };
  }, [target, run]);

  return value;
}
