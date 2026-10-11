import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Meta, Player } from '../src/data/types';
import {
  afterWindow,
  buyers,
  buyPrice,
  canBuy,
  canSell,
  leagueAfter,
  MAX_IN,
  moneyLeft,
  outlook,
  seasonStart,
  sellPrice,
  squadOf,
  startingBudget,
  type Ctx,
  type Window,
} from '../src/games/transfer/logic';
import { USER_TEAM_ID } from '../src/lib/league';
import { setRatingPool } from '../src/lib/strength';

const players: Player[] = JSON.parse(readFileSync('public/data/players.json', 'utf8'));
const meta: Meta = JSON.parse(readFileSync('public/data/meta.json', 'utf8'));
setRatingPool(players);
const named = (n: string) => players.find((p) => p.name === n)!;
const ctx: Ctx = { source: 'tm', season: seasonStart(meta.dataDate) };

describe('Transfer Window', () => {
  const empty: Window = { club: 'EVE', sold: [], bought: [] };

  it('gives every club a budget of at least €15M in round €5M steps', () => {
    for (const club of Object.keys(meta.clubs)) {
      const b = startingBudget(players, club, 'tm');
      expect(b).toBeGreaterThanOrEqual(15_000_000);
      expect(b % 5_000_000).toBe(0);
    }
  });

  it('moves bought players and drops sold ones', () => {
    const star = named('Bukayo Saka');
    const own = players.find((p) => p.club === 'EVE')!;
    const w: Window = { club: 'EVE', sold: [own.name], bought: [star.name] };
    const after = afterWindow(players, w);
    expect(after.find((p) => p.name === star.name)!.club).toBe('EVE');
    expect(after.some((p) => p.name === own.name)).toBe(false);
    expect(squadOf(players, w).some((p) => p.name === star.name)).toBe(true);
    expect(moneyLeft(players, w, ctx)).toBe(startingBudget(players, 'EVE', 'tm') + sellPrice(own, ctx) - buyPrice(star, ctx));
  });

  it('buys above value, sells below it, and a running-down contract is cheaper', () => {
    expect(seasonStart('2026-10-10')).toBe(2026);
    expect(seasonStart('2027-03-01')).toBe(2026);
    const long = players.find((p) => p.contract && Number(p.contract) >= ctx.season + 3 && p.tm >= 10_000_000)!;
    const last = players.find((p) => p.contract && Number(p.contract) === ctx.season + 1 && p.tm >= 10_000_000)!;
    expect(buyPrice(long, ctx)).toBeGreaterThan(long.tm);
    expect(sellPrice(long, ctx)).toBeLessThan(long.tm);
    expect(buyPrice(last, ctx) / last.tm).toBeLessThan(buyPrice(long, ctx) / long.tm);
    expect(sellPrice(last, ctx) / last.tm).toBeLessThan(sellPrice(long, ctx) / long.tm);
  });

  it('sends a sold star to a rival, who gets stronger', () => {
    const w: Window = { club: 'ARS', sold: ['Bukayo Saka'], bought: [] };
    const to = buyers(players, meta, w, ctx).get('Bukayo Saka')!;
    expect(to).toBeDefined();
    expect(to).not.toBe('ARS');
    const rival = (l: ReturnType<typeof leagueAfter>) => l.find((t) => t.id === to)!.strength;
    expect(rival(leagueAfter(players, meta, ctx, w))).toBeGreaterThan(rival(leagueAfter(players, meta, ctx, { ...w, sold: [] })));
  });

  it('enforces the money and the number of deals', () => {
    const w: Window = { ...empty };
    const dear = players.filter((p) => p.club !== 'EVE').sort((a, b) => b.tm - a.tm)[0];
    expect(canBuy(players, w, dear, ctx)).toBe(false);
    const cheap = players.filter((p) => p.club !== 'EVE' && p.tm < 1_000_000).slice(0, MAX_IN + 1);
    const full: Window = { ...w, bought: cheap.slice(0, MAX_IN).map((p) => p.name) };
    expect(canBuy(players, full, cheap[MAX_IN], ctx)).toBe(false);
    const own = players.filter((p) => p.club === 'EVE');
    expect(canSell(players, w, own[0])).toBe(true);
    expect(canSell(players, w, dear)).toBe(false);
  });

  it('a star makes the outlook better, and the outlook is repeatable', () => {
    const before = outlook(leagueAfter(players, meta, ctx, empty), 60);
    const again = outlook(leagueAfter(players, meta, ctx, empty), 60);
    expect(again).toEqual(before);
    const w: Window = { club: 'EVE', sold: [], bought: ['Bukayo Saka', 'Declan Rice', 'Cole Palmer'] };
    const after = outlook(leagueAfter(players, meta, ctx, w), 60);
    expect(after.strength).toBeGreaterThan(before.strength);
    expect(after.points).toBeGreaterThan(before.points);
    expect(leagueAfter(players, meta, ctx, w).filter((t) => t.id === USER_TEAM_ID)).toHaveLength(1);
  });

  it('simulates an outlook quickly enough to follow every deal', () => {
    const league = leagueAfter(players, meta, ctx, empty);
    const t0 = performance.now();
    outlook(league);
    expect(performance.now() - t0).toBeLessThan(400);
  });
});
