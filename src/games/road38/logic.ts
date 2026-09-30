/** Road to 38-0: the draft rules and the season verdict. No UI here. */
import type { Player } from '../../data/types';
import type { ValueSource } from '../../data/valueSource';
import type { Key } from '../../i18n';
import type { MatchResult, TableRow } from '../../lib/season';
import { fit, slotRating, type Formation, type Lineup, type Slot } from '../../lib/strength';

export const RESPINS = 3;

export function openSlots(formation: Formation, lineup: Lineup): Slot[] {
  return formation.slots.filter((s) => !lineup[s.id]);
}

export function draftedIds(lineup: Lineup): Set<number> {
  return new Set(Object.values(lineup).flatMap((p) => (p ? [p.id] : [])));
}

export interface Candidate {
  player: Player;
  slot: Slot;
  rating: number;
}

/**
 * A club's players who can fill an open slot, each placed in his best open
 * slot (or in `only`, when the user has picked a slot), best first.
 */
export function candidates(
  players: readonly Player[],
  club: string,
  formation: Formation,
  lineup: Lineup,
  source: ValueSource,
  only?: Slot | null,
): Candidate[] {
  const taken = draftedIds(lineup);
  const slots = only ? [only] : openSlots(formation, lineup);
  const out: Candidate[] = [];
  for (const p of players) {
    if (p.club !== club || taken.has(p.id)) continue;
    let best: Candidate | null = null;
    for (const s of slots) {
      if (!fit(p, s.type)) continue;
      const r = slotRating(p, s, source);
      if (!best || r > best.rating) best = { player: p, slot: s, rating: r };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.rating - a.rating);
}

/** Clubs that can still fill at least one open slot. */
export function spinnableClubs(
  players: readonly Player[],
  clubs: readonly string[],
  formation: Formation,
  lineup: Lineup,
  source: ValueSource,
): string[] {
  return clubs.filter((c) => candidates(players, c, formation, lineup, source).length > 0);
}

/** Open slots a club's available players could fill. */
export function fillableSlots(
  players: readonly Player[],
  club: string,
  formation: Formation,
  lineup: Lineup,
): Set<string> {
  const taken = draftedIds(lineup);
  const squad = players.filter((p) => p.club === club && !taken.has(p.id));
  return new Set(openSlots(formation, lineup).filter((s) => squad.some((p) => fit(p, s.type))).map((s) => s.id));
}

export interface Record38 {
  won: number;
  drawn: number;
  lost: number;
  points: number;
}

export function badges(row: Record38, position: number): { icon: string; label: Key }[] {
  const out: { icon: string; label: Key }[] = [];
  if (row.won === 38) out.push({ icon: '⭐', label: 'road.badge.perfect' });
  if (position === 1) out.push({ icon: '🏆', label: 'road.badge.champions' });
  if (row.lost === 0 && row.won < 38) out.push({ icon: '🛡️', label: 'road.badge.invincible' });
  if (row.points >= 100) out.push({ icon: '💯', label: 'road.badge.centurion' });
  return out;
}

export function resultsGrid(results: readonly MatchResult[]): string {
  const sq = results.map((r) => (r.outcome === 'W' ? '🟩' : r.outcome === 'D' ? '🟨' : '🟥'));
  return [sq.slice(0, 19).join(''), sq.slice(19).join('')].filter(Boolean).join('\n');
}

export function userRow(table: readonly TableRow[], id: string): TableRow {
  return table.find((r) => r.id === id)!;
}
