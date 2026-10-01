import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Meta, Player } from '../src/data/types';
import { drawRound } from '../src/games/beat-model/logic';
import { pool as pricePool, ROUNDS } from '../src/games/price-tag/logic';
import { dailyRand } from '../src/lib/daily';
import { clubTeams, withUserTeam } from '../src/lib/league';
import { shuffled } from '../src/lib/rng';
import { DIFFICULTY, perfectSeasonOdds, simulateSeason, STRONG_DRAFT } from '../src/lib/season';
import { setRatingPool } from '../src/lib/strength';
import { mulberry32 } from '../src/lib/rng';
import { emptyStats, recordResult } from '../src/lib/stats';

const players: Player[] = JSON.parse(readFileSync('public/data/players.json', 'utf8'));
const meta: Meta = JSON.parse(readFileSync('public/data/meta.json', 'utf8'));
const ids = (ps: Player[]) => ps.map((p) => p.id).join(',');
setRatingPool(players);

describe('daily rounds', () => {
  it('give everyone the same Beat the Model round on a date, and a new one the next day', () => {
    const a = drawRound(players, dailyRand('beat', '2026-10-01'));
    const b = drawRound(players, dailyRand('beat', '2026-10-01'));
    const c = drawRound(players, dailyRand('beat', '2026-10-02'));
    expect(ids(a)).toBe(ids(b));
    expect(ids(a)).not.toBe(ids(c));
  });

  it('give everyone the same Price Tag round, separate from Beat the Model', () => {
    const cands = pricePool(players);
    const a = shuffled(cands, dailyRand('price', '2026-10-01')).slice(0, ROUNDS);
    const b = shuffled(cands, dailyRand('price', '2026-10-01')).slice(0, ROUNDS);
    expect(ids(a)).toBe(ids(b));
    expect(a).toHaveLength(ROUNDS);
  });

  it('count consecutive days played as the daily streak', () => {
    let s = emptyStats(0);
    s = recordResult(s, true, 0, { today: '2026-10-01', yesterday: '2026-09-30' });
    s = recordResult(s, true, 0, { today: '2026-10-02', yesterday: '2026-10-01' });
    expect(s.streak).toBe(2);
    expect(s.distribution).toEqual([]);
  });
});

describe('Road to 38-0 difficulty', () => {
  const clubs = clubTeams(players, meta, 'tm');
  const odds = (xi: number, mode: keyof typeof DIFFICULTY) => {
    const { model, bonus } = DIFFICULTY[mode];
    const { league } = withUserTeam(clubs, xi + bonus);
    return perfectSeasonOdds(xi + bonus, league.slice(1).map((t) => t.strength), model);
  };

  it('makes 38-0 possible in arcade for a strong draft, and a dream in realistic', () => {
    expect(1 / odds(STRONG_DRAFT, 'arcade')).toBeGreaterThan(50);
    expect(1 / odds(STRONG_DRAFT, 'arcade')).toBeLessThan(2000);
    expect(1 / odds(STRONG_DRAFT, 'realistic')).toBeGreaterThan(100_000);
  });

  it('keeps arcade seasons within football (no 38-0 for a weak XI)', () => {
    const { model, bonus } = DIFFICULTY.arcade;
    const { league } = withUserTeam(clubs, 76 + bonus);
    const s = simulateSeason(league, 'YOU', mulberry32(11), model);
    expect(s.table.find((r) => r.id === 'YOU')!.won).toBeLessThan(38);
  });
});
