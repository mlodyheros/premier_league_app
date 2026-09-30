/** Win/streak records per game mode, kept in localStorage. */
import { readJson, writeJson } from './storage';

export interface GameStats {
  played: number;
  won: number;
  streak: number;
  bestStreak: number;
  /** Wins by number of guesses: distribution[0] = won in one. */
  distribution: number[];
  /** Last date key a daily result was recorded, to keep daily streaks honest. */
  lastDay?: string;
}

export function emptyStats(slots: number): GameStats {
  return { played: 0, won: 0, streak: 0, bestStreak: 0, distribution: Array(slots).fill(0) };
}

export function loadStats(key: string, slots: number): GameStats {
  const saved = readJson<GameStats>(`stats:${key}`);
  if (!saved) return emptyStats(slots);
  const distribution = Array.from({ length: slots }, (_, i) => saved.distribution?.[i] ?? 0);
  return { ...emptyStats(slots), ...saved, distribution };
}

/**
 * Record one finished game. For daily modes pass the date key and the previous
 * day's key: a streak survives only if yesterday was also won.
 */
export function recordResult(
  stats: GameStats,
  won: boolean,
  guesses: number,
  daily?: { today: string; yesterday: string },
): GameStats {
  if (daily && stats.lastDay === daily.today) return stats;
  const continues = !daily || stats.lastDay === daily.yesterday;
  const streak = won ? (continues ? stats.streak + 1 : 1) : 0;
  const distribution = stats.distribution.slice();
  if (won && guesses >= 1 && guesses <= distribution.length) distribution[guesses - 1]++;
  return {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    distribution,
    lastDay: daily?.today ?? stats.lastDay,
  };
}

export function saveStats(key: string, stats: GameStats): void {
  writeJson(`stats:${key}`, stats);
}
