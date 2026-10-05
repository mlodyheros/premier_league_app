import { GameHeader, OtherGames } from '../../components/GameHeader';
import { cardFooter } from '../../lib/shareSpecs';
import { openShare } from '../../components/ShareSheet';
import { useRevealWhen } from '../../hooks/useRevealWhen';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Avatar, Crest } from '../../components/Avatar';
import { Flag } from '../../components/Flag';
import { countryName } from '../../i18n/countries';
import { posLabel } from '../../i18n/labels';
import { useDataset } from '../../data/store';
import type { Player } from '../../data/types';
import { shareValues, valueOf, valueSource, valuesPhrase } from '../../data/valueSource';
import { t, tj } from '../../i18n';
import { formatEur, formatInt } from '../../lib/format';
import { useCountUp } from '../../hooks/useCountUp';
import { trackEvent } from '../../lib/analytics';
import { buzz, celebrate } from '../../lib/motion';
import { getBest, submitBest } from '../../lib/records';
import { pick } from '../../lib/rng';
import { shareUrl } from '../../lib/share';
import { Chips } from '../../components/Chips';
import { PoolNote } from '../../components/PoolNote';
import { poolLevel } from '../../lib/pools';
import { readJson, writeJson } from '../../lib/storage';
import { isCorrect, nextChallenger, pool, THEMES, type Call, type Theme } from './logic';

/** Long enough for the value to count up and the verdict to land. */
const REVEAL_MS = 1300;
const COUNT_MS = 650;
const RECENT = 40;

type Phase = 'ask' | 'reveal' | 'over';

export function HigherLower() {
  const { players } = useDataset();
  const source = valueSource.value;
  const [theme, setTheme] = useState<Theme>(() => readJson<Theme>('hlTheme') ?? 'all');
  const level = poolLevel.value;
  const candidates = useMemo(() => pool(players, level, theme), [players, level, theme]);
  /** Records are kept per theme: a goalkeepers-only streak is a different game. */
  const bestKey = theme === 'all' ? `hl:${source}` : `hl:${source}:${theme}`;
  const recent = useRef<number[]>([]);

  const [current, setCurrent] = useState<Player>(() => pick(candidates));
  const [challenger, setChallenger] = useState<Player>(() =>
    nextChallenger(current, candidates, source, 0, new Set()),
  );
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [lastCall, setLastCall] = useState<{ call: Call; right: boolean } | null>(null);
  const [best, setBest] = useState(() => getBest(bestKey) ?? 0);
  const [newBest, setNewBest] = useState(false);

  useEffect(() => setBest(getBest(bestKey) ?? 0), [bestKey]);

  // A value-source switch can make the pair tie; draw a new challenger if so.
  useEffect(() => {
    if (phase === 'ask' && valueOf(current, source) === valueOf(challenger, source)) {
      setChallenger(nextChallenger(current, candidates, source, streak, new Set(recent.current)));
    }
  }, [source]);

  function remember(p: Player) {
    recent.current = [...recent.current, p.id].slice(-RECENT);
  }

  function call(c: Call) {
    if (phase !== 'ask') return;
    const right = isCorrect(current, challenger, c, source);
    setLastCall({ call: c, right });
    setPhase('reveal');
    setTimeout(() => buzz(right ? 'good' : 'bad'), COUNT_MS);
    if (right) {
      const next = streak + 1;
      setStreak(next);
      setTimeout(() => {
        remember(current);
        setCurrent(challenger);
        setChallenger(nextChallenger(challenger, candidates, source, next, new Set(recent.current)));
        setLastCall(null);
        setPhase('ask');
      }, REVEAL_MS);
    } else {
      setTimeout(() => {
        const isNew = submitBest(bestKey, streak);
        trackEvent(`hl/${source}/${theme}/streak-${streak < 10 ? streak : Math.floor(streak / 5) * 5}`);
        setNewBest(isNew && streak > 0);
        if (isNew && streak >= 5) celebrate(streak >= 15);
        setBest(getBest(bestKey) ?? 0);
        setPhase('over');
      }, REVEAL_MS);
    }
  }

  // A new theme or level means a new pool: start over from it.
  useEffect(() => {
    if (!candidates.some((p) => p.id === current.id)) restart();
  }, [candidates]);

  function chooseTheme(next: Theme) {
    setTheme(next);
    writeJson('hlTheme', next);
  }

  function restart() {
    const first = pick(candidates);
    recent.current = [];
    setCurrent(first);
    setChallenger(nextChallenger(first, candidates, source, 0, new Set()));
    setStreak(0);
    setLastCall(null);
    setNewBest(false);
    setPhase('ask');
  }

  function share() {
    const themeName = theme === 'all' ? '' : ` (${t(`hl.theme.${theme}`)})`;
    const head = t('hl.share', { n: streak, icon: streak >= 10 ? '🔥' : '⚽', values: shareValues(source) }) + themeName;
    openShare(
      {
        game: t('game.hl.title'),
        kicker: t(`hl.theme.${theme}`),
        headline: String(streak),
        sub: t('hl.cardSub', { best }),
        ...cardFooter(),
      },
      `${head}\n${shareUrl('higher-lower')}`,
      'pl-games-higher-or-lower',
    );
  }

  const revealed = phase !== 'ask';
  const endRef = useRevealWhen(phase === 'over');

  return (
    <section class="game hl">
      <GameHeader
        game="hl"
        score={
          <div class="scorebug" aria-live="polite">
            <span>
              <small>{t('common.streak')}</small>
              <b>{streak}</b>
            </span>
            <span>
              <small>{t('common.best')}</small>
              <b>{best}</b>
            </span>
          </div>
        }
      >
        <p>
          {tj('hl.lede', { values: <b>{valuesPhrase(source)}</b> })}
        </p>
      </GameHeader>

      {(streak === 0 || phase === 'over') && (
        <>
          <Chips
            label={t('hl.theme')}
            options={THEMES}
            value={theme}
            onChange={chooseTheme}
            name={(o) => t(`hl.theme.${o}`)}
            disabled={phase === 'reveal'}
          />
          <PoolNote />
        </>
      )}

      <div class="hl__duel" key={current.id}>
        <Side player={current}>
          <p class="hl__value">{formatEur(valueOf(current, source))}</p>
        </Side>
        <span class="hl__vs" aria-hidden="true">
          {t('hl.vs')}
        </span>
        <Side player={challenger}>
          {revealed ? (
            <RevealValue value={valueOf(challenger, source)} right={!!lastCall?.right} />
          ) : (
            <p class="hl__value hl__value--hidden" aria-label={t('hl.hidden')}>
              ?
            </p>
          )}
        </Side>
      </div>

      <p class="hl__question" aria-live="polite">
        {tj('hl.question', { a: <b>{current.short || current.name}</b>, b: <b>{challenger.short || challenger.name}</b> })}
      </p>

      <Compare a={current} b={challenger} />

      {!revealed && (
        <>
          <div class="hl__buttons action-bar">
            <button class="btn btn--primary btn--big" onClick={() => call('higher')}>
              {t('hl.higher')}
            </button>
            <button class="btn btn--accent btn--big" onClick={() => call('lower')}>
              {t('hl.lower')}
            </button>
          </div>
        </>
      )}

      {phase === 'over' && (
        <div class="end end--lose" ref={endRef}>
          <p class="end__title">{newBest ? t('common.newBest') : t('common.gameOver')}</p>
          <p class="end__note">
            {tj('hl.over', {
              b: challenger.name,
              bv: formatEur(valueOf(challenger, source)),
              a: current.name,
              av: formatEur(valueOf(current, source)),
              streak: <b>{streak}</b>,
            })}
          </p>
          <div class="end__actions">
            <button class="btn btn--primary" onClick={restart}>
              {t('common.playAgain')}
            </button>
            <button class="btn" onClick={share}>
              {t('common.share')}
            </button>
          </div>
        </div>
      )}
      <OtherGames current="hl" />
    </section>
  );
}

/** One player of the pair: who he is, at a glance, and his value (or "?"). */
function Side({ player: p, children }: { player: Player; children: preact.ComponentChildren }) {
  const { meta } = useDataset();
  return (
    <article class="hl__side">
      <Avatar player={p} size={64} />
      <h3 class="hl__name">{p.name}</h3>
      <p class="hl__meta">
        <Crest code={p.club} size={16} /> {meta.clubs[p.club].short}
      </p>
      <p class="hl__meta">
        {posLabel(p.pos)} · <Flag flag={p.flag} title={countryName(p.nat)} /> · {t('hl.age', { n: p.age })}
      </p>
      {children}
    </article>
  );
}

/** Their records side by side, row by row: the clues for the call. */
function Compare({ a, b }: { a: Player; b: Player }) {
  const keeper = a.pos === 'GK' && b.pos === 'GK';
  const rows: [string, (p: Player) => number][] = [
    [t('hl.row.minutes'), (p) => p.stats.minutes],
    ...(keeper
      ? ([[t('stat.cleanSheets'), (p: Player) => p.stats.cleanSheets]] as [string, (p: Player) => number][])
      : ([
          [t('stat.goals'), (p: Player) => p.stats.goals],
          [t('stat.assists'), (p: Player) => p.stats.assists],
        ] as [string, (p: Player) => number][])),
    [t('hl.row.plStarts'), (p) => p.stats.plStarts],
    [t('hl.row.plGa'), (p) => p.stats.plGoals + p.stats.plAssists],
  ];
  return (
    <table class="hl__compare">
      <caption class="sr-only">{t('hl.compare')}</caption>
      <thead>
        <tr>
          <th>{a.short || a.name}</th>
          <th aria-hidden="true" />
          <th>{b.short || b.name}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, get]) => {
          const x = get(a);
          const y = get(b);
          return (
            <tr>
              <td class={x > y ? 'more' : ''}>{formatInt(x)}</td>
              <th scope="row">{label}</th>
              <td class={y > x ? 'more' : ''}>{formatInt(y)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The hidden value counts up from zero, then the verdict lands. */
function RevealValue({ value, right }: { value: number; right: boolean }) {
  const shown = useCountUp(value, true, COUNT_MS);
  const done = shown === value;
  return (
    <p class={`hl__value ${done ? (right ? 'good' : 'bad') : 'counting'}`}>
      {formatEur(shown)}
      {done && <span class="hl__verdict">{right ? '✓' : '✗'}</span>}
    </p>
  );
}
