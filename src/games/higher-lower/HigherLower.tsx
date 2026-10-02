import { GameHeader, OtherGames } from '../../components/GameHeader';
import { useRevealWhen } from '../../hooks/useRevealWhen';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PlayerCard } from '../../components/PlayerCard';
import { useDataset } from '../../data/store';
import type { Player } from '../../data/types';
import { shareValues, valueOf, valueSource, valuesPhrase } from '../../data/valueSource';
import { t, tj } from '../../i18n';
import { formatEur } from '../../lib/format';
import { useCountUp } from '../../hooks/useCountUp';
import { trackEvent } from '../../lib/analytics';
import { buzz, celebrate } from '../../lib/motion';
import { getBest, submitBest } from '../../lib/records';
import { pick } from '../../lib/rng';
import { shareText, shareUrl } from '../../lib/share';
import { notifyShare } from '../../components/Toast';
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

  async function share() {
    const themeName = theme === 'all' ? '' : ` (${t(`hl.theme.${theme}`)})`;
    const head = t('hl.share', { n: streak, icon: streak >= 10 ? '🔥' : '⚽', values: shareValues(source) }) + themeName;
    notifyShare(await shareText(`${head}\n${shareUrl('higher-lower')}`));
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

      <div class="hl__pair" key={current.id}>
        <PlayerCard player={current}>
          <p class="hl__value">{formatEur(valueOf(current, source))}</p>
        </PlayerCard>

        <div class="hl__vs" aria-hidden="true">
          {t('hl.vs')}
        </div>

        <PlayerCard player={challenger}>
          {revealed ? (
            <RevealValue value={valueOf(challenger, source)} right={!!lastCall?.right} />
          ) : (
            <p class="hl__question">{t('hl.question', { a: current.name })}</p>
          )}
        </PlayerCard>

        {!revealed && (
          <div class="hl__buttons action-bar">
            <button class="btn btn--primary btn--big" onClick={() => call('higher')}>
              {t('hl.higher')}
            </button>
            <button class="btn btn--accent btn--big" onClick={() => call('lower')}>
              {t('hl.lower')}
            </button>
          </div>
        )}
      </div>

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
