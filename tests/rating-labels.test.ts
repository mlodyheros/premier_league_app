/**
 * Ratings a reader gave for players the formula used to get wrong
 * (2026-10-01). The formula, plus the short RATING_ADJUSTMENTS list, has to
 * stay within one point of every one of them.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Player } from '../src/data/types';
import { fit, rating, setRatingPool } from '../src/lib/strength';

const players: Player[] = JSON.parse(readFileSync('public/data/players.json', 'utf8'));
setRatingPool(players);
const byName = (n: string) => {
  const p = players.find((x) => x.name === n);
  if (!p) throw new Error(`No player called ${n}`);
  return p;
};

const READER: Record<string, number> = {
  'Bruno Fernandes': 90,
  'Bukayo Saka': 89,
  'Moisés Caicedo': 87,
  'Carlos Baleba': 81,
  'Lewis Hall': 83,
  'William Saliba': 87,
  'Jurriën Timber': 84,
  'David Raya': 87,
  Alisson: 85,
  'Gianluigi Donnarumma': 86,
  'Emiliano Martínez': 83,
  'Jordan Pickford': 82,
  'Senne Lammens': 81,
  'Youri Tielemans': 85,
  'Kobbie Mainoo': 81,
};

describe('reader ratings', () => {
  for (const [name, want] of Object.entries(READER)) {
    it(`${name}: ${want}`, () => {
      expect(Math.abs(rating(byName(name), 'tm') - want)).toBeLessThanOrEqual(1);
    });
  }
});

describe('neighbouring positions', () => {
  it('cost nothing: CM <-> DM, CM <-> AM, winger <-> wide midfielder', () => {
    const one = (pos: Player['pos']) => players.find((p) => p.pos === pos)!;
    expect(fit(one('CM'), 'DM')).toBe(1);
    expect(fit(one('DM'), 'CM')).toBe(1);
    expect(fit(one('AM'), 'CM')).toBe(1);
    expect(fit(one('CM'), 'AM')).toBe(1);
    expect(fit(one('LW'), 'LM')).toBe(1);
    expect(fit(one('RW'), 'RM')).toBe(1);
  });
});
