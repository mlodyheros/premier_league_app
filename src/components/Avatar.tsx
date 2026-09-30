import { useDataset } from '../data/store';
import type { Player } from '../data/types';
import { initials } from '../lib/format';

/** A generated badge in the club's colours: no photos, no crests. */
export function Avatar({ player, size = 40 }: { player: Player; size?: number }) {
  const club = useDataset().meta.clubs[player.club];
  return (
    <span
      class="avatar"
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.round(size * 0.38)}px`,
        background: `linear-gradient(135deg, ${club.primary} 0 58%, ${club.secondary} 58% 100%)`,
      }}
    >
      <span class="avatar__text">{initials(player.name)}</span>
    </span>
  );
}

export function ClubChip({ code }: { code: string }) {
  const club = useDataset().meta.clubs[code];
  return (
    <span class="club-chip" title={club.name}>
      <i style={{ background: club.primary, borderColor: club.secondary }} />
      {club.short}
    </span>
  );
}
