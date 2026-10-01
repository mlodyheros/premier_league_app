/** Higher or Lower: who comes next, and whether a call was right. */
import type { Player } from '../../data/types';
import { valueOf, type ValueSource } from '../../data/valueSource';
import { inPool, type PoolLevel } from '../../lib/pools';

/** Players below this Transfermarkt value are too obscure to be fair. */
export const MIN_VALUE = 3_000_000;

export type Call = 'higher' | 'lower';

export type Theme = 'all' | 'FWD' | 'MID' | 'DEF' | 'GK' | 'big6';
export const THEMES: Theme[] = ['all', 'FWD', 'MID', 'DEF', 'GK', 'big6'];
const BIG_SIX = new Set(['ARS', 'CHE', 'LIV', 'MCI', 'MUN', 'TOT']);
/** Below this many players a themed pool is widened one level (easy → normal → expert). */
const MIN_POOL = 16;

function themed(p: Player, theme: Theme): boolean {
  if (theme === 'all') return true;
  if (theme === 'big6') return BIG_SIX.has(p.club);
  return p.group === theme;
}

/** Players for a run: the chosen level and theme, widened if that leaves too few. */
export function pool(players: readonly Player[], level: PoolLevel = 'normal', theme: Theme = 'all'): Player[] {
  const pick = (lvl: PoolLevel) => players.filter((p) => p.tm >= MIN_VALUE && inPool(p, lvl) && themed(p, theme));
  const order: PoolLevel[] = ['easy', 'normal', 'expert'];
  for (const lvl of order.slice(order.indexOf(level))) {
    const chosen = pick(lvl);
    if (chosen.length >= MIN_POOL || lvl === 'expert') return chosen;
  }
  return pick('expert');
}

/**
 * How far apart the two values may be (as a ratio) at this streak: anything
 * goes at first, then the pairs get closer and the calls harder.
 */
export function maxRatio(streak: number): number {
  if (streak < 5) return Infinity;
  if (streak < 10) return 3;
  if (streak < 20) return 2;
  return 1.5;
}

/**
 * The next challenger for `current`: never the same value (a tie has no right
 * answer), never a recently seen player, and within the streak's ratio when
 * such a player exists.
 */
export function nextChallenger(
  current: Player,
  candidates: readonly Player[],
  source: ValueSource,
  streak: number,
  recent: ReadonlySet<number>,
  rand: () => number = Math.random,
): Player {
  const cv = valueOf(current, source);
  const eligible = candidates.filter((p) => p.id !== current.id && valueOf(p, source) !== cv);
  const fresh = eligible.filter((p) => !recent.has(p.id));
  const limit = maxRatio(streak);
  const close = (fresh.length ? fresh : eligible).filter((p) => {
    const v = valueOf(p, source);
    return Math.max(v, cv) / Math.min(v, cv) <= limit;
  });
  const from = close.length ? close : fresh.length ? fresh : eligible;
  return from[Math.floor(rand() * from.length)];
}

export function isCorrect(current: Player, challenger: Player, call: Call, source: ValueSource): boolean {
  const higher = valueOf(challenger, source) > valueOf(current, source);
  return call === 'higher' ? higher : !higher;
}
