import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Player } from '../src/data/types';
import { autoFill, defaultSort, isComplete, spent } from '../src/games/budget/logic';
import { pool as hlPool } from '../src/games/higher-lower/logic';
import { stepPrice, sliderToEur, eurToSlider } from '../src/games/price-tag/logic';
import { chemistry, CHEMISTRY_MAX } from '../src/games/road38/logic';
import { formatEur } from '../src/lib/format';
import { dailyPoolFor, inPool, poolOf, POOL_V2_FROM } from '../src/lib/pools';
import { formationByKey, setRatingPool, teamStrength } from '../src/lib/strength';

const players: Player[] = JSON.parse(readFileSync('public/data/players.json', 'utf8'));
setRatingPool(players);
const byName = (name: string) => players.find((p) => p.name === name)!;

describe('familiarity pools', () => {
  it('nest: easy ⊂ normal ⊂ expert', () => {
    const easy = poolOf(players, 'easy');
    const normal = new Set(poolOf(players, 'normal').map((p) => p.id));
    expect(easy.length).toBeGreaterThan(60);
    expect(easy.every((p) => normal.has(p.id))).toBe(true);
    expect(normal.size).toBeLessThan(players.length);
    expect(poolOf(players, 'expert')).toHaveLength(players.length);
  });

  it('has the stars in easy and leaves youth with no minutes out of normal', () => {
    for (const name of ['Bukayo Saka', 'Erling Haaland', 'Mohamed Salah']) {
      const p = players.find((x) => x.name === name);
      if (p) expect(inPool(p, 'easy')).toBe(true);
    }
    const unknown = players.filter((p) => p.stats.plMinutes + p.stats.minutes === 0 && p.tm < 50_000_000);
    expect(unknown.length).toBeGreaterThan(0);
    expect(unknown.some((p) => inPool(p, 'normal'))).toBe(false);
  });

  it('keeps daily rounds already played on the old pool', () => {
    const legacy = (p: Player) => p.known;
    expect(dailyPoolFor(players, '2026-10-01', legacy)).toEqual(players.filter(legacy));
    expect(dailyPoolFor(players, POOL_V2_FROM, legacy)).toEqual(poolOf(players, 'normal'));
  });
});

describe('Higher or Lower themes', () => {
  it('filters by theme and widens a level that is too small', () => {
    const fwd = hlPool(players, 'normal', 'FWD');
    expect(fwd.length).toBeGreaterThanOrEqual(16);
    expect(fwd.every((p) => p.group === 'FWD')).toBe(true);
    // Only a handful of keepers are "easy": the pool widens rather than repeat them.
    const gk = hlPool(players, 'easy', 'GK');
    expect(gk.length).toBeGreaterThanOrEqual(16);
    expect(gk.every((p) => p.group === 'GK')).toBe(true);
    const big6 = hlPool(players, 'normal', 'big6');
    expect(new Set(big6.map((p) => p.club))).toEqual(new Set(['ARS', 'CHE', 'LIV', 'MCI', 'MUN', 'TOT']));
  });
});

describe('Price Tag steps', () => {
  it('step through round amounts and survive the slider round trip', () => {
    expect(stepPrice(40_000_000, 1)).toBe(45_000_000);
    expect(stepPrice(40_000_000, -1)).toBe(38_000_000);
    expect(stepPrice(43_000_000, -1)).toBe(40_000_000);
    let v = 500_000;
    for (let i = 0; i < 60; i++) {
      const next = stepPrice(v, 1);
      expect(sliderToEur(eurToSlider(next))).toBe(next);
      v = next;
    }
    expect(v).toBe(250_000_000);
  });
});

describe('Budget XI auto-fill', () => {
  const formation = formationByKey('433');

  it.each([80_000_000, 200_000_000, 700_000_000])('fills a whole XI within %d', (budget) => {
    const filled = autoFill(players, formation, {}, budget, 'tm');
    expect(isComplete(formation, filled)).toBe(true);
    expect(spent(filled, 'tm')).toBeLessThanOrEqual(budget);
    expect(new Set(Object.values(filled).map((p) => p!.id)).size).toBe(11);
  });

  it('keeps the players already picked, and more money buys a better XI', () => {
    const saka = byName('Bukayo Saka');
    const filled = autoFill(players, formation, { rw: saka }, 400_000_000, 'tm');
    expect(filled.rw).toBe(saka);
    expect(isComplete(formation, filled)).toBe(true);
    expect(Object.values(filled).filter((p) => p === saka)).toHaveLength(1);
    const small = teamStrength(formation, autoFill(players, formation, {}, 200_000_000, 'tm'), 'tm');
    const big = teamStrength(formation, autoFill(players, formation, {}, 700_000_000, 'tm'), 'tm');
    expect(big).toBeGreaterThan(small);
  });

  it('sorts by value for money on small budgets', () => {
    expect(defaultSort(80_000_000)).toBe('bargain');
    expect(defaultSort(700_000_000)).toBe('rating');
  });
});

describe('Road chemistry', () => {
  it('adds a bonus per extra team-mate, capped', () => {
    const ars = players.filter((p) => p.club === 'ARS').slice(0, 11);
    const lineup = Object.fromEntries(ars.map((p, i) => [`s${i}`, p]));
    expect(chemistry({ a: ars[0], b: ars[1] }).bonus).toBeCloseTo(0.3);
    expect(chemistry({ a: ars[0] }).bonus).toBe(0);
    expect(chemistry(lineup).bonus).toBe(CHEMISTRY_MAX);
  });
});

describe('formatEur', () => {
  it('writes nothing as zero, not "0K"', () => {
    expect(formatEur(0, 'en')).toBe('€0');
    expect(formatEur(0, 'pl')).toBe('0 €');
  });
});
