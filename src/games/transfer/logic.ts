/** Transfer Window: the rules for selling and buying, and the season outlook. No UI here. */
import type { Meta, Player } from '../../data/types';
import { valueOf, type ValueSource } from '../../data/valueSource';
import { clubTeams, USER_TEAM_ID } from '../../lib/league';
import { mulberry32 } from '../../lib/rng';
import { REALISTIC, SEASON_FORM_SD, simulateSeason, type Team } from '../../lib/season';
import { clubStrength, rating } from '../../lib/strength';

export const MAX_OUT = 3;
export const MAX_IN = 3;
/** A squad needs depth: a club's strength is the mean of its best 16. */
export const MIN_SQUAD = 18;
/** The board's budget: this share of the squad's value, rounded to €5M, at least MIN_BUDGET. */
export const BUDGET_SHARE = 0.15;
/** A club sells only above his value, and buys only below it: buying and selling back loses money. */
export const BUY_PREMIUM = 1.2;
export const SELL_SHARE = 0.9;
/** A player in the last year of his contract can leave for nothing next summer, so he goes cheaper. */
export const LAST_YEAR_FACTOR = 0.7;
export const TWO_YEARS_FACTOR = 0.9;
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

/** The deals are priced at a date: contracts run down. */
export interface Ctx {
  source: ValueSource;
  /** The year the current season started (2026 for 2026-27). */
  season: number;
}

export function seasonStart(dataDate: string): number {
  const [y, m] = dataDate.split('-').map(Number);
  return m >= 7 ? y : y - 1;
}

/** Seasons left on his contract, this one included; null if unknown. */
export function yearsLeft(p: Player, season: number): number | null {
  return p.contract ? Number(p.contract) - season : null;
}

function contractFactor(p: Player, season: number): number {
  const left = yearsLeft(p, season);
  if (left === null) return 1;
  return left <= 1 ? LAST_YEAR_FACTOR : left === 2 ? TWO_YEARS_FACTOR : 1;
}

const toTenth = (eur: number) => Math.round(eur / 100_000) * 100_000;

/** What you pay for him. */
export function buyPrice(p: Player, { source, season }: Ctx): number {
  return toTenth(valueOf(p, source) * BUY_PREMIUM * contractFactor(p, season));
}

/** What you get for him. */
export function sellPrice(p: Player, { source, season }: Ctx): number {
  return toTenth(valueOf(p, source) * SELL_SHARE * contractFactor(p, season));
}

export function startingBudget(players: readonly Player[], club: string, source: ValueSource): number {
  const squadValue = players.filter((p) => p.club === club).reduce((sum, p) => sum + valueOf(p, source), 0);
  return Math.max(MIN_BUDGET, Math.round((squadValue * BUDGET_SHARE) / 5_000_000) * 5_000_000);
}

/** The league after the window: bought players moved to your club, sold ones to `buyers` (or gone). */
export function afterWindow(players: readonly Player[], w: Window, buyers: ReadonlyMap<string, string> = new Map()): Player[] {
  const sold = new Set(w.sold);
  const bought = new Set(w.bought);
  return players
    .filter((p) => !sold.has(p.name) || buyers.has(p.name))
    .map((p) => (bought.has(p.name) ? { ...p, club: w.club } : sold.has(p.name) ? { ...p, club: buyers.get(p.name)! } : p));
}

/**
 * Where your sold players go: each to the strongest club that can pay his fee
 * and that he makes better (the club he helps most if none can). So a star
 * you sell strengthens a rival at the top, as in a real window.
 */
export function buyers(players: readonly Player[], meta: Meta, w: Window, ctx: Ctx): Map<string, string> {
  const out = new Map<string, string>();
  const byName = new Map(players.map((p) => [p.name, p]));
  let league = afterWindow(players, { ...w, sold: [] });
  const clubs = Object.keys(meta.clubs).filter((c) => c !== w.club);
  const budget = new Map(clubs.map((c) => [c, startingBudget(players, c, ctx.source)]));
  for (const name of w.sold) {
    const p = byName.get(name);
    if (!p) continue;
    const fee = sellPrice(p, ctx);
    const others = league.filter((q) => q.name !== name);
    const now = new Map(clubs.map((c) => [c, clubStrength(league, c, ctx.source)]));
    const gain = (c: string) => clubStrength([...others, { ...p, club: c }], c, ctx.source) - now.get(c)!;
    const able = clubs.filter((c) => budget.get(c)! >= fee && gain(c) > 0);
    const to = able.length
      ? able.reduce((a, b) => (now.get(b)! > now.get(a)! ? b : a))
      : clubs.reduce((a, b) => (gain(b) > gain(a) ? b : a));
    out.set(name, to);
    budget.set(to, budget.get(to)! - fee);
    league = league.map((q) => (q.name === name ? { ...q, club: to } : q));
  }
  return out;
}

export function squadOf(players: readonly Player[], w: Window): Player[] {
  return afterWindow(players, w)
    .filter((p) => p.club === w.club)
    .sort((a, b) => b.tm - a.tm);
}

export function moneyLeft(players: readonly Player[], w: Window, ctx: Ctx): number {
  const byName = new Map(players.map((p) => [p.name, p]));
  const total = (names: string[], price: (p: Player, ctx: Ctx) => number) =>
    names.reduce((sum, n) => sum + (byName.get(n) ? price(byName.get(n)!, ctx) : 0), 0);
  return startingBudget(players, w.club, ctx.source) + total(w.sold, sellPrice) - total(w.bought, buyPrice);
}

export function canSell(players: readonly Player[], w: Window, p: Player): boolean {
  return p.club === w.club && !w.sold.includes(p.name) && w.sold.length < MAX_OUT && squadOf(players, w).length > MIN_SQUAD;
}

export function canBuy(players: readonly Player[], w: Window, p: Player, ctx: Ctx): boolean {
  return (
    p.club !== w.club &&
    !w.bought.includes(p.name) &&
    w.bought.length < MAX_IN &&
    buyPrice(p, ctx) <= moneyLeft(players, w, ctx)
  );
}

/** The 20 teams after the window, your club under USER_TEAM_ID; your sold players play for their buyers. */
export function leagueAfter(players: readonly Player[], meta: Meta, ctx: Ctx, w: Window): Team[] {
  return clubTeams(afterWindow(players, w, buyers(players, meta, w, ctx)), meta, ctx.source).map((t) =>
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
export function market(players: readonly Player[], w: Window, ctx: Ctx): Player[] {
  const left = moneyLeft(players, w, ctx);
  const affordable = (p: Player) => Number(buyPrice(p, ctx) <= left);
  return players
    .filter((p) => p.club !== w.club && !w.bought.includes(p.name))
    .sort((a, b) => affordable(b) - affordable(a) || rating(b, ctx.source) - rating(a, ctx.source));
}
