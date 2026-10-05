/** Budget XI: rules for spending, eligibility and grading. */
import type { Player } from '../../data/types';
import type { IconName } from '../../components/Icon';
import { valueOf, type ValueSource } from '../../data/valueSource';
import { fit, slotRating, type Formation, type Lineup, type Slot } from '../../lib/strength';

export type ThemeKey = 'promoted' | 'midtable' | 'europe' | 'bigsix' | 'sheikh';

/** Budgets with a story: from a newly promoted side to a sheikh's takeover. */
export const THEMES: { key: ThemeKey; budget: number; icon: string; glyph: IconName }[] = [
  { key: 'promoted', budget: 80_000_000, icon: '🆙', glyph: 'arrow-big-up-lines' },
  { key: 'midtable', budget: 200_000_000, icon: '⚖️', glyph: 'scale' },
  { key: 'europe', budget: 400_000_000, icon: '🌍', glyph: 'stars' },
  { key: 'bigsix', budget: 700_000_000, icon: '🏆', glyph: 'crown' },
  { key: 'sheikh', budget: 1_500_000_000, icon: '🛢️', glyph: 'diamond' },
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

/**
 * Grades against the real squads' best XIs (on FC 27-based ratings): A+ beats
 * the best of them (Arsenal, City ~85.8), A is a title contender's, B a top-six
 * side's, C mid-table, D the bottom half.
 */
export function grade(strength: number): string {
  if (strength >= 86.5) return 'A+';
  if (strength >= 84.5) return 'A';
  if (strength >= 82) return 'B';
  if (strength >= 79.5) return 'C';
  if (strength >= 76.5) return 'D';
  return 'E';
}

/**
 * Fill the empty slots as well as the money left allows. Each slot first gets
 * a fair share of what is left (keeping enough back for the cheapest player
 * in every other empty slot), then a second pass spends any change on upgrades.
 */
export function autoFill(
  players: readonly Player[],
  formation: Formation,
  lineup: Lineup,
  budget: number,
  source: ValueSource,
): Lineup {
  const out: Lineup = { ...lineup };
  const empty = formation.slots.filter((s) => !out[s.id]);
  const taken = () => new Set(Object.values(out).map((p) => p?.id));
  const eligible = (slot: Slot) =>
    players.filter((p) => fit(p, slot.type) && !taken().has(p.id)).map((p) => ({ p, r: slotRating(p, slot, source), v: valueOf(p, source) }));
  const cheapest = (slot: Slot) => Math.min(...eligible(slot).map((o) => o.v));
  const left = () => budget - spent(out, source);

  empty.forEach((slot, i) => {
    const rest = empty.slice(i + 1).filter((s) => !out[s.id]);
    const reserve = rest.reduce((sum, s) => sum + cheapest(s), 0);
    const share = (left() - reserve) / (rest.length + 1);
    const cap = Math.min(left() - reserve, share * 1.6);
    const options = eligible(slot).filter((o) => o.v <= cap);
    const pool = options.length ? options : eligible(slot).filter((o) => o.v <= left());
    const best = pool.sort((a, b) => b.r - a.r || a.v - b.v)[0];
    if (best) out[slot.id] = best.p;
  });

  // Upgrades with the change, biggest rating gain first.
  for (const slot of empty) {
    const current = out[slot.id];
    if (!current) continue;
    const room = left() + valueOf(current, source);
    const now = slotRating(current, slot, source);
    const better = eligible(slot)
      .filter((o) => o.v <= room && o.r > now)
      .sort((a, b) => b.r - a.r)[0];
    if (better) out[slot.id] = better.p;
  }
  return out;
}

/** Tight budgets are about value for money; big ones about the best player. */
export function defaultSort(budget: number): SortKey {
  return budget <= 200_000_000 ? 'bargain' : 'rating';
}
