/** Higher or Lower: who comes next, and whether a call was right. */
import type { Player } from '../../data/types';
import { valueOf, type ValueSource } from '../../data/valueSource';

/** Players below this Transfermarkt value are too obscure to be fair. */
export const MIN_VALUE = 5_000_000;

export type Call = 'higher' | 'lower';

export function pool(players: readonly Player[]): Player[] {
  return players.filter((p) => p.tm >= MIN_VALUE);
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
