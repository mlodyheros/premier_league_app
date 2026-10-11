import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Player } from '../src/data/types';
import { playerBySlug, playerPath, playerSlug } from '../src/lib/playerUrl';

const players: Player[] = JSON.parse(readFileSync('public/data/players.json', 'utf8'));

describe('player profile links', () => {
  it('spell a name in plain lowercase letters', () => {
    expect(playerSlug('Martin Ødegaard')).toBe('martin-odegaard');
    expect(playerSlug('Viktor Gyökeres')).toBe('viktor-gyokeres');
    expect(playerSlug("Dara O'Shea")).toBe('dara-o-shea');
  });

  it('lead to one player each', () => {
    const slugs = players.map((p) => playerSlug(p.name));
    expect(new Set(slugs).size).toBe(players.length);
    for (const p of players.slice(0, 50)) expect(playerBySlug(players, playerPath(p).slice('player/'.length))).toBe(p);
  });
});
