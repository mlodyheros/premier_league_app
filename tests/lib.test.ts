import { describe, expect, it } from 'vitest';
import { fold, formatEur, formatPct, initials } from '../src/lib/format';
import { dayNumber, hashString, mulberry32, previousDayKey, shuffled, todayKey } from '../src/lib/rng';
import { emptyStats, recordResult } from '../src/lib/stats';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(hashString('x'));
    const b = mulberry32(hashString('x'));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('shuffles without losing items', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(shuffled(items, mulberry32(1)).sort()).toEqual(items);
  });

  it('numbers days from launch and steps back across months', () => {
    expect(dayNumber('2026-09-30')).toBe(1);
    expect(dayNumber('2026-10-01')).toBe(2);
    expect(previousDayKey('2026-10-01')).toBe('2026-09-30');
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('format', () => {
  it('formats euros compactly', () => {
    expect(formatEur(220_000_000)).toBe('€220M');
    expect(formatEur(45_000_000)).toBe('€45M');
    expect(formatEur(45_500_000)).toBe('€45.5M');
    expect(formatEur(1_500_000)).toBe('€1.5M');
    expect(formatEur(750_000)).toBe('€750K');
  });

  it('formats gaps with a real minus sign and no negative zero', () => {
    expect(formatPct(-0.25)).toBe('−25%');
    expect(formatPct(0.1)).toBe('+10%');
    expect(formatPct(-0.001)).toBe('0%');
  });

  it('folds accents for search', () => {
    expect(fold('Martin Ødegaard')).toBe('martin odegaard');
    expect(fold('Moisés Caicedo')).toBe('moises caicedo');
  });

  it('builds initials', () => {
    expect(initials('Erling Haaland')).toBe('EH');
    expect(initials('Gabriel')).toBe('GA');
  });
});

describe('stats', () => {
  it('keeps a daily streak only across consecutive days', () => {
    let s = emptyStats(8);
    s = recordResult(s, true, 3, { today: '2026-09-30', yesterday: '2026-09-29' });
    s = recordResult(s, true, 2, { today: '2026-10-01', yesterday: '2026-09-30' });
    expect(s.streak).toBe(2);
    s = recordResult(s, true, 4, { today: '2026-10-03', yesterday: '2026-10-02' });
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(2);
    expect(s.distribution.slice(0, 4)).toEqual([0, 1, 1, 1]);
  });

  it('records a day only once', () => {
    const day = { today: '2026-09-30', yesterday: '2026-09-29' };
    const s = recordResult(recordResult(emptyStats(8), true, 3, day), true, 3, day);
    expect(s.played).toBe(1);
  });

  it('resets the streak on a loss', () => {
    const s = recordResult(recordResult(emptyStats(8), true, 3), false, 8);
    expect(s).toMatchObject({ played: 2, won: 1, streak: 0, bestStreak: 1 });
  });
});
