/** Shared plumbing for daily rounds: the same questions for everyone on a date. */
import { dayNumber, hashString, mulberry32, previousDayKey } from './rng';
import { loadStats, recordResult, saveStats, type GameStats } from './stats';

export type Mode = 'daily' | 'practice';

/** A generator seeded by game and date: every player gets the same round. */
export function dailyRand(game: string, day: string): () => number {
  return mulberry32(hashString(`${game}:${day}`));
}

/** Record that today's round was finished; the streak counts consecutive days. */
export function recordDaily(game: string, day: string, won = true): GameStats {
  const key = `${game}-daily`;
  const next = recordResult(loadStats(key, 0), won, 0, { today: day, yesterday: previousDayKey(day) });
  saveStats(key, next);
  return next;
}

export function dailyStreak(game: string): number {
  return loadStats(`${game}-daily`, 0).streak;
}

export { dayNumber };
