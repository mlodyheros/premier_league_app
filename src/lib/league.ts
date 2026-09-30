/** The real league as simulation teams, and your XI dropped into it. */
import type { Meta, Player } from '../data/types';
import type { ValueSource } from '../data/valueSource';
import type { Team } from './season';
import { clubStrength } from './strength';

export const USER_TEAM_ID = 'YOU';

/** All 20 clubs, rated on their squads minus any players drafted away. */
export function clubTeams(
  players: readonly Player[],
  meta: Meta,
  source: ValueSource,
  without: ReadonlySet<number> = new Set(),
): Team[] {
  return Object.entries(meta.clubs).map(([code, club]) => ({
    id: code,
    name: club.short,
    strength: clubStrength(players, code, source, without),
  }));
}

/** Your XI takes the weakest club's place, keeping the league at 20. */
export function withUserTeam(clubs: readonly Team[], strength: number, name = 'Your XI') {
  const replaced = clubs.reduce((w, t) => (t.strength < w.strength ? t : w));
  const user: Team = { id: USER_TEAM_ID, name, strength };
  return { league: [user, ...clubs.filter((t) => t !== replaced)], replaced, user };
}

/** How many real clubs a strength beats. */
export function clubsBeaten(clubs: readonly Team[], strength: number): number {
  return clubs.filter((t) => t.strength < strength).length;
}

/** "1 in 12,400" style odds; "never" when too small to show. */
export function formatOdds(p: number): string {
  if (p <= 0 || !Number.isFinite(1 / p)) return 'practically never';
  if (p >= 0.5) return `${Math.round(p * 100)}%`;
  const n = 1 / p;
  if (n > 1e12) return 'less than 1 in a trillion';
  const rounded = n < 100 ? Math.round(n) : Number(n.toPrecision(3));
  return `1 in ${rounded.toLocaleString('en')}`;
}
