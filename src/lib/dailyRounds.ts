/**
 * The daily rounds, frozen in public/data/daily.json.
 *
 * A round computed in the browser from the current data changes whenever the
 * data does, and the data is now published every morning: a daily round
 * could change in the middle of its day (Guess the Player even dropped the
 * progress of anyone who had started, because the answer no longer matched).
 * So pipeline/daily.ts writes each day's rounds once, a couple of days ahead,
 * with the values they were asked with, and never changes a day it has
 * written. The browser plays the scheduled round, and computes one itself
 * only for a day the schedule does not have.
 */
import type { History } from '../data/history';
import type { Player } from '../data/types';
import { drawRound } from '../games/beat-model/logic';
import { dailyPool, dailyTarget } from '../games/guess/logic';
import { legacyPool, ROUNDS as PRICE_ROUNDS } from '../games/price-tag/logic';
import { dailyRand } from './daily';
import { inPool, dailyPoolFor } from './pools';
import { quizPairs, weeklyMoves, type Move } from './market';
import { shuffled } from './rng';

/** A player as he was when the round was written. */
export interface Frozen {
  name: string;
  tm: number;
  model: number;
  low: number;
  high: number;
}

/** One "who gained more?" pair: names, values a week ago and now. */
export interface FrozenPair {
  a: Frozen & { from: number };
  b: Frozen & { from: number };
}

export interface DayRounds {
  guess: string;
  beat: Frozen[];
  price: Frozen[];
  /** Missing while there is only one week of history. */
  market?: FrozenPair[];
}

/** Date (YYYY-MM-DD) → that day's rounds. */
export type Schedule = Record<string, DayRounds>;

const freeze = (p: Player): Frozen => ({ name: p.name, tm: p.tm, model: p.model, low: p.low, high: p.high });

/** Players as frozen in the schedule; null if any of them has left the data (then the browser computes the round). */
export function thaw(players: readonly Player[], frozen: readonly Frozen[]): Player[] | null {
  const byName = new Map(players.map((p) => [p.name, p]));
  const out: Player[] = [];
  for (const f of frozen) {
    const p = byName.get(f.name);
    if (!p) return null;
    out.push({ ...p, tm: f.tm, model: f.model, low: f.low, high: f.high });
  }
  return out;
}

// What the browser computed before the schedule existed, and computes for a day the schedule lacks.

export function computeBeat(players: readonly Player[], day: string): Player[] {
  return drawRound(dailyPoolFor(players, day, () => true), dailyRand('beat', day));
}

export function computePrice(players: readonly Player[], day: string): Player[] {
  return shuffled(dailyPoolFor(players, day, legacyPool), dailyRand('price', day)).slice(0, PRICE_ROUNDS);
}

/** Quiz moves come from players a fan knows: the daily pool. */
export function quizMoves(h: History, players: readonly Player[]): Move[] {
  return (weeklyMoves(h, players, 'model')?.all ?? []).filter((m) => inPool(m.player, 'normal'));
}

export function computeMarket(h: History, players: readonly Player[], day: string): [Move, Move][] {
  return quizPairs(quizMoves(h, players), dailyRand('market', day));
}

// What the games call.

export function guessTarget(players: readonly Player[], schedule: Schedule, day: string): Player {
  const name = schedule[day]?.guess;
  return (name && players.find((p) => p.name === name)) || dailyTarget(players, day);
}

export function beatRound(players: readonly Player[], schedule: Schedule, day: string): Player[] {
  const frozen = schedule[day]?.beat;
  return (frozen && thaw(players, frozen)) || computeBeat(players, day);
}

export function priceRound(players: readonly Player[], schedule: Schedule, day: string): Player[] {
  const frozen = schedule[day]?.price;
  return (frozen && thaw(players, frozen)) || computePrice(players, day);
}

/** The quiz pairs as moves; null when neither the schedule nor the history can make one. */
export function marketRound(
  players: readonly Player[],
  schedule: Schedule,
  h: History | null,
  day: string,
): [Move, Move][] | null {
  const frozen = schedule[day]?.market;
  if (frozen) {
    const pairs: [Move, Move][] = [];
    for (const { a, b } of frozen) {
      const [pa, pb] = thaw(players, [a, b]) ?? [];
      if (!pa || !pb) break;
      pairs.push([
        { player: pa, from: a.from, to: a.model, change: a.model / a.from - 1 },
        { player: pb, from: b.from, to: b.model, change: b.model / b.from - 1 },
      ]);
    }
    if (pairs.length === frozen.length) return pairs;
  }
  if (!h) return null;
  const pairs = computeMarket(h, players, day);
  return pairs.length ? pairs : null;
}

// Writing a day (pipeline/daily.ts).

/**
 * A day's rounds from today's data. The guess answer avoids everyone already
 * scheduled in `recent` (names), so nobody comes back until the pool is used up.
 */
export function writeDay(players: readonly Player[], h: History | null, day: string, recent: ReadonlySet<string>): DayRounds {
  let guess = dailyTarget(players, day).name;
  if (recent.has(guess)) {
    const fresh = dailyPool(players, day).filter((p) => !recent.has(p.name));
    if (fresh.length) guess = fresh[Math.floor(dailyRand('guess-fresh', day)() * fresh.length)].name;
  }
  const out: DayRounds = {
    guess,
    beat: computeBeat(players, day).map(freeze),
    price: computePrice(players, day).map(freeze),
  };
  const market = h ? computeMarket(h, players, day) : [];
  if (market.length) {
    out.market = market.map(([a, b]) => ({
      a: { ...freeze(a.player), model: a.to, from: a.from },
      b: { ...freeze(b.player), model: b.to, from: b.from },
    }));
  }
  return out;
}
