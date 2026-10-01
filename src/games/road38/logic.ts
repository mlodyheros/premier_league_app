/** Road to 38-0: the draft rules and the season verdict. No UI here. */
import type { Player } from '../../data/types';
import type { ValueSource } from '../../data/valueSource';
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


/** Each extra player from the same club adds this much to the XI's rating. */
export const CHEMISTRY_STEP = 0.3;
export const CHEMISTRY_MAX = 1.5;

/**
 * Team-mates know each other: for every club with n players in the XI, add
 * (n − 1) × CHEMISTRY_STEP, up to CHEMISTRY_MAX in all. It gives a reason to
 * take a weaker player from a club already in the side.
 */
export function chemistry(lineup: Lineup): { bonus: number; links: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const p of Object.values(lineup)) if (p) counts[p.club] = (counts[p.club] ?? 0) + 1;
  const links = Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 1));
  const raw = Object.values(links).reduce((sum, n) => sum + (n - 1) * CHEMISTRY_STEP, 0);
  return { bonus: Math.round(Math.min(CHEMISTRY_MAX, raw) * 10) / 10, links };
}

/**
 * How much the draft tells you, from easiest to hardest:
 * - standard: spin a club, take any of its players for any open position;
 * - position: the spin also draws the position you must fill;
 * - blind: drawn position, and no ratings or prices: names only.
 */
export type DraftMode = 'standard' | 'position' | 'blind';
export const DRAFT_MODES: DraftMode[] = ['standard', 'position', 'blind'];

export function drawsPosition(mode: DraftMode): boolean {
  return mode !== 'standard';
}

export function hidesRatings(mode: DraftMode): boolean {
  return mode === 'blind';
}

export interface Spin {
  club: string | null;
  /** The open slot to fill, in the modes that draw one. */
  slot: string | null;
}

/**
 * Clubs a spin can land on: those with an available player for `slot` when a
 * position is already drawn, otherwise for any open position. `avoid` (the
 * club being re-drawn) is left out.
 */
export function clubOptions(
  players: readonly Player[],
  clubs: readonly string[],
  formation: Formation,
  lineup: Lineup,
  slot: string | null,
  avoid?: string | null,
): string[] {
  return clubs.filter((club) => {
    if (club === avoid) return false;
    const fillable = fillableSlots(players, club, formation, lineup);
    return slot ? fillable.has(slot) : fillable.size > 0;
  });
}

/**
 * Positions a spin can land on: the open ones `club` can fill when a club is
 * already drawn, otherwise any open position some club can fill.
 */
export function slotOptions(
  players: readonly Player[],
  clubs: readonly string[],
  formation: Formation,
  lineup: Lineup,
  club: string | null,
  avoid?: string | null,
): string[] {
  const fillable = new Set<string>();
  for (const c of club ? [club] : clubs) for (const s of fillableSlots(players, c, formation, lineup)) fillable.add(s);
  return openSlots(formation, lineup)
    .map((s) => s.id)
    .filter((id) => id !== avoid && fillable.has(id));
}

/**
 * A full draw in one go (both reels), for tests and quick play: club first,
 * then, in the position modes, a position that club can fill.
 */
export function drawSpin(
  players: readonly Player[],
  clubs: readonly string[],
  formation: Formation,
  lineup: Lineup,
  mode: DraftMode,
  rand: () => number,
  avoid?: Spin | null,
): Spin | null {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const clubPool = clubOptions(players, clubs, formation, lineup, null, avoid?.club);
  if (!clubPool.length) return null;
  const club = pick(clubPool);
  if (!drawsPosition(mode)) return { club, slot: null };
  const slots = slotOptions(players, clubs, formation, lineup, club);
  return { club, slot: pick(slots) };
}

/** In blind mode the list must not give the ratings away, so it is alphabetical. */
export function byName(list: Candidate[]): Candidate[] {
  return list.slice().sort((a, b) => a.player.name.localeCompare(b.player.name));
}
