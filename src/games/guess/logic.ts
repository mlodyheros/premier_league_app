/** Guess the Player: feedback rules, target choice and share text. No UI here. */
import type { Player } from '../../data/types';
import { valueOf, type ValueSource } from '../../data/valueSource';
import { dailyPoolFor } from '../../lib/pools';
import { dayNumber, hashString, mulberry32, shuffled } from '../../lib/rng';

export const MAX_GUESSES = 8;
/** Ages this close count as "near". */
export const AGE_NEAR = 2;
/** Values within this ratio of each other count as "near" (×1.25 either way). */
export const VALUE_NEAR = 1.25;

export type Mark = 'hit' | 'near' | 'miss';
export type Direction = 'up' | 'down' | null;

export interface Feedback {
  club: Mark;
  pos: Mark;
  nat: Mark;
  age: { mark: Mark; dir: Direction };
  value: { mark: Mark; dir: Direction };
  correct: boolean;
}

/** Which way the hidden player lies from the guess: 'up' = higher. */
function direction(guess: number, target: number): Direction {
  if (guess === target) return null;
  return target > guess ? 'up' : 'down';
}

export function compare(guess: Player, target: Player, source: ValueSource): Feedback {
  const gv = valueOf(guess, source);
  const tv = valueOf(target, source);
  const ageGap = Math.abs(guess.age - target.age);
  const valueRatio = Math.max(gv, tv) / Math.min(gv, tv);

  return {
    club: guess.club === target.club ? 'hit' : 'miss',
    pos: guess.pos === target.pos ? 'hit' : guess.group === target.group ? 'near' : 'miss',
    nat: guess.nat === target.nat ? 'hit' : guess.continent === target.continent ? 'near' : 'miss',
    age: {
      mark: ageGap === 0 ? 'hit' : ageGap <= AGE_NEAR ? 'near' : 'miss',
      dir: direction(guess.age, target.age),
    },
    value: {
      mark: gv === tv ? 'hit' : valueRatio <= VALUE_NEAR ? 'near' : 'miss',
      dir: direction(gv, tv),
    },
    correct: guess.id === target.id,
  };
}

/** Players who can be the daily answer on `day`, in a stable order independent of ids. */
export function dailyPool(players: readonly Player[], day: string): Player[] {
  return dailyPoolFor(players, day, (p) => p.known).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The daily answer. The pool is shuffled once with a fixed seed and walked one
 * player per day, so no player repeats until the whole pool has been used.
 */
export function dailyTarget(players: readonly Player[], dateKey: string): Player {
  const pool = dailyPool(players, dateKey);
  const order = shuffled(pool, mulberry32(hashString('guess-the-player')));
  const day = dayNumber(dateKey);
  const lap = Math.floor((day - 1) / order.length);
  // Each full lap reshuffles, so the second pass is not a replay of the first.
  const lapOrder = lap === 0 ? order : shuffled(pool, mulberry32(hashString(`guess-the-player:${lap}`)));
  const index = (((day - 1) % order.length) + order.length) % order.length;
  return lapOrder[index];
}

/** Same marks and arrows: two feedbacks tell the player the same thing. */
function sameFeedback(a: Feedback, b: Feedback): boolean {
  return (
    a.club === b.club &&
    a.pos === b.pos &&
    a.nat === b.nat &&
    a.age.mark === b.age.mark &&
    a.age.dir === b.age.dir &&
    a.value.mark === b.value.mark &&
    a.value.dir === b.value.dir &&
    a.correct === b.correct
  );
}

/** Players in `pool` who would have produced every piece of feedback so far. */
export function stillPossible(
  pool: readonly Player[],
  guesses: readonly Player[],
  feedback: readonly Feedback[],
  source: ValueSource,
): Player[] {
  return pool.filter((c) => guesses.every((g, i) => sameFeedback(compare(g, c, source), feedback[i])));
}

/** After this many misses a hint (the club) can be revealed. */
export const HINT_AFTER = 5;

const SQUARE: Record<Mark, string> = { hit: '🟩', near: '🟨', miss: '⬛' };

export function shareGrid(feedback: readonly Feedback[]): string {
  return feedback
    .map((f) => [f.club, f.pos, f.nat, f.age.mark, f.value.mark].map((m) => SQUARE[m]).join(''))
    .join('\n');
}
