/** The week's risers and fallers, and the daily "who gained more?" quiz. */
import type { History } from '../data/history';
import type { Player } from '../data/types';
import type { ValueSource } from '../data/valueSource';

/** Below this value a percentage swing says little (€0.3M → €0.5M is +67%). */
export const MOVE_MIN_VALUE = 5_000_000;

export interface Move {
  player: Player;
  from: number;
  to: number;
  /** to / from − 1 */
  change: number;
}

export interface Moves {
  from: string;
  to: string;
  risers: Move[];
  fallers: Move[];
  /** Everyone whose value changed. */
  all: Move[];
}

/** Changes between the last two weekly snapshots, biggest first. Null with fewer than two. */
export function weeklyMoves(h: History, players: readonly Player[], source: ValueSource, limit = 8): Moves | null {
  const n = h.dates.length;
  if (n < 2) return null;
  const all: Move[] = [];
  for (const p of players) {
    const row = h.players[p.name]?.[source];
    const a = row?.[n - 2];
    const b = row?.[n - 1];
    if (a == null || b == null || a === b) continue;
    const from = a * h.unit;
    const to = b * h.unit;
    if (Math.max(from, to) < MOVE_MIN_VALUE) continue;
    all.push({ player: p, from, to, change: to / from - 1 });
  }
  const byChange = [...all].sort((x, y) => y.change - x.change);
  return {
    from: h.dates[n - 2],
    to: h.dates[n - 1],
    risers: byChange.filter((m) => m.change > 0).slice(0, limit),
    fallers: byChange.filter((m) => m.change < 0).reverse().slice(0, limit),
    all,
  };
}

export const QUIZ_ROUNDS = 5;

/**
 * Pairs for "who gained more this week?": two players whose changes differ by
 * at least five points, so every pair has a clear answer, and nobody twice.
 */
export function quizPairs(moves: readonly Move[], rand: () => number, rounds = QUIZ_ROUNDS): [Move, Move][] {
  const pool = [...moves].sort((a, b) => a.player.name.localeCompare(b.player.name));
  const used = new Set<number>();
  const pairs: [Move, Move][] = [];
  for (let tries = 0; pairs.length < rounds && tries < 500; tries++) {
    const a = pool[Math.floor(rand() * pool.length)];
    const b = pool[Math.floor(rand() * pool.length)];
    if (!a || !b || a === b || used.has(a.player.id) || used.has(b.player.id)) continue;
    if (Math.abs(a.change - b.change) < 0.05) continue;
    used.add(a.player.id);
    used.add(b.player.id);
    // Draw which one goes on the left, so the answer is not always the same side.
    pairs.push(rand() < 0.5 ? [a, b] : [b, a]);
  }
  return pairs;
}
