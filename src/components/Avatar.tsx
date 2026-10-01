import { useState } from 'preact/hooks';
import { useDataset } from '../data/store';
import type { Player } from '../data/types';
import { initials } from '../lib/format';

/** URL of a club's crest, bundled in public/crests/. */
export function crestUrl(code: string): string {
  return `${import.meta.env.BASE_URL}crests/${code}.svg`;
}

/**
 * A club crest. Decorative by default (the club name is always written next
 * to it); falls back to a swatch in the club's colours if the file is missing.
 */
export function Crest({ code, size = 20, label }: { code: string; size?: number; label?: string }) {
  const club = useDataset().meta.clubs[code];
  const [broken, setBroken] = useState(false);
  if (broken || !club) {
    return (
      <i
        class="crest crest--swatch"
        aria-hidden={label ? undefined : 'true'}
        title={label}
        style={{ width: `${size}px`, height: `${size}px`, background: club?.primary, borderColor: club?.secondary }}
      />
    );
  }
  return (
    <img
      class="crest"
      src={crestUrl(code)}
      width={size}
      height={size}
      alt={label ?? ''}
      title={label}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

/** A player badge: initials in the club's colours, with the club crest on the corner. */
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
      {size >= 26 && (
        <span class="avatar__crest">
          <Crest code={player.club} size={Math.max(12, Math.round(size * 0.42))} />
        </span>
      )}
    </span>
  );
}

export function ClubChip({ code }: { code: string }) {
  const club = useDataset().meta.clubs[code];
  return (
    <span class="club-chip" title={club.name}>
      <Crest code={code} size={16} />
      {club.short}
    </span>
  );
}
