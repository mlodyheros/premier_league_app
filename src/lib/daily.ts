/** Shared plumbing for daily rounds: the same questions for everyone on a date. */
import { dayNumber, hashString, mulberry32, previousDayKey } from './rng';
import { loadStats, recordResult, saveStats, type GameStats } from './stats';
import { readJson, writeJson } from './storage';

export type Mode = 'daily' | 'practice';

/** A generator seeded by game and date: every player gets the same round. */
export function dailyRand(game: string, day: string): () => number {
  return mulberry32(hashString(`${game}:${day}`));
}

/** Record that today's round was finished; the streak counts consecutive days. */
export function recordDaily(game: string, day: string, won = true, result?: string): GameStats {
  if (result) saveDailyResult(game, day, result);
  const key = `${game}-daily`;
  const next = recordResult(loadStats(key, 0), won, 0, { today: day, yesterday: previousDayKey(day) });
  saveStats(key, next);
  return next;
}

export function dailyStreak(game: string): number {
  return loadStats(`${game}-daily`, 0).streak;
}

/** Today's score in a game, as shown on the home page and in the combined share ("7/10"). */
export function saveDailyResult(game: string, day: string, result: string): void {
  writeJson(`daily:result:${game}:${day}`, result);
}

export function dailyResult(game: string, day: string): string | null {
  return readJson<string>(`daily:result:${game}:${day}`);
}

export { dayNumber };
