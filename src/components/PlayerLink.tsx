import type { ComponentChildren } from 'preact';
import type { Player } from '../data/types';
import { playerPath } from '../lib/playerUrl';
import { href } from '../router';

/** A player's name (or anything) that opens his profile. */
export function PlayerLink({ player, children }: { player: Player; children?: ComponentChildren }) {
  return (
    <a class="player-link" href={href(playerPath(player))}>
      {children ?? player.name}
    </a>
  );
}
