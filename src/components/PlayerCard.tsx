import type { ComponentChildren } from 'preact';
import type { Player } from '../data/types';
import { Avatar, ClubChip } from './Avatar';

/** A player's identity and record, with room for a value or a question below. */
export function PlayerCard({
  player,
  children,
  compact = false,
}: {
  player: Player;
  children?: ComponentChildren;
  compact?: boolean;
}) {
  const s = player.stats;
  return (
    <article class={`pcard ${compact ? 'pcard--compact' : ''}`}>
      <div class="pcard__top">
        <Avatar player={player} size={compact ? 44 : 60} />
        <div class="pcard__id">
          <h3 class="pcard__name">{player.name}</h3>
          <p class="pcard__meta">
            <ClubChip code={player.club} /> · {player.pos} · <span title={player.nat}>{player.flag}</span> · {player.age}
          </p>
        </div>
      </div>
      {!compact && (
        <dl class="pcard__stats">
          <div>
            <dt>This season</dt>
            <dd>
              {s.minutes}′ · {s.goals}G {s.assists}A
            </dd>
          </div>
          <div>
            <dt>PL, last 4 seasons</dt>
            <dd>{s.plSeasons ? `${s.plMinutes.toLocaleString('en')}′ · ${s.plGoals}G ${s.plAssists}A` : 'none'}</dd>
          </div>
        </dl>
      )}
      {children && <div class="pcard__foot">{children}</div>}
    </article>
  );
}
