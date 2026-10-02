import { useEffect, useRef } from 'preact/hooks';
import { reducedMotion } from '../lib/motion';

/**
 * Bring an element into view the moment `active` turns true: a round's result
 * appears below the card the player was looking at, often off screen on a
 * phone. Only on the change, so reopening a finished round does not jump.
 */
export function useRevealWhen<T extends HTMLElement = HTMLDivElement>(active: boolean) {
  const ref = useRef<T>(null);
  const was = useRef(active);
  useEffect(() => {
    if (active && !was.current) {
      // After the panel has rendered (a timeout, not a frame: frames pause in background tabs).
      setTimeout(() => ref.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' }), 60);
    }
    was.current = active;
  }, [active]);
  return ref;
}
