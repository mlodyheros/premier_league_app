/** Beat the Model: does the model rate a player over or under Transfermarkt? */
import type { Player } from '../../data/types';
import { modelGap } from '../../data/valueSource';
import type { Key } from '../../i18n';
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

export interface Note {
  key: Key;
  params?: Record<string, string | number>;
}

/**
 * Plain-language notes on what the model had to go on, as translation keys.
 * They describe inputs the model uses (age curve, minutes, last fee, Champions
 * League games, evidence tier); they do not claim to decompose the estimate.
 */
export function modelNotes(p: Player, gameweek: number): Note[] {
  const notes: Note[] = [];
  const s = p.stats;
  const available = gameweek * 90;
  if (p.tier === 2) notes.push({ key: 'note.tier2' });
  else if (p.tier === 1) notes.push({ key: 'note.tier1' });
  if (p.fee && p.fee >= p.tm * 1.3) notes.push({ key: 'note.fee', params: { fee: formatEur(p.fee) } });
  if (available > 0 && s.minutes === 0) notes.push({ key: 'note.noMinutes' });
  else if (available > 0 && s.minutes < available * 0.3) notes.push({ key: 'note.fewMinutes', params: { count: s.minutes } });
  else if (available > 0 && s.minutes >= available * 0.85) notes.push({ key: 'note.everPresent' });
  if (p.age >= 30) notes.push({ key: 'note.older', params: { age: p.age } });
  else if (p.age <= 21) notes.push({ key: 'note.young', params: { age: p.age } });
  if (s.clMinutes >= 450) notes.push({ key: 'note.cl', params: { count: s.clMinutes } });
  return notes.slice(0, 3);
}
