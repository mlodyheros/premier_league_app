import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PlayerCard } from '../../components/PlayerCard';
import { useDataset } from '../../data/store';
import type { Player } from '../../data/types';
import { shareValues, valueOf, valueSource, valuesPhrase } from '../../data/valueSource';
import { t, tj } from '../../i18n';
import { shareNote } from '../../i18n/labels';
import { formatEur } from '../../lib/format';
import { trackEvent } from '../../lib/analytics';
import { getBest, submitBest } from '../../lib/records';
import { pick } from '../../lib/rng';
import { shareText, siteUrl } from '../../lib/share';
import { isCorrect, nextChallenger, pool, type Call } from './logic';

const REVEAL_MS = 1100;
const RECENT = 40;

type Phase = 'ask' | 'reveal' | 'over';

export function HigherLower() {
  const { players } = useDataset();
  const source = valueSource.value;
  const candidates = useMemo(() => pool(players), [players]);
  const recent = useRef<number[]>([]);

  const [current, setCurrent] = useState<Player>(() => pick(candidates));
  const [challenger, setChallenger] = useState<Player>(() =>
    nextChallenger(current, candidates, source, 0, new Set()),
  );
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [lastCall, setLastCall] = useState<{ call: Call; right: boolean } | null>(null);
  const [best, setBest] = useState(() => getBest(`hl:${source}`) ?? 0);
  const [newBest, setNewBest] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => setBest(getBest(`hl:${source}`) ?? 0), [source]);

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
        const isNew = submitBest(`hl:${source}`, streak);
        trackEvent(`hl/${source}/streak-${streak < 10 ? streak : Math.floor(streak / 5) * 5}`);
        setNewBest(isNew && streak > 0);
        setBest(getBest(`hl:${source}`) ?? 0);
        setPhase('over');
      }, REVEAL_MS);
    }
  }

  function restart() {
    const first = pick(candidates);
    recent.current = [];
    setCurrent(first);
    setChallenger(nextChallenger(first, candidates, source, 0, new Set()));
    setStreak(0);
    setLastCall(null);
    setNewBest(false);
    setNote(null);
    setPhase('ask');
  }

  async function share() {
    const head = t('hl.share', { n: streak, icon: streak >= 10 ? '🔥' : '⚽', values: shareValues(source) });
    setNote(shareNote(await shareText(`${head}\n${siteUrl()}#/higher-lower`)));
  }

  const revealed = phase !== 'ask';

  return (
    <section class="game hl">
      <div class="game__head">
        <h1>{t('game.hl.title')}</h1>
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
      </div>
      <p class="lede">
        {tj('hl.lede', { values: <b>{valuesPhrase(source)}</b> })}
      </p>

      <div class="hl__pair">
        <PlayerCard player={current}>
          <p class="hl__value">{formatEur(valueOf(current, source))}</p>
        </PlayerCard>

        <div class="hl__vs" aria-hidden="true">
          {t('hl.vs')}
        </div>

        <PlayerCard player={challenger}>
          {revealed ? (
            <p class={`hl__value ${lastCall?.right ? 'good' : 'bad'}`}>
              {formatEur(valueOf(challenger, source))}
              <span class="hl__verdict">{lastCall?.right ? '✓' : '✗'}</span>
            </p>
          ) : (
            <div class="hl__buttons">
              <button class="btn btn--primary" onClick={() => call('higher')}>
                {t('hl.higher')}
              </button>
              <button class="btn btn--magenta" onClick={() => call('lower')}>
                {t('hl.lower')}
              </button>
            </div>
          )}
        </PlayerCard>
      </div>

      {phase === 'over' && (
        <div class="end end--lose">
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
          {note && <p class="end__note" role="status">{note}</p>}
        </div>
      )}
    </section>
  );
}
