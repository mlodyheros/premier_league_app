import { useMemo } from 'preact/hooks';
import { PlayerCard } from '../components/PlayerCard';
import { ValueCompare } from '../components/ValueCompare';
import { useDataset } from '../data/store';
import type { Player } from '../data/types';
import { modelGap } from '../data/valueSource';
import { modelNotes } from '../games/beat-model/logic';
import { t, tj, type Key } from '../i18n';
import { formatDate, formatDecimal, formatEur } from '../lib/format';
import { BASE_GOALS, HOME_ADVANTAGE, K_DOWN, K_UP } from '../lib/season';
import { FIT, SQUAD_DEPTH } from '../lib/strength';

/** Players shown as examples of disagreement must be worth at least this much. */
const EXAMPLE_MIN_VALUE = 15_000_000;
const EXAMPLES = 4;

const SECTIONS: { id: string; title: Key }[] = [
  { id: 'data', title: 'how.data.title' },
  { id: 'model', title: 'how.model.title' },
  { id: 'accuracy', title: 'how.acc.title' },
  { id: 'limits', title: 'how.limits.title' },
  { id: 'disagree', title: 'how.disagree.title' },
  { id: 'games', title: 'how.games.title' },
  { id: 'simulation', title: 'how.sim.title' },
  { id: 'credits', title: 'how.credits.title' },
];

const FEATURES: [Key, Key][] = [
  ['how.f.age', 'how.f.ageBody'],
  ['how.f.minutes', 'how.f.minutesBody'],
  ['how.f.output', 'how.f.outputBody'],
  ['how.f.europe', 'how.f.europeBody'],
  ['how.f.price', 'how.f.priceBody'],
  ['how.f.context', 'how.f.contextBody'],
  ['how.f.known', 'how.f.knownBody'],
  ['how.f.where', 'how.f.whereBody'],
];

const GAME_NOTES: [Key, Key][] = [
  ['game.guess.title', 'how.games.guess'],
  ['game.hl.title', 'how.games.hl'],
  ['game.road.title', 'how.games.road'],
  ['game.budget.title', 'how.games.budget'],
  ['game.beat.title', 'how.games.beat'],
  ['game.price.title', 'how.games.price'],
];

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function HowItWorks() {
  const { players, meta } = useDataset();
  const m = meta.model;
  const d = m.diagnostics;
  const repo = (
    <a href={meta.source.url} target="_blank" rel="noopener">
      pl-value
    </a>
  );

  const { higher, lower, top } = useMemo(() => {
    const pool = players.filter((p) => p.tm >= EXAMPLE_MIN_VALUE).sort((a, b) => modelGap(b) - modelGap(a));
    return {
      higher: pool.slice(0, EXAMPLES),
      lower: pool.slice(-EXAMPLES).reverse(),
      top: players.reduce((a, b) => (b.tm > a.tm ? b : a)),
    };
  }, [players]);

  return (
    <article class="how prose">
      <h1>{t('how.title')}</h1>
      <p class="lede">
        {tj('how.intro', {
          players: meta.players,
          repo,
          date: formatDate(meta.dataDate),
          gw: meta.gameweek,
          season: meta.season,
        })}
      </p>

      <nav class="toc" aria-label={t('how.toc')}>
        <p>{t('how.toc')}</p>
        <ol>
          {SECTIONS.map((s) => (
            <li>
              <a href={`#/how`} onClick={(e) => jump(e, s.id)}>
                {t(s.title)}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section id="data">
        <h2>{t('how.data.title')}</h2>
        <p>{t('how.data.body')}</p>
      </section>

      <section id="model">
        <h2>{t('how.model.title')}</h2>
        <p>{t('how.model.body', { features: m.features })}</p>
        <h3>{t('how.features.title')}</h3>
        <dl class="features">
          {FEATURES.map(([k, body]) => (
            <div>
              <dt>{t(k)}</dt>
              <dd>{t(body)}</dd>
            </div>
          ))}
        </dl>
        <h3>{t('how.train.title')}</h3>
        <ul>
          <li>{t('how.train.log')}</li>
          <li>{t('how.train.weights')}</li>
          <li>{t('how.train.linear')}</li>
          <li>{t('how.train.oof')}</li>
        </ul>
      </section>

      <section id="accuracy">
        <h2>{t('how.acc.title')}</h2>
        <dl class="tiles">
          <Tile value={formatDecimal(m.cvR2Log, 2)} label={t('how.acc.r2')} />
          <Tile value={formatEur(m.cvMaeEur)} label={t('how.acc.mae')} />
          <Tile value={pct(d.typicalMiss)} label={t('how.acc.typical')} />
          <Tile value={formatEur(m.cvTopDecileMaeEur)} label={t('how.acc.top')} />
          <Tile value={`${d.inRange}/${meta.players}`} label={t('how.acc.range')} />
        </dl>
        <p>{t('how.acc.body', { inRange: d.inRange, players: meta.players })}</p>
      </section>

      <section id="limits">
        <h2>{t('how.limits.title')}</h2>
        <ul>
          <li>
            {t('how.limits.shrink', { under: formatDecimal(d.ratioUnder5m, 2), over: formatDecimal(d.ratioOver20m, 2) })}
          </li>
          <li>{t('how.limits.top', { name: top.name, tm: formatEur(top.tm), model: formatEur(top.model) })}</li>
          <li>
            {t('how.limits.noRecord', {
              n: m.tiers['2']?.players ?? 0,
              nr: pct(d.typicalMissNoRecord),
              wr: pct(d.typicalMissWithRecord),
            })}
          </li>
          <li>{t('how.limits.blind')}</li>
          <li>{t('how.limits.market')}</li>
          <li>{t('how.limits.early')}</li>
        </ul>
      </section>

      <section id="disagree">
        <h2>{t('how.disagree.title')}</h2>
        <p>{t('how.disagree.body')}</p>
        <div class="examples">
          <Examples title={t('how.disagree.higher')} players={higher} gameweek={meta.gameweek} />
          <Examples title={t('how.disagree.lower')} players={lower} gameweek={meta.gameweek} />
        </div>
      </section>

      <section id="games">
        <h2>{t('how.games.title')}</h2>
        <dl class="features">
          {GAME_NOTES.map(([title, body]) => (
            <div>
              <dt>{t(title)}</dt>
              <dd>{t(body)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="simulation">
        <h2>{t('how.sim.title')}</h2>
        <p>{t('how.sim.rating')}</p>
        <p>
          {t('how.sim.fit', {
            winger: Math.round((FIT.ST.LW ?? 0) * 100),
            cb: Math.round((FIT.LB.CB ?? 0) * 100),
          })}
        </p>
        <p>{t('how.sim.strength', { depth: SQUAD_DEPTH })}</p>
        <p>
          {t('how.sim.match', {
            base: formatDecimal(BASE_GOALS, 2),
            home: formatDecimal(HOME_ADVANTAGE, 2),
            up: formatDecimal(K_UP * 100, 1),
            down: formatDecimal(K_DOWN * 100, 1),
          })}
        </p>
        <p>{t('how.sim.odds')}</p>
      </section>

      <section id="credits">
        <h2>{t('how.credits.title')}</h2>
        <p>{tj('how.credits.body', { repo })}</p>
      </section>
    </article>
  );
}

/** Hash routing owns the URL fragment, so in-page links scroll by hand. */
function jump(e: Event, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Examples({ title, players, gameweek }: { title: string; players: Player[]; gameweek: number }) {
  return (
    <div class="examples__col">
      <h3>{title}</h3>
      {players.map((p) => (
        <PlayerCard player={p} compact>
          <ValueCompare player={p} range />
          <ul class="bm__notes">
            {modelNotes(p, gameweek).map((n) => (
              <li>{t(n.key, n.params)}</li>
            ))}
          </ul>
        </PlayerCard>
      ))}
    </div>
  );
}
