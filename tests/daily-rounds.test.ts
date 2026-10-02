import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { History } from '../src/data/history';
import type { Player } from '../src/data/types';
import { sideOf } from '../src/games/beat-model/logic';
import {
  beatRound,
  computeBeat,
  computePrice,
  guessTarget,
  marketRound,
  priceRound,
  thaw,
  writeDay,
  type Schedule,
} from '../src/lib/dailyRounds';
import { dailyTarget } from '../src/games/guess/logic';
import { setRatingPool } from '../src/lib/strength';

const players: Player[] = JSON.parse(readFileSync('public/data/players.json', 'utf8'));
const history: History = JSON.parse(readFileSync('public/data/history.json', 'utf8'));
setRatingPool(players);
const DAY = '2026-10-10';

describe('frozen daily rounds', () => {
  const day = writeDay(players, history, DAY, new Set());
  const schedule: Schedule = { [DAY]: day };

  it('a scheduled round is the round the browser computes from the same data', () => {
    expect(day.guess).toBe(dailyTarget(players, DAY).name);
    expect(beatRound(players, schedule, DAY).map((p) => p.name)).toEqual(computeBeat(players, DAY).map((p) => p.name));
    expect(priceRound(players, schedule, DAY).map((p) => p.name)).toEqual(computePrice(players, DAY).map((p) => p.name));
  });

  it('keeps the values it was written with when the data changes', () => {
    // A data update moves every model estimate by 30%.
    const later = players.map((p) => ({ ...p, model: Math.round(p.model * 1.3), tm: p.tm + 1_000_000 }));
    const round = beatRound(later, schedule, DAY);
    expect(round.map((p) => p.name)).toEqual(day.beat.map((f) => f.name));
    round.forEach((p, i) => {
      expect(p.model).toBe(day.beat[i].model);
      expect(p.tm).toBe(day.beat[i].tm);
    });
    // The answers do not flip either.
    expect(round.map(sideOf)).toEqual(thaw(players, day.beat)!.map(sideOf));
    expect(guessTarget(later, schedule, DAY).name).toBe(day.guess);
    expect(priceRound(later, schedule, DAY).map((p) => p.tm)).toEqual(day.price.map((f) => f.tm));
  });

  it('falls back to computing a round when a scheduled player has left', () => {
    const without = players.filter((p) => p.name !== day.beat[0].name);
    expect(beatRound(without, schedule, DAY)).toHaveLength(10);
    expect(thaw(without, day.beat)).toBeNull();
  });

  it('does not repeat a recent guess answer', () => {
    const again = writeDay(players, history, DAY, new Set([day.guess]));
    expect(again.guess).not.toBe(day.guess);
  });

  it('freezes the market quiz with its numbers', () => {
    expect(day.market?.length).toBe(5);
    const pairs = marketRound(players, schedule, null, DAY)!;
    expect(pairs.map(([a, b]) => [a.player.name, b.player.name])).toEqual(day.market!.map(({ a, b }) => [a.name, b.name]));
    for (const [a, b] of pairs) expect(Math.abs(a.change - b.change)).toBeGreaterThanOrEqual(0.05);
  });
});
