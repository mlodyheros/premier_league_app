import type { ComponentChildren } from 'preact';
import type { Player } from '../data/types';
import { t } from '../i18n';
import { countryName } from '../i18n/countries';
import { posFull, posLabel } from '../i18n/labels';
import { formatInt } from '../lib/format';
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
            <ClubChip code={player.club} /> · <abbr title={posFull(player.pos)}>{posLabel(player.pos)}</abbr> ·{' '}
            <span title={countryName(player.nat)}>{player.flag}</span> · {player.age}
          </p>
        </div>
      </div>
      {!compact && (
        <dl class="pcard__stats">
          <div>
            <dt>{t('card.thisSeason')}</dt>
            <dd>{t('card.statline', { minutes: formatInt(s.minutes), goals: s.goals, assists: s.assists })}</dd>
          </div>
          <div>
            <dt>{t('card.plHistory')}</dt>
            <dd>
              {s.plSeasons
                ? t('card.statline', { minutes: formatInt(s.plMinutes), goals: s.plGoals, assists: s.plAssists })
                : t('card.none')}
            </dd>
          </div>
        </dl>
      )}
      {children && <div class="pcard__foot">{children}</div>}
    </article>
  );
}
