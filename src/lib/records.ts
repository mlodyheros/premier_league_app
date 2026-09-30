/** Personal bests, one number per key, in localStorage. */
import { readJson, writeJson } from './storage';

export function getBest(key: string): number | null {
  const v = readJson<number>(`best:${key}`);
  return typeof v === 'number' ? v : null;
}

/** Save `value` if it beats the stored best; returns whether it did. */
export function submitBest(key: string, value: number, higherIsBetter = true): boolean {
  const best = getBest(key);
  const better = best === null || (higherIsBetter ? value > best : value < best);
  if (better) writeJson(`best:${key}`, value);
  return better;
}
