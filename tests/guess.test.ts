import { describe, expect, it } from 'vitest';
import type { Player } from '../src/data/types';
import { compare, dailyPool, dailyTarget, shareGrid } from '../src/games/guess/logic';

let nextId = 0;
function player(over: Partial<Player>): Player {
  return {
    id: nextId++,
    name: `Player ${nextId}`,
    short: 'P',
    club: 'ARS',
    pos: 'CM',
    group: 'MID',
    age: 25,
    nat: 'England',
    flag: '',
    continent: 'Europe',
    tm: 50_000_000,
    model: 40_000_000,
    low: 20_000_000,
    high: 60_000_000,
    tier: 0,
    perf: 50,
    known: true,
    contract: null,
    fee: null,
    stats: { minutes: 0, goals: 0, assists: 0, points: 0, plSeasons: 0, plMinutes: 0, plGoals: 0, plAssists: 0, clMinutes: 0 },
    ...over,
  };
}

describe('compare', () => {
  const target = player({ club: 'LIV', pos: 'RW', group: 'FWD', age: 26, nat: 'Egypt', continent: 'Africa', tm: 60_000_000, model: 30_000_000 });

  it('marks an identical player correct everywhere', () => {
    const f = compare(target, target, 'tm');
    expect(f.correct).toBe(true);
    expect([f.club, f.pos, f.nat, f.age.mark, f.value.mark]).toEqual(['hit', 'hit', 'hit', 'hit', 'hit']);
    expect(f.age.dir).toBeNull();
  });

  it('gives near for same line and same continent', () => {
    const g = player({ pos: 'ST', group: 'FWD', nat: 'Senegal', continent: 'Africa' });
    const f = compare(g, target, 'tm');
    expect(f.pos).toBe('near');
    expect(f.nat).toBe('near');
    expect(f.club).toBe('miss');
  });

  it('points age and value towards the target', () => {
    const g = player({ age: 30, tm: 20_000_000 });
    const f = compare(g, target, 'tm');
    expect(f.age).toEqual({ mark: 'miss', dir: 'down' });
    expect(f.value).toEqual({ mark: 'miss', dir: 'up' });
  });

  it('counts ages within two years and values within 25% as near', () => {
    const g = player({ age: 24, tm: 50_000_000 });
    const f = compare(g, target, 'tm');
    expect(f.age.mark).toBe('near');
    expect(f.value.mark).toBe('near');
  });

  it('uses the active value source', () => {
    const g = player({ tm: 60_000_000, model: 90_000_000 });
    expect(compare(g, target, 'tm').value.mark).toBe('hit');
    expect(compare(g, target, 'model').value).toEqual({ mark: 'miss', dir: 'down' });
  });
});

describe('daily target', () => {
  const players = Array.from({ length: 30 }, (_, i) => player({ name: `P${String(i).padStart(2, '0')}`, known: i % 3 !== 0 }));

  it('only picks from the known pool', () => {
    const pool = new Set(dailyPool(players).map((p) => p.name));
    for (let d = 1; d <= 28; d++) {
      expect(pool.has(dailyTarget(players, `2026-10-${String(d).padStart(2, '0')}`).name)).toBe(true);
    }
  });

  it('is the same for everyone and ignores input order', () => {
    const a = dailyTarget(players, '2026-10-05').name;
    const b = dailyTarget(players.slice().reverse(), '2026-10-05').name;
    expect(a).toBe(b);
  });

  it('does not repeat a player until the pool is used up', () => {
    const size = dailyPool(players).length; // 20
    const seen = new Set<string>();
    for (let d = 0; d < size; d++) {
      const date = new Date(2026, 8, 30 + d);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      seen.add(dailyTarget(players, key).name);
    }
    expect(seen.size).toBe(size);
  });
});

describe('shareGrid', () => {
  it('renders one row of five squares per guess', () => {
    const t = player({});
    const grid = shareGrid([compare(player({ club: 'CHE', age: 40 }), t, 'tm'), compare(t, t, 'tm')]);
    expect(grid.split('\n')).toEqual(['⬛🟩🟩⬛🟩', '🟩🟩🟩🟩🟩']);
  });
});
