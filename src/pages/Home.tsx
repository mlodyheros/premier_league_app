import { useState } from 'preact/hooks';
import { cardFooter } from '../lib/shareSpecs';
import { openShare } from '../components/ShareSheet';
import { Icon } from '../components/Icon';
import { Crest } from '../components/Avatar';
import { useDataset } from '../data/store';
import { valuesPhrase, valueSource } from '../data/valueSource';
import { GAME_LIST, type GameMeta } from '../games/meta';
import { t, tj, type Key } from '../i18n';
import { formatDecimal, formatEur, formatPct } from '../lib/format';
import { getBest } from '../lib/records';
import { dailyResult, dayNumber } from '../lib/daily';
import { todayKey } from '../lib/rng';
import { siteUrl } from '../lib/share';
import { useCountdown } from '../hooks/useCountdown';
import { useHistory } from '../data/history';
import { dayScore, friends, leagueLink, myCard, myName } from '../lib/friends';
import { GamesFormation, type Spot } from '../components/GamesFormation';
import { weeklyMoves } from '../lib/market';
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
    case 'transfer': {
      const v = getBest(`transfer:${src}`);
      return v === null ? null : t('home.best.transfer', { n: v > 0 ? `+${v}` : String(v) });
    }
  }
}

export function Home() {
  const { meta, players } = useDataset();
  const h = useHistory();
  const moves = h ? weeklyMoves(h, players, 'model', 1) : null;
  const [day] = useState(todayKey);
  const dailies = GAME_LIST.filter((g) => g.daily);
  const allDone = dailies.every((g) => g.daily!.done(day));
  const countdown = useCountdown(allDone);
  const game = (id: GameMeta['id']) => GAME_LIST.find((g) => g.id === id)!;
  const name = myName();
  const today = dayScore(myCard(day), day);

  /** A daily round's spot: still to play, or today's result. */
  const daily = (id: GameMeta['id'], x: number, y: number): Spot => {
    const g = game(id);
    const done = g.daily!.done(day);
    const streak = g.daily!.streak();
    return {
      x,
      y,
      w: 30,
      path: g.path,
      icon: g.icon,
      title: t(`game.${id}.title`),
      state: done ? 'done' : 'todo',
      note: done ? `✓ ${dailyResult(id, day) ?? t('home.dailyDone')}` : streak > 0 ? t('home.dailyStreak', { count: streak }) : t('home.dailyPlay'),
    };
  };
  const play = (id: GameMeta['id'], x: number, y: number, w = 23): Spot => {
    const g = game(id);
    return { x, y, w, path: g.path, icon: g.icon, title: t(`game.${id}.title`), note: record(g) ?? t(`game.${id}.tag`) };
  };
  const spots: Spot[] = [
    // Attack: today's three daily rounds.
    daily('guess', 17, 17),
    daily('beat', 50, 14),
    daily('price', 83, 17),
    // Midfield: the squad games.
    play('budget', 17, 41, 30),
    play('road', 50, 44, 30),
    play('transfer', 83, 41, 30),
    // Defence: the rest.
    play('hl', 12, 66),
    { x: 37.5, y: 69, path: 'market', icon: 'chart-line', title: t('nav.market'), note: t('home.spot.market') },
    { x: 62.5, y: 69, path: 'league', icon: 'trophy', title: t('nav.league'), note: t('home.spot.league', { count: friends().length }) },
    { x: 88, y: 66, path: 'stats', icon: 'users', title: t('nav.players'), note: t('home.spot.players', { n: players.length }) },
    // In goal: you.
    {
      x: 50,
      y: 90,
      path: 'league',
      icon: 'user-circle',
      title: name || t('home.spot.you'),
      note: today === null ? t('home.spot.youNote') : t('home.spot.today', { n: today }),
      keeper: true,
    },
  ];

  /** One message with all three of today's results. */
  function shareAll() {
    const lines = dailies.map((g) => `${g.emoji} ${t(`game.${g.id}.title`)}: ${dailyResult(g.id, day) ?? '✓'}`);
    // With a nickname set, the link also adds you to the reader's friends league.
    const link = myName() ? leagueLink(myCard(day)) : siteUrl();
    const score = dayScore(myCard(day), day);
    openShare(
      {
        game: t('home.cardTitle'),
        kicker: t('mode.daily', { n: dayNumber(day) }),
        headline: score === null ? '✓' : `${score}/100`,
        sub: myName() || undefined,
        tiles: dailies.map((g) => {
          const result = dailyResult(g.id, day) ?? '✓';
          const [n, max] = result.split('/');
          const share = n === 'X' ? 0 : Number(n) / Number(max);
          const ratio = g.id === 'guess' && n !== 'X' ? (Number(max) + 1 - Number(n)) / Number(max) : share;
          return { label: t(`game.${g.id}.title`), value: result, cell: ratio >= 0.7 ? 'good' : ratio >= 0.4 ? 'mid' : 'bad' } as const;
        }),
        ...cardFooter(),
      },
      `${t('home.shareAll', { n: dayNumber(day) })}\n${lines.join('\n')}\n${link}`,
      'pl-games-daily',
    );
  }

  return (
    <section class="home">
      <div class="hero">
        <nav class="crest-row" aria-label={t('home.crests')}>
          {Object.keys(meta.clubs).map((code) => (
            <a
              href={`${href('stats')}?club=${code}`}
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
      </div>

      <GamesFormation spots={spots} label={t('home.allGames')} />

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

      <div class="home__about">
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

      {moves && moves.risers[0] && moves.fallers[0] && (
        <a class="market-tile" href={href('market')}>
          <b>
            <Icon name="chart-line" /> {t('home.market')} →
          </b>
          <span>
            {tj('home.marketUp', { name: moves.risers[0].player.name, pct: <em class="up">{formatPct(moves.risers[0].change)}</em> })}
          </span>
          <span>
            {tj('home.marketDown', { name: moves.fallers[0].player.name, pct: <em class="down">{formatPct(moves.fallers[0].change)}</em> })}
          </span>
        </a>
      )}

    </section>
  );
}
