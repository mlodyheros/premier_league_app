/** Player profile addresses: #/player/bukayo-saka. */
import type { Player } from '../data/types';
import { fold } from './format';

/** "Martin Ødegaard" -> "martin-odegaard": accents folded, anything else a dash. */
export function playerSlug(name: string): string {
  return fold(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function playerPath(p: Pick<Player, 'name'>): string {
  return `player/${playerSlug(p.name)}`;
}

/** The player a profile address points to; undefined if he has left the data. */
export function playerBySlug(players: readonly Player[], slug: string): Player | undefined {
  return players.find((p) => playerSlug(p.name) === slug);
}
