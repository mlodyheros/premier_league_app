/** Personal bests, one number per key, in localStorage. */
import { readJson, writeJson } from './storage';

export function getBest(key: string): number | null {
  const v = readJson<number>(`best:${key}`);
  return typeof v === 'number' ? v : null;
}

/**
 * Save `value` if it beats the stored best. Returns true only when it beat an
 * earlier best: a first result is saved but is not a "new record".
 */
export function submitBest(key: string, value: number, higherIsBetter = true): boolean {
  const best = getBest(key);
  if (best === null) {
    writeJson(`best:${key}`, value);
    return false;
  }
  const better = higherIsBetter ? value > best : value < best;
  if (better) writeJson(`best:${key}`, value);
  return better;
}
