/** The week's risers and fallers. */
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
  // Ranked by the change in euros: a €0.3M youngster revalued at €7M is +2233%,
  // which says less than a star's €15M rise.
  const byAmount = [...all].sort((x, y) => y.to - y.from - (x.to - x.from));
  return {
    from: h.dates[n - 2],
    to: h.dates[n - 1],
    risers: byAmount.filter((m) => m.to > m.from).slice(0, limit),
    fallers: byAmount.filter((m) => m.to < m.from).reverse().slice(0, limit),
    all,
  };
}
