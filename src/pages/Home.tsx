import { useState } from 'preact/hooks';
import { Crest } from '../components/Avatar';
import { useDataset } from '../data/store';
import { valuesPhrase, valueSource } from '../data/valueSource';
import { GAME_LIST, type GameMeta } from '../games/meta';
import { t, tj, type Key } from '../i18n';
import { formatDecimal, formatEur } from '../lib/format';
import { getBest } from '../lib/records';
import { dailyResult, dayNumber } from '../lib/daily';
import { todayKey } from '../lib/rng';
import { shareText, siteUrl } from '../lib/share';
import { useCountdown } from '../hooks/useCountdown';
import { notifyShare } from '../components/Toast';
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
  const allDone = dailies.every((g) => g.daily!.done(day));
  const countdown = useCountdown(allDone);

  /** One message with all three of today's results. */
  async function shareAll() {
    const lines = dailies.map((g) => `${g.icon} ${t(`game.${g.id}.title`)}: ${dailyResult(g.id, day) ?? '✓'}`);
    notifyShare(await shareText(`${t('home.shareAll', { n: dayNumber(day) })}\n${lines.join('\n')}\n${siteUrl()}`));
  }

  return (
    <section class="home">
      <div class="hero">
        <nav class="crest-row" aria-label={t('home.crests')}>
          {Object.keys(meta.clubs).map((code) => (
            <a
              href={`${href('budget')}?club=${code}`}
              title={t('home.crestLink', { club: meta.clubs[code].name })}
              aria-label={t('home.crestLink', { club: meta.clubs[code].name })}
            >
              <Crest code={code} size={28} />
            </a>
          ))}
        </nav>
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
        <p class="hero__note">
          <a href={href('how')}>{t('home.tmNoteLink')}</a>
        </p>
      </div>

      <h2 class="section-title">{t('home.daily')}</h2>
      {allDone && (
        <div class="all-done" role="status">
          <p>
            <b>{t('home.allDone')}</b> {tj('home.allDoneNext', { time: <b class="mono">{countdown}</b> })}
          </p>
          <button class="btn btn--primary btn--sm" onClick={shareAll}>
            {t('home.shareAllButton')}
          </button>
        </div>
      )}
      <ul class="dailies">
        {dailies.map((g) => {
          const done = g.daily!.done(day);
          const streak = g.daily!.streak();
          const result = done ? dailyResult(g.id, day) : null;
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
                <span class="daily__state">
                  {done ? (result ? <>✓ <b>{result}</b></> : `✓ ${t('home.dailyDone')}`) : `${t('home.dailyPlay')} →`}
                </span>
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
