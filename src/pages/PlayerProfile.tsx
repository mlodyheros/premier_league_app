import { useMemo } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { PlayerCard } from '../components/PlayerCard';
import { ValueChart } from '../components/ValueChart';
import { useHistory } from '../data/history';
import { useDataset } from '../data/store';
import { modelGap, valueSource } from '../data/valueSource';
import { t } from '../i18n';
import { posFull } from '../i18n/labels';
import { formatEur, formatPct } from '../lib/format';
import { playerBySlug } from '../lib/playerUrl';
import { rating } from '../lib/strength';
import { href } from '../router';

/** One player: who he is, what he is worth on both counts, his record and his value over time. */
export function PlayerProfile({ slug }: { slug: string }) {
  const { players, meta } = useDataset();
  const h = useHistory();
  const source = valueSource.value;
  const p = useMemo(() => playerBySlug(players, slug), [players, slug]);

  if (!p) {
    return (
      <section class="profile">
        <h1>{t('profile.notFound')}</h1>
        <p>
          <a href={href('stats')}>{t('profile.toPlayers')}</a>
        </p>
      </section>
    );
  }

  const ovr = rating(p, source);
  const gap = modelGap(p);
  const week = h?.players[p.name];
  const n = h?.dates.length ?? 0;
  const weekly = (key: 'tm' | 'model') => {
    const a = week?.[key][n - 2];
    const b = week?.[key][n - 1];
    return a && b && a !== b ? (b - a) * h!.unit : null;
  };

  return (
    <section class="profile">
      <a class="profile__back" href={href('stats')}>
        <Icon name="arrow-left" size={18} /> {t('profile.toPlayers')}
      </a>

      <PlayerCard
        player={p}
        page
        head={
          <div class="profile__tiles">
            <div class="profile__tile profile__tile--ovr">
              <small>{t('common.ovr')}</small>
              <b>{ovr}</b>
              {p.ref !== undefined && <span>{t('profile.fc27', { n: p.ref })}</span>}
            </div>
            <div class={`profile__tile ${source === 'tm' ? 'on' : ''}`}>
              <small>{t('compare.tm')}</small>
              <b>{formatEur(p.tm)}</b>
              {weekly('tm') !== null && <span>{t('profile.thisWeek', { v: signed(weekly('tm')!) })}</span>}
            </div>
            <div class={`profile__tile ${source === 'model' ? 'on' : ''}`}>
              <small>{t('compare.model')}</small>
              <b>{formatEur(p.model)}</b>
              <span>
                {formatEur(p.low)}–{formatEur(p.high)}
              </span>
            </div>
            <div class={`profile__tile ${gap >= 0 ? 'up' : 'down'}`}>
              <small>{t('compare.gap')}</small>
              <b>{formatPct(gap)}</b>
              {weekly('model') !== null && <span>{t('profile.modelWeek', { v: signed(weekly('model')!) })}</span>}
            </div>
          </div>
        }
      >
        <dl class="profile__facts">
          <div>
            <dt>{t('profile.club')}</dt>
            <dd>{meta.clubs[p.club].name}</dd>
          </div>
          <div>
            <dt>{t('profile.position')}</dt>
            <dd>{posFull(p.pos)}</dd>
          </div>
          {p.contract && (
            <div>
              <dt>{t('profile.contract')}</dt>
              <dd>{p.contract}</dd>
            </div>
          )}
          {p.fee !== null && p.fee > 0 && (
            <div>
              <dt>{t('profile.fee')}</dt>
              <dd>{formatEur(p.fee)}</dd>
            </div>
          )}
        </dl>
        {h?.career[p.name] && <ValueChart points={h.career[p.name]} unit={h.unit} label={t('chart.title')} />}
      </PlayerCard>
    </section>
  );
}

function signed(eur: number): string {
  return `${eur > 0 ? '+' : '−'}${formatEur(Math.abs(eur))}`;
}
