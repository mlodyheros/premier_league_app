import { PlayerLink } from '../components/PlayerLink';
import { useMemo } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { useHistory, historyError } from '../data/history';
import { useDataset } from '../data/store';
import { valueSource, type ValueSource } from '../data/valueSource';
import { t, tj } from '../i18n';
import { posLabel } from '../i18n/labels';
import { formatDate, formatEur, formatPct } from '../lib/format';
import { weeklyMoves, type Move } from '../lib/market';
import { href } from '../router';

function MoveRow({ m }: { m: Move }) {
  const { meta } = useDataset();
  return (
    <li class="move">
      <Avatar player={m.player} size={30} />
      <span class="move__name">
        <PlayerLink player={m.player} />
        <small>
          {meta.clubs[m.player.club].short} · {posLabel(m.player.pos)} · {formatEur(m.from)} → {formatEur(m.to)}
        </small>
      </span>
      <span class={`move__delta ${m.change > 0 ? 'up' : 'down'}`}>
        <b>
          {m.to > m.from ? '+' : '−'}
          {formatEur(Math.abs(m.to - m.from))}
        </b>
        <small>{formatPct(m.change)}</small>
      </span>
    </li>
  );
}

/** The week's biggest value changes. */
export function Market() {
  const { players } = useDataset();
  const h = useHistory();
  const chosen = valueSource.value;

  const tm = useMemo(() => (h ? weeklyMoves(h, players, 'tm') : null), [h, players]);
  const model = useMemo(() => (h ? weeklyMoves(h, players, 'model') : null), [h, players]);

  if (historyError.value) {
    return (
      <section class="market">
        <p class="notice-inline">{t('market.error')}</p>
      </section>
    );
  }
  if (!h) {
    return (
      <section class="market">
        <div class="skeleton" aria-busy="true" aria-label={t('app.loading')}>
          <span class="skeleton__line skeleton__line--title" />
          <span class="skeleton__line" />
        </div>
      </section>
    );
  }

  // Transfermarkt revises its values every few weeks; most weeks only the model moves.
  const tmStill = !tm || tm.all.length === 0;
  const source: ValueSource = chosen === 'tm' && tmStill ? 'model' : chosen;
  const moves = source === 'tm' ? tm : model;

  return (
    <section class="market">
      <header class="market__head">
        <h1>{t('market.title')}</h1>
        {moves ? (
          <p class="lede">
            {tj('market.lede', {
              from: <b>{formatDate(moves.from)}</b>,
              to: <b>{formatDate(moves.to)}</b>,
              count: moves.all.length,
              source: <b>{t(`market.source.${source}`)}</b>,
            })}
          </p>
        ) : (
          <p class="lede">{t('market.firstWeek')}</p>
        )}
        {chosen === 'tm' && tmStill && moves && <p class="notice-inline">{t('market.tmStill')}</p>}
      </header>

      {moves && (
        <>
          <div class="market__cols">
            <section>
              <h2 class="section-title">
                <Icon name="trending-up" /> {t('market.risers')}
              </h2>
              <ol class="moves">
                {moves.risers.map((m) => (
                  <MoveRow m={m} />
                ))}
              </ol>
            </section>
            <section>
              <h2 class="section-title">
                <Icon name="trending-down" /> {t('market.fallers')}
              </h2>
              <ol class="moves">
                {moves.fallers.map((m) => (
                  <MoveRow m={m} />
                ))}
              </ol>
            </section>
          </div>
        </>
      )}

      <p class="market__foot">
        {t('market.foot')} <a href={href('stats')}>{t('market.toPlayers')}</a>
      </p>
    </section>
  );
}
