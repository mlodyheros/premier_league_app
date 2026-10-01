import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { useCountUp } from '../hooks/useCountUp';
import { t, tj } from '../i18n';
import { posLabel } from '../i18n/labels';
import { formatDecimal, formatOdds, ordinal } from '../lib/format';
import { USER_TEAM_ID } from '../lib/league';
import { buzz, celebrate } from '../lib/motion';
import type { PlayedSeason } from '../lib/playSeason';
import { DIFFICULTY, type TableRow } from '../lib/season';
import { rating, type Formation, type Lineup } from '../lib/strength';
import { Avatar, Crest } from './Avatar';

export function userRow(table: readonly TableRow[]): TableRow {
  return table.find((r) => r.id === USER_TEAM_ID)!;
}

export interface Badge {
  icon: string;
  label: 'road.badge.perfect' | 'road.badge.champions' | 'road.badge.invincible' | 'road.badge.centurion';
}

export function seasonBadges(row: TableRow, position: number): Badge[] {
  const out: Badge[] = [];
  if (row.points >= 100) out.push({ icon: '💯', label: 'road.badge.centurion' });
  if (position === 1) out.push({ icon: '🏆', label: 'road.badge.champions' });
  if (row.won === 38) out.push({ icon: '⭐', label: 'road.badge.perfect' });
  else if (row.lost === 0) out.push({ icon: '🛡️', label: 'road.badge.invincible' });
  return out;
}

export function resultsGrid(season: PlayedSeason): string {
  const sq = season.results.map((r) => (r.outcome === 'W' ? '🟩' : r.outcome === 'D' ? '🟨' : '🟥'));
  return [sq.slice(0, 19).join(''), sq.slice(19).join('')].filter(Boolean).join('\n');
}

/**
 * A played season: record, points and position (counting up the first time),
 * badges, the 38 results, your XI with ratings, goals and assists, and the table.
 */
export function SeasonResult({
  season,
  formation,
  lineup,
  animate,
  chips = [],
  actions,
}: {
  season: PlayedSeason;
  formation: Formation;
  lineup: Lineup;
  animate: boolean;
  chips?: string[];
  actions?: ComponentChildren;
}) {
  const row = userRow(season.table);
  const earned = seasonBadges(row, season.position);
  const won = useCountUp(row.won, animate, 1400);
  const drawn = useCountUp(row.drawn, animate, 1400);
  const lost = useCountUp(row.lost, animate, 1400);
  const points = useCountUp(row.points, animate, 1600);
  const reached = row.points >= (season.target ?? 100);

  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(() => {
      if (reached || season.position === 1) celebrate(reached && season.position === 1);
      buzz(reached ? 'good' : 'tap');
    }, 1500);
    return () => clearTimeout(timer);
  }, [animate]);

  const boost = season.difficulty === 'arcade' ? t('road.boost', { n: DIFFICULTY.arcade.bonus }) : '';
  const scorers = season.scorers ?? {};
  const xi = [...formation.slots].reverse().flatMap((slot) => {
    const p = lineup[slot.id];
    return p ? [{ slot, p, tally: scorers[p.name] }] : [];
  });
  const topScorer = xi.reduce<(typeof xi)[number] | null>(
    (best, x) => ((x.tally?.goals ?? 0) > (best?.tally?.goals ?? 0) ? x : best),
    null,
  );

  return (
    <div class={`season ${animate ? 'season--fresh' : ''}`}>
      <div class={`end ${reached ? 'end--win' : 'end--lose'}`}>
        {chips.map((c) => (
          <span class="mode-chip">{c}</span>
        ))}
        <p class="season__record" aria-label={`${row.won}-${row.drawn}-${row.lost}`}>
          {Math.round(won)}-{Math.round(drawn)}-{Math.round(lost)}
        </p>
        <p class={`season__points ${reached ? 'season__points--hit' : ''}`}>
          {t('road.result', { pts: Math.round(points), pos: ordinal(season.position) })}
        </p>
        {earned.length > 0 && (
          <ul class="badges">
            {earned.map((b) => (
              <li>
                <span aria-hidden="true">{b.icon}</span> {t(b.label)}
              </li>
            ))}
          </ul>
        )}
        <p class="end__note">
          {tj(season.target ? 'road.note' : 'road.notePerfect', {
            ovr: formatDecimal(season.strength),
            boost,
            odds: <b>{formatOdds(season.odds)}</b>,
            club: season.replaced,
            gf: row.goalsFor,
            ga: row.goalsAgainst,
          })}
        </p>
        <ol class="strip" aria-label={t('road.results')}>
          {season.results.map((r, i) => (
            <li
              class={`strip__m strip__m--${r.outcome}`}
              style={{ '--i': i }}
              title={`${i + 1}. ${t(r.home ? 'road.home' : 'road.away', { opp: r.opponent })} ${r.goalsFor}-${r.goalsAgainst}`}
            >
              <span class="sr-only">
                {t(r.home ? 'road.home' : 'road.away', { opp: r.opponent })} {r.goalsFor}-{r.goalsAgainst}
              </span>
            </li>
          ))}
        </ol>
        {actions && <div class="end__actions">{actions}</div>}
      </div>

      <div class="xi-reveal">
        <h2>{t('road.yourXi')}</h2>
        {season.scorers && (
          <p class="xi-reveal__legend" aria-hidden="true">
            <span>⚽ {t('stat.goals')}</span>
            <span>🅰️ {t('stat.assists')}</span>
            <span>{t('common.ovr')}</span>
          </p>
        )}
        <ul>
          {xi.map(({ slot, p, tally }, i) => (
            <li style={{ '--i': i }} class={topScorer?.p === p && (tally?.goals ?? 0) > 0 ? 'top' : ''}>
              <span class="xi-reveal__pos">{posLabel(slot.type)}</span>
              <Avatar player={p} size={28} />
              <span class="xi-reveal__name">{p.name}</span>
              {tally && (
                <span class="xi-reveal__ga" title={`${t('stat.goals')} / ${t('stat.assists')}`}>
                  <b>{tally.goals}</b>
                  <i>{tally.assists}</i>
                </span>
              )}
              <span class="xi-reveal__ovr">{rating(p, season.source)}</span>
            </li>
          ))}
        </ul>
      </div>

      <details class="table-wrap" open>
        <summary>{t('road.table')}</summary>
        <table class="league">
          <thead>
            <tr>
              <th>#</th>
              <th class="l">{t('road.col.team')}</th>
              <th>{t('road.col.w')}</th>
              <th>{t('road.col.d')}</th>
              <th>{t('road.col.l')}</th>
              <th>{t('road.col.gd')}</th>
              <th>{t('road.col.pts')}</th>
            </tr>
          </thead>
          <tbody>
            {season.table.map((team, i) => (
              <tr class={team.id === USER_TEAM_ID ? 'you' : ''}>
                <td>{i + 1}</td>
                <td class="l">
                  <span class="league__team">
                    {team.id === USER_TEAM_ID ? (
                      <span class="league__you" aria-hidden="true">
                        ★
                      </span>
                    ) : (
                      <Crest code={team.id} size={18} />
                    )}
                    {team.id === USER_TEAM_ID ? t('road.yourXi') : team.name}
                  </span>
                </td>
                <td>{team.won}</td>
                <td>{team.drawn}</td>
                <td>{team.lost}</td>
                <td>
                  {team.goalsFor - team.goalsAgainst > 0 ? '+' : ''}
                  {team.goalsFor - team.goalsAgainst}
                </td>
                <td>
                  <b>{team.points}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
