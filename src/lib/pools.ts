/**
 * Which players a game may ask about. Price alone made "known" mean "expensive",
 * so unproven teenagers (€25m, 0 Premier League minutes) turned up as answers.
 * Familiarity is now Premier League minutes first.
 *
 * - easy: the stars, worth €30m+ with 2,500+ PL minutes (about 110 players);
 * - normal: 1,800+ PL minutes, or a big signing with a long record abroad
 *   (€50m+, 4,000+ minutes in another big league) (about 290);
 * - expert: the whole league.
 *
 * Daily rounds always use `normal`, so everyone gets the same puzzle.
 */
import { effect, signal } from '@preact/signals';
import type { Player } from '../data/types';
import { readJson, writeJson } from './storage';

export type PoolLevel = 'easy' | 'normal' | 'expert';
export const POOL_LEVELS: PoolLevel[] = ['easy', 'normal', 'expert'];

/** The level for unlimited and practice play, chosen in Settings. */
export const poolLevel = signal<PoolLevel>(
  (() => {
    const saved = readJson<PoolLevel>('poolLevel');
    return saved && POOL_LEVELS.includes(saved) ? saved : 'normal';
  })(),
);
effect(() => writeJson('poolLevel', poolLevel.value));

/** Daily rounds from this date on use the familiarity pools; earlier ones keep their old pool. */
export const POOL_V2_FROM = '2026-10-02';

export function plMinutes(p: Player): number {
  return p.stats.plMinutes + p.stats.minutes;
}

export function inPool(p: Player, level: PoolLevel): boolean {
  if (level === 'expert') return true;
  if (level === 'easy') return p.tm >= 30_000_000 && plMinutes(p) >= 2500;
  return plMinutes(p) >= 1800 || (p.tm >= 50_000_000 && p.stats.otherMinutes >= 4000);
}

export function poolOf(players: readonly Player[], level: PoolLevel): Player[] {
  return players.filter((p) => inPool(p, level));
}

/** The pool for a daily round on `day`: `normal` from POOL_V2_FROM, the old "known" list before. */
export function dailyPoolFor(players: readonly Player[], day: string, legacy: (p: Player) => boolean): Player[] {
  return day >= POOL_V2_FROM ? poolOf(players, 'normal') : players.filter(legacy);
}
