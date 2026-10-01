import { useState } from 'preact/hooks';
import { Crest } from '../components/Avatar';
import { useDataset } from '../data/store';
import { valuesPhrase, valueSource } from '../data/valueSource';
import { GAME_LIST, type GameMeta } from '../games/meta';
import { t, tj, type Key } from '../i18n';
import { formatDecimal, formatEur } from '../lib/format';
import { getBest } from '../lib/records';
import { todayKey } from '../lib/rng';
import { loadStats } from '../lib/stats';
import { href } from '../router';

function best(key: string, label: Key, digits = 0, extra: Record<string, string> = {}) {
  const v = getBest(key);
  return v === null ? null : t(label, { n: digits ? formatDecimal(v, digits) : String(v), ...extra });
}

/** The personal best shown on each card. */
function record(g: GameMeta): string | null {
  const src = valueSource.value;
  switch (g.id) {
    case 'guess': {
      const s = loadStats('guess-daily', 8);
      return s.played ? t('home.best.guess', { n: s.streak }) : null;
    }
    case 'road':
      return best(`road:pts:${src}`, 'home.best.road');
    case 'hl':
      return best(`hl:${src}`, 'home.best.hl');
    case 'budget':
      return best(`budget:200000000:${src}`, 'home.best.budget', 1, { budget: formatEur(200_000_000) });
    case 'beat':
      return best('beat-model', 'home.best.beat');
    case 'price':
      return best(`price-tag:${src}`, 'home.best.price');
  }
}

export function Home() {
  const { meta } = useDataset();
  const [day] = useState(todayKey);
  const dailies = GAME_LIST.filter((g) => g.daily);

  return (
    <section class="home">
      <div class="hero">
        <div class="crest-row" aria-hidden="true">
          {Object.keys(meta.clubs).map((code) => (
            <Crest code={code} size={28} />
          ))}
        </div>
        <p class="eyebrow">{t('home.eyebrow', { season: meta.season, players: meta.players, gw: meta.gameweek })}</p>
        <h1>
          {t('home.title')} <em>{t('home.titleEm')}</em>
        </h1>
        <p class="lede">
          {tj('home.lede', {
            toggle: <b>{`${t('toggle.tm')} / ${t('toggle.model')}`}</b>,
            values: <b>{valuesPhrase()}</b>,
          })}
        </p>
      </div>

      <h2 class="section-title">{t('home.daily')}</h2>
      <ul class="dailies">
        {dailies.map((g) => {
          const done = g.daily!.done(day);
          const streak = g.daily!.streak();
          return (
            <li>
              <a class={`daily ${done ? 'daily--done' : ''}`} href={href(g.path)}>
                <span class="daily__icon" aria-hidden="true">
                  {g.icon}
                </span>
                <span class="daily__text">
                  <b>{t(`game.${g.id}.title`)}</b>
                  <small>{streak > 0 ? t('home.dailyStreak', { count: streak }) : t(`game.${g.id}.tag`)}</small>
                </span>
                <span class="daily__state">{done ? `✓ ${t('home.dailyDone')}` : `${t('home.dailyPlay')} →`}</span>
              </a>
            </li>
          );
        })}
      </ul>

      <h2 class="section-title">{t('home.allGames')}</h2>
      <ul class="cards">
        {GAME_LIST.map((g) => {
          const rec = record(g);
          return (
            <li>
              <a class={`card card--${g.id}`} href={href(g.path)}>
                <span class="card__icon" aria-hidden="true">
                  {g.icon}
                </span>
                <span class="card__tag">{t(`game.${g.id}.tag`)}</span>
                <h2>{t(`game.${g.id}.title`)}</h2>
                <p>{t(`game.${g.id}.blurb`)}</p>
                <span class="card__foot">
                  <span class="card__go" aria-hidden="true">
                    {t('home.play')}
                  </span>
                  {rec && <span class="card__best">{rec}</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
