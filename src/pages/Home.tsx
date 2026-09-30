import { useDataset } from '../data/store';
import { SOURCE_LABEL, valueSource } from '../data/valueSource';
import { getBest } from '../lib/records';
import { loadStats } from '../lib/stats';
import { href } from '../router';

interface GameCard {
  path: string;
  title: string;
  blurb: string;
  tag: string;
  ready: boolean;
  /** Personal best to show on the card, if any. */
  best?: () => string | null;
}

const fmt = (key: string, suffix = '', digits = 0) => () => {
  const v = getBest(key);
  return v === null ? null : `Best ${v.toFixed(digits)}${suffix}`;
};

export const GAMES: GameCard[] = [
  {
    path: 'guess',
    title: 'Guess the Player',
    blurb: 'Wordle for the Premier League. Club, position, nationality, age and value clues.',
    tag: 'Daily',
    ready: true,
    best: () => {
      const s = loadStats('guess-daily', 8);
      return s.played ? `Daily streak: ${s.streak}` : null;
    },
  },
  {
    path: 'road38',
    title: 'Road to 38-0',
    blurb: 'Spin a club, pick a player, fill your XI, then simulate a whole season.',
    tag: 'Squad',
    ready: true,
    best: () => fmt(`road:pts:${valueSource.value}`, ' pts')(),
  },
  {
    path: 'higher-lower',
    title: 'Higher or Lower',
    blurb: 'Two players. Who is worth more? Keep the streak alive.',
    tag: 'Streak',
    ready: true,
    best: () => fmt(`hl:${valueSource.value}`, ' streak')(),
  },
  {
    path: 'budget',
    title: 'Budget XI',
    blurb: 'Build the strongest XI you can without breaking the bank.',
    tag: 'Squad',
    ready: true,
    best: () => fmt(`budget:300000000:${valueSource.value}`, ' OVR (€300M)', 1)(),
  },
  {
    path: 'beat-model',
    title: 'Beat the Model',
    blurb: 'Does the model rate this player above or below Transfermarkt?',
    tag: 'Model',
    ready: true,
    best: fmt('beat-model', '/10'),
  },
  {
    path: 'price-tag',
    title: 'Price Tag',
    blurb: 'Slide to the price you think a player is worth. Closer is better.',
    tag: 'Value',
    ready: true,
    best: () => fmt(`price-tag:${valueSource.value}`, '/500')(),
  },
];

export function Home() {
  const { meta } = useDataset();
  return (
    <section class="home">
      <div class="hero">
        <p class="eyebrow">
          {meta.season} season · {meta.players} players · GW{meta.gameweek}
        </p>
        <h1>
          Premier League games, <em>priced by data.</em>
        </h1>
        <p class="lede">
          Every game runs on real squad data and two prices for each player: Transfermarkt's market
          value, and an estimate from a machine-learning model. Switch between them with the{' '}
          <b>TM / Model</b> toggle at the top. You're using <b>{SOURCE_LABEL[valueSource.value]}</b>{' '}
          values.
        </p>
      </div>
      <ul class="cards">
        {GAMES.map((g) => (
          <li>
            {g.ready ? (
              <a class="card" href={href(g.path)}>
                <CardBody g={g} />
              </a>
            ) : (
              <div class="card card--soon" aria-disabled="true">
                <CardBody g={g} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CardBody({ g }: { g: GameCard }) {
  return (
    <>
      <span class="card__tag">{g.ready ? g.tag : 'Coming soon'}</span>
      <h2>{g.title}</h2>
      <p>{g.blurb}</p>
      <span class="card__foot">
        {g.ready && <span class="card__go" aria-hidden="true">Play →</span>}
        {g.best?.() && <span class="card__best">{g.best()}</span>}
      </span>
    </>
  );
}
