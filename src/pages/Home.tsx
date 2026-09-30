import { useDataset } from '../data/store';
import { valuesPhrase } from '../data/valueSource';
import { t, tj, type Key } from '../i18n';
import { formatDecimal, formatEur } from '../lib/format';
import { getBest } from '../lib/records';
import { loadStats } from '../lib/stats';
import { valueSource } from '../data/valueSource';
import { href } from '../router';

interface GameCard {
  path: string;
  id: 'guess' | 'road' | 'hl' | 'budget' | 'beat' | 'price';
  /** Personal best to show on the card, if any. */
  best: () => string | null;
}

function best(key: string, label: Key, digits = 0, extra: Record<string, string> = {}) {
  const v = getBest(key);
  return v === null ? null : t(label, { n: digits ? formatDecimal(v, digits) : String(v), ...extra });
}

export const GAMES: GameCard[] = [
  {
    path: 'guess',
    id: 'guess',
    best: () => {
      const s = loadStats('guess-daily', 8);
      return s.played ? t('home.best.guess', { n: s.streak }) : null;
    },
  },
  { path: 'road38', id: 'road', best: () => best(`road:pts:${valueSource.value}`, 'home.best.road') },
  { path: 'higher-lower', id: 'hl', best: () => best(`hl:${valueSource.value}`, 'home.best.hl') },
  {
    path: 'budget',
    id: 'budget',
    best: () => best(`budget:300000000:${valueSource.value}`, 'home.best.budget', 1, { budget: formatEur(300_000_000) }),
  },
  { path: 'beat-model', id: 'beat', best: () => best('beat-model', 'home.best.beat') },
  { path: 'price-tag', id: 'price', best: () => best(`price-tag:${valueSource.value}`, 'home.best.price') },
];

export function Home() {
  const { meta } = useDataset();
  return (
    <section class="home">
      <div class="hero">
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
      <ul class="cards">
        {GAMES.map((g) => {
          const record = g.best();
          return (
            <li>
              <a class="card" href={href(g.path)}>
                <span class="card__tag">{t(`game.${g.id}.tag`)}</span>
                <h2>{t(`game.${g.id}.title`)}</h2>
                <p>{t(`game.${g.id}.blurb`)}</p>
                <span class="card__foot">
                  <span class="card__go" aria-hidden="true">
                    {t('home.play')}
                  </span>
                  {record && <span class="card__best">{record}</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
