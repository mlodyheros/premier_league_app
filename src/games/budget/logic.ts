/** Budget XI: rules for spending, eligibility and grading. */
import type { Player } from '../../data/types';
import { valueOf, type ValueSource } from '../../data/valueSource';
import { fit, slotRating, type Formation, type Lineup, type Slot } from '../../lib/strength';

export type ThemeKey = 'promoted' | 'midtable' | 'europe' | 'bigsix' | 'sheikh';

/** Budgets with a story: from a newly promoted side to a sheikh's takeover. */
export const THEMES: { key: ThemeKey; budget: number; icon: string }[] = [
  { key: 'promoted', budget: 80_000_000, icon: '🆙' },
  { key: 'midtable', budget: 200_000_000, icon: '⚖️' },
  { key: 'europe', budget: 400_000_000, icon: '🌍' },
  { key: 'bigsix', budget: 700_000_000, icon: '🏆' },
  { key: 'sheikh', budget: 1_500_000_000, icon: '🛢️' },
];
export const DEFAULT_THEME: ThemeKey = 'midtable';

export function themeFor(budget: number | undefined): (typeof THEMES)[number] {
  return THEMES.find((th) => th.budget === budget) ?? THEMES.find((th) => th.key === DEFAULT_THEME)!;
}

export function spent(lineup: Lineup, source: ValueSource): number {
  return Object.values(lineup).reduce((sum, p) => sum + (p ? valueOf(p, source) : 0), 0);
}

/** Can `player` go into `slot`, given what is already spent (the occupant's price is refunded)? */
export function affordable(
  player: Player,
  slot: Slot,
  lineup: Lineup,
  budget: number,
  source: ValueSource,
): boolean {
  const occupant = lineup[slot.id];
  const left = budget - spent(lineup, source) + (occupant ? valueOf(occupant, source) : 0);
  return valueOf(player, source) <= left;
}

export type SortKey = 'rating' | 'cheap' | 'dear' | 'bargain';

export interface Option {
  player: Player;
  rating: number;
  fit: number;
  price: number;
  affordable: boolean;
}

/** Players who can fill a slot, not already in the XI, best first by `sort`. */
export function options(
  players: readonly Player[],
  slot: Slot,
  lineup: Lineup,
  budget: number,
  source: ValueSource,
  sort: SortKey,
): Option[] {
  const inXI = new Set(Object.values(lineup).map((p) => p?.id));
  const out: Option[] = [];
  for (const p of players) {
    const f = fit(p, slot.type);
    if (!f || (inXI.has(p.id) && lineup[slot.id]?.id !== p.id)) continue;
    out.push({
      player: p,
      rating: slotRating(p, slot, source),
      fit: f,
      price: valueOf(p, source),
      affordable: affordable(p, slot, lineup, budget, source),
    });
  }
  const by: Record<SortKey, (a: Option, b: Option) => number> = {
    rating: (a, b) => b.rating - a.rating || a.price - b.price,
    cheap: (a, b) => a.price - b.price || b.rating - a.rating,
    dear: (a, b) => b.price - a.price,
    // Rating points above a 40 baseline per €10m: who gives most for the money.
    bargain: (a, b) => (b.rating - 40) / (b.price + 1e6) - (a.rating - 40) / (a.price + 1e6),
  };
  // Affordable players first, so a tight budget never hides them past the list's end.
  return out.sort((a, b) => Number(b.affordable) - Number(a.affordable) || by[sort](a, b));
}

export function isComplete(formation: Formation, lineup: Lineup): boolean {
  return formation.slots.every((s) => lineup[s.id]);
}

/** Grades against the real squads: A+ beats the best of them (~84.5). */
export function grade(strength: number): string {
  if (strength >= 85) return 'A+';
  if (strength >= 83) return 'A';
  if (strength >= 80.5) return 'B';
  if (strength >= 78) return 'C';
  if (strength >= 75) return 'D';
  return 'E';
}
