import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Player } from '../src/data/types';
import { t, type Key } from '../src/i18n';
import { missingPolishCountries } from '../src/i18n/countries';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { formatDate, formatDecimal, formatEur, ordinal } from '../src/lib/format';

const players: Player[] = JSON.parse(readFileSync('public/data/players.json', 'utf8'));

describe('translations', () => {
  it('have the same keys and placeholders in both languages', () => {
    const holes = (e: unknown) =>
      [...JSON.stringify(e).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().filter((v, i, a) => a.indexOf(v) === i);
    for (const key of Object.keys(en) as Key[]) {
      expect(pl[key], key).toBeDefined();
      expect(holes(pl[key]), key).toEqual(holes(en[key]));
    }
  });

  it('use Polish plural forms', () => {
    expect(t('note.fewMinutes', { count: 1 }, 'pl')).toContain('1 minuta');
    expect(t('note.fewMinutes', { count: 3 }, 'pl')).toContain('3 minuty');
    expect(t('note.fewMinutes', { count: 7 }, 'pl')).toContain('7 minut ');
    expect(t('note.fewMinutes', { count: 22 }, 'pl')).toContain('22 minuty');
    expect(t('road.respins', { count: 1 }, 'en')).toBe('You have 1 re-spin.');
    expect(t('road.respins', { count: 3 }, 'en')).toBe('You have 3 re-spins.');
  });

  it('name every nationality in Polish', () => {
    expect(missingPolishCountries(players.map((p) => p.nat))).toEqual([]);
  });
});

describe('localised formatting', () => {
  it('writes money the Polish way', () => {
    const plain = (s: string) => s.replace(/\u00a0/g, ' ');
    expect(plain(formatEur(45_500_000, 'pl'))).toBe('45,5 mln €');
    expect(plain(formatEur(220_000_000, 'pl'))).toBe('220 mln €');
    expect(plain(formatEur(750_000, 'pl'))).toBe('750 tys. €');
    expect(plain(formatEur(100_000_000, 'pl', true))).toBe('100 mln');
    expect(formatEur(100_000_000, 'en', true)).toBe('€100M');
  });

  it('formats decimals, dates and ordinals', () => {
    expect(formatDecimal(84.34, 1, 'pl')).toBe('84,3');
    expect(formatDecimal(84.34, 1, 'en')).toBe('84.3');
    expect(formatDate('2026-09-24', 'en')).toBe('24 Sept 2026');
    expect(formatDate('2026-09-24', 'pl')).toBe('24 wrz 2026');
    expect(ordinal(1, 'en')).toBe('1st');
    expect(ordinal(12, 'en')).toBe('12th');
    expect(ordinal(22, 'en')).toBe('22nd');
    expect(ordinal(3, 'pl')).toBe('3.');
  });
});
