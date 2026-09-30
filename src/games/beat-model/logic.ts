/** Beat the Model: does the model rate a player over or under Transfermarkt? */
import type { Player } from '../../data/types';
import { modelGap } from '../../data/valueSource';
import { formatEur } from '../../lib/format';

export const ROUNDS = 10;
/**
 * Below €5m the model asks a median 1.7x the market (it pulls extremes toward
 * the middle), so "over" would almost always win. Those players are left out.
 */
export const MIN_VALUE = 5_000_000;
/** Gaps smaller than this are too close to call either way. */
export const MIN_GAP = 0.08;

export type Side = 'over' | 'under';

export function sideOf(p: Player): Side {
  return modelGap(p) > 0 ? 'over' : 'under';
}

export function pool(players: readonly Player[]): Player[] {
  return players.filter((p) => p.tm >= MIN_VALUE && Math.abs(modelGap(p)) >= MIN_GAP);
}

/**
 * A round's questions. Each one first picks a side at random, then a player
 * from that side, so "always over" or "always under" scores about half.
 */
export function drawRound(players: readonly Player[], rand: () => number = Math.random): Player[] {
  const all = pool(players);
  const bySide: Record<Side, Player[]> = {
    over: all.filter((p) => sideOf(p) === 'over'),
    under: all.filter((p) => sideOf(p) === 'under'),
  };
  const used = new Set<number>();
  const out: Player[] = [];
  while (out.length < ROUNDS) {
    const side: Side = rand() < 0.5 ? 'over' : 'under';
    const left = bySide[side].filter((p) => !used.has(p.id));
    if (!left.length) continue;
    const p = left[Math.floor(rand() * left.length)];
    used.add(p.id);
    out.push(p);
  }
  return out;
}

/**
 * Plain-language notes on what the model had to go on. They describe inputs
 * the model uses (age curve, minutes, last fee, Champions League games,
 * evidence tier); they do not claim to decompose the estimate exactly.
 */
export function modelNotes(p: Player, gameweek: number): string[] {
  const notes: string[] = [];
  const s = p.stats;
  const available = gameweek * 90;
  if (p.tier === 2) notes.push('No record in any league the model covers, so it leans on age, position, club and fee.');
  else if (p.tier === 1) notes.push('No Premier League record yet: the model reads his record in other big leagues.');
  if (p.fee && p.fee >= p.tm * 1.3) notes.push(`A club paid ${formatEur(p.fee)} for him, and the model weighs the last fee.`);
  if (available > 0 && s.minutes === 0) notes.push('No minutes yet this season.');
  else if (available > 0 && s.minutes < available * 0.3) notes.push(`Only ${s.minutes} minutes so far this season.`);
  else if (available > 0 && s.minutes >= available * 0.85) notes.push('An ever-present this season.');
  if (p.age >= 30) notes.push(`At ${p.age}, the model's age curve is bending down.`);
  else if (p.age <= 21) notes.push(`At ${p.age}, the market may be paying for potential the numbers can't show yet.`);
  if (s.clMinutes >= 450) notes.push(`${s.clMinutes} Champions League minutes last season, which the model counts.`);
  return notes.slice(0, 3);
}
