/** Player profile addresses: #/player/bukayo-saka. */
import type { Player } from '../data/types';
import { fold } from './format';

export function playerSlug(name: string): string {
  return fold(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function playerPath(p: Pick<Player, 'name'>): string {
  return `player/${playerSlug(p.name)}`;
}

export function playerBySlug(players: readonly Player[], slug: string): Player | undefined {
  return players.find((p) => playerSlug(p.name) === slug);
}
