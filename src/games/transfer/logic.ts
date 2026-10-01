/** Transfer Window: the rules for selling and buying, and the season outlook. No UI here. */
import type { Meta, Player } from '../../data/types';
import { valueOf, type ValueSource } from '../../data/valueSource';
import { clubTeams, USER_TEAM_ID } from '../../lib/league';
import { mulberry32 } from '../../lib/rng';
import { REALISTIC, SEASON_FORM_SD, simulateSeason, type Team } from '../../lib/season';
import { rating } from '../../lib/strength';

export const MAX_OUT = 3;
export const MAX_IN = 3;
/** A squad needs depth: a club's strength is the mean of its best 16. */
export const MIN_SQUAD = 18;
/** The board's budget: this share of the squad's value, rounded to €5M, at least MIN_BUDGET. */
export const BUDGET_SHARE = 0.12;
export const MIN_BUDGET = 15_000_000;
/** Seasons simulated for each outlook. The same seeds before and after, so the gap is the transfers'. */
export const OUTLOOK_SEASONS = 200;
const OUTLOOK_SEED = 20_260_901;

export interface Window {
  club: string;
  /** Names, not ids: names survive data updates. */
  sold: string[];
  bought: string[];
}

export function startingBudget(players: readonly Player[], club: string, source: ValueSource): number {
  const squadValue = players.filter((p) => p.club === club).reduce((sum, p) => sum + valueOf(p, source), 0);
  return Math.max(MIN_BUDGET, Math.round((squadValue * BUDGET_SHARE) / 5_000_000) * 5_000_000);
}

/** The league after the window: sold players gone, bought ones moved to your club. */
export function afterWindow(players: readonly Player[], w: Window): Player[] {
  const sold = new Set(w.sold);
  const bought = new Set(w.bought);
  return players.filter((p) => !sold.has(p.name)).map((p) => (bought.has(p.name) ? { ...p, club: w.club } : p));
}

export function squadOf(players: readonly Player[], w: Window): Player[] {
  return afterWindow(players, w)
    .filter((p) => p.club === w.club)
    .sort((a, b) => b.tm - a.tm);
}

export function moneyLeft(players: readonly Player[], w: Window, source: ValueSource): number {
  const byName = new Map(players.map((p) => [p.name, p]));
  const value = (names: string[]) => names.reduce((sum, n) => sum + (byName.get(n) ? valueOf(byName.get(n)!, source) : 0), 0);
  return startingBudget(players, w.club, source) + value(w.sold) - value(w.bought);
}

export function canSell(players: readonly Player[], w: Window, p: Player): boolean {
  return p.club === w.club && !w.sold.includes(p.name) && w.sold.length < MAX_OUT && squadOf(players, w).length > MIN_SQUAD;
}

export function canBuy(players: readonly Player[], w: Window, p: Player, source: ValueSource): boolean {
  return (
    p.club !== w.club &&
    !w.bought.includes(p.name) &&
    w.bought.length < MAX_IN &&
    valueOf(p, source) <= moneyLeft(players, w, source)
  );
}

/** The 20 teams after the window, your club under USER_TEAM_ID. */
export function leagueAfter(players: readonly Player[], meta: Meta, source: ValueSource, w: Window): Team[] {
  return clubTeams(afterWindow(players, w), meta, source).map((t) =>
    t.id === w.club ? { ...t, id: USER_TEAM_ID } : t,
  );
}

export interface Outlook {
  points: number;
  position: number;
  /** Chance of a top-four finish and of the bottom three. */
  top4: number;
  relegation: number;
  strength: number;
}

/** Averages over OUTLOOK_SEASONS simulated seasons, always with the same seeds. */
export function outlook(league: readonly Team[], seasons = OUTLOOK_SEASONS): Outlook {
  const rand = mulberry32(OUTLOOK_SEED);
  let points = 0;
  let position = 0;
  let top4 = 0;
  let relegation = 0;
  for (let i = 0; i < seasons; i++) {
    const s = simulateSeason([...league], USER_TEAM_ID, rand, REALISTIC, SEASON_FORM_SD);
    points += s.table[s.position - 1].points;
    position += s.position;
    if (s.position <= 4) top4++;
    if (s.position > league.length - 3) relegation++;
  }
  return {
    points: points / seasons,
    position: position / seasons,
    top4: top4 / seasons,
    relegation: relegation / seasons,
    strength: league.find((t) => t.id === USER_TEAM_ID)!.strength,
  };
}

/** Players you could buy: from other clubs, best rated first, those you can afford before the rest. */
export function market(players: readonly Player[], w: Window, source: ValueSource): Player[] {
  const left = moneyLeft(players, w, source);
  return players
    .filter((p) => p.club !== w.club && !w.bought.includes(p.name))
    .sort(
      (a, b) =>
        Number(valueOf(b, source) <= left) - Number(valueOf(a, source) <= left) || rating(b, source) - rating(a, source),
    );
}
