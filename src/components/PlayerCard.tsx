import type { ComponentChildren } from 'preact';
import type { Player, PlayerStats } from '../data/types';
import { t, type Key } from '../i18n';
import { countryName } from '../i18n/countries';
import { posFull, posLabel } from '../i18n/labels';
import { formatInt } from '../lib/format';
import { Avatar, ClubChip } from './Avatar';

type Stat = [Key, string];

/**
 * The three numbers that say most about a player in his position. Goals and
 * assists mean little for a goalkeeper; clean sheets and saves do.
 */
function seasonStats(p: Player): Stat[] {
  const s = p.stats;
  const minutes: Stat = ['stat.minutes', formatInt(s.minutes)];
  if (p.pos === 'GK') return [minutes, ['stat.cleanSheets', String(s.cleanSheets)], ['stat.saves', String(s.saves)]];
  if (p.group === 'DEF') return [minutes, ['stat.cleanSheets', String(s.cleanSheets)], ['stat.defActions', String(s.defActions)]];
  if (p.pos === 'DM') return [minutes, ['stat.defActions', String(s.defActions)], ['stat.ga', `${s.goals}+${s.assists}`]];
  return [minutes, ['stat.goals', String(s.goals)], ['stat.assists', String(s.assists)]];
}

function historyStats(p: Player): Stat[] {
  const s: PlayerStats = p.stats;
  const starts: Stat = ['stat.starts', formatInt(s.plStarts)];
  if (p.pos === 'GK') return [starts, ['stat.cleanSheets', String(s.plCleanSheets)], ['stat.saves', formatInt(s.plSaves)]];
  if (p.group === 'DEF') return [starts, ['stat.cleanSheets', String(s.plCleanSheets)], ['stat.ga', `${s.plGoals}+${s.plAssists}`]];
  return [starts, ['stat.goals', String(s.plGoals)], ['stat.assists', String(s.plAssists)]];
}

function StatRow({ title, stats, note }: { title: string; stats: Stat[]; note?: string }) {
  return (
    <div class="pcard__block">
      <p class="pcard__label">{title}</p>
      {note && <p class="pcard__note">{note}</p>}
      <dl class="pcard__stats">
        {stats.map(([label, value]) => (
          <div>
            <dd>{value}</dd>
            <dt>{t(label)}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A player's identity and record, with room for a value or a question below. */
export function PlayerCard({
  player,
  children,
  head,
  compact = false,
}: {
  player: Player;
  children?: ComponentChildren;
  /** Shown right under the name, above the record: what the question is about. */
  head?: ComponentChildren;
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
      {head && <div class="pcard__head">{head}</div>}
      {!compact && (
        <div class="pcard__record">
          <StatRow title={t('card.thisSeason')} stats={seasonStats(player)} />
          {s.plSeasons > 0 ? (
            <StatRow
              title={t('card.plSeasons', { count: s.plSeasons })}
              stats={historyStats(player)}
              note={s.plLastSeasonMinutes === 0 ? t('card.notLastSeason') : undefined}
            />
          ) : s.otherSeasons > 0 ? (
            <StatRow
              title={t('card.otherLeagues', { count: s.otherSeasons })}
              note={t('card.noPl')}
              stats={[
                ['stat.minutes', formatInt(s.otherMinutes)],
                ['stat.goals', String(s.otherGoals)],
                ['stat.assists', String(s.otherAssists)],
              ]}
            />
          ) : (
            <div class="pcard__block">
              <p class="pcard__label">{t('card.history')}</p>
              <p class="pcard__none">{t('card.noRecord')}</p>
            </div>
          )}
        </div>
      )}
      {children && <div class="pcard__foot">{children}</div>}
    </article>
  );
}
