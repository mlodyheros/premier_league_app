import { useEffect, useMemo, useState } from 'preact/hooks';
import { DailyDone, ModeTabs } from '../../components/ModeTabs';
import { PlayerCard } from '../../components/PlayerCard';
import { ValueCompare } from '../../components/ValueCompare';
import { useCountdown } from '../../hooks/useCountdown';
import { useDataset } from '../../data/store';
import type { Player } from '../../data/types';
import { shareValues, valueOf, valuePhrase, valueSource, valuesPhrase, type ValueSource } from '../../data/valueSource';
import { t, tj } from '../../i18n';
import { shareNote } from '../../i18n/labels';
import { trackEvent } from '../../lib/analytics';
import { dailyRand, dailyStreak, recordDaily, type Mode } from '../../lib/daily';
import { formatEur, formatPct } from '../../lib/format';
import { getBest, submitBest } from '../../lib/records';
import { dayNumber, shuffled, todayKey } from '../../lib/rng';
import { shareText, siteUrl } from '../../lib/share';
import { readJson, writeJson } from '../../lib/storage';
import { emoji, eurToSlider, MAX_POINTS, pool, ROUNDS, score, sliderToEur } from './logic';

const GAME = 'price';
const START = eurToSlider(15_000_000);
const MODE_KEY = 'price:mode';
const dailyKey = (day: string) => `price:daily:${day}`;

/**
 * A round's progress. The value source is fixed when the round starts, so a
 * switch mid-round never re-scores earlier guesses.
 */
interface Progress {
  source: ValueSource;
  guesses: number[];
}

export function PriceTag() {
  const { players } = useDataset();
  const [day] = useState(todayKey);
  const [mode, setMode] = useState<Mode>(() => readJson<Mode>(MODE_KEY) ?? 'daily');
  const candidates = useMemo(() => pool(players), [players]);

  const dailyRound = useMemo(() => shuffled(candidates, dailyRand(GAME, day)).slice(0, ROUNDS), [candidates, day]);
  const [daily, setDaily] = useState<Progress>(
    () => readJson<Progress>(dailyKey(day)) ?? { source: valueSource.value, guesses: [] },
  );
  const [practiceRound, setPracticeRound] = useState(() => shuffled(candidates).slice(0, ROUNDS));
  const [practice, setPractice] = useState<Progress>({ source: valueSource.value, guesses: [] });

  function switchMode(m: Mode) {
    writeJson(MODE_KEY, m);
    setMode(m);
  }

  function saveDaily(p: Progress) {
    setDaily(p);
    writeJson(dailyKey(day), p);
  }

  function newPractice() {
    setPracticeRound(shuffled(candidates).slice(0, ROUNDS));
    setPractice({ source: valueSource.value, guesses: [] });
  }

  // A daily round that has not started yet follows the switch until the first guess.
  useEffect(() => {
    if (!daily.guesses.length && daily.source !== valueSource.value) setDaily({ source: valueSource.value, guesses: [] });
    if (!practice.guesses.length && practice.source !== valueSource.value)
      setPractice({ source: valueSource.value, guesses: [] });
  }, [valueSource.value]);

  const isDaily = mode === 'daily';
  return (
    <section class="game pt">
      <div class="game__head">
        <h1>{t('game.price.title')}</h1>
        <ModeTabs mode={mode} day={day} onChange={switchMode} />
      </div>
      <Round
        key={isDaily ? `daily-${day}` : `practice-${practiceRound.map((p) => p.id).join('-')}`}
        mode={mode}
        day={day}
        round={isDaily ? dailyRound : practiceRound}
        progress={isDaily ? daily : practice}
        onProgress={isDaily ? saveDaily : setPractice}
        onRestart={isDaily ? () => switchMode('practice') : newPractice}
      />
    </section>
  );
}

interface RoundProps {
  mode: Mode;
  day: string;
  round: Player[];
  progress: Progress;
  onProgress: (p: Progress) => void;
  onRestart: () => void;
}

function Round({ mode, day, round, progress, onProgress, onRestart }: RoundProps) {
  const { source, guesses } = progress;
  const [slider, setSlider] = useState(START);
  const [revealed, setRevealed] = useState(guesses.length > 0);
  const bestKey = `price-tag:${source}`;
  const [best, setBest] = useState(() => getBest(bestKey));
  const [newBest, setNewBest] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const finished = guesses.length === ROUNDS;
  const countdown = useCountdown(mode === 'daily' && finished);

  useEffect(() => setBest(getBest(bestKey)), [bestKey]);

  const index = revealed ? guesses.length - 1 : guesses.length;
  const player = round[Math.min(Math.max(index, 0), ROUNDS - 1)];
  const points = guesses.map((g, i) => score(g, valueOf(round[i], source)));
  const total = points.reduce((a, b) => a + b, 0);
  const guess = sliderToEur(slider);
  const switched = valueSource.value !== source && guesses.length > 0;

  function lockIn() {
    const next = [...guesses, guess];
    onProgress({ source, guesses: next });
    setRevealed(true);
    if (next.length === ROUNDS) {
      const sum = next.reduce((a, g, i) => a + score(g, valueOf(round[i], source)), 0);
      setNewBest(submitBest(bestKey, sum));
      setBest(getBest(bestKey));
      if (mode === 'daily') recordDaily(GAME, day);
      trackEvent(`price/${mode}/${source}/score-${Math.floor(sum / 50) * 50}`);
    }
  }

  function nextPlayer() {
    setRevealed(false);
    setSlider(START);
  }

  async function share() {
    const title = mode === 'daily' ? `${t('game.price.title')} #${dayNumber(day)}` : t('game.price.title');
    const head = `${title} ${total}/${ROUNDS * MAX_POINTS} · ${shareValues(source)}`;
    setNote(shareNote(await shareText(`${head}\n${points.map(emoji).join('')}\n${siteUrl()}#/price-tag`)));
  }

  const actual = valueOf(player, source);
  const lastPoints = revealed ? points[index] : null;

  return (
    <>
      <div class="scorebug scorebug--inline">
        <span>
          <small>{t('common.score')}</small>
          <b>{total}</b>
        </span>
        <span>
          <small>{t('common.best')}</small>
          <b>{best ?? '–'}</b>
        </span>
      </div>
      <p class="lede">{tj('pt.lede', { value: <b>{valuePhrase(source)}</b>, max: MAX_POINTS })}</p>
      {mode === 'practice' && <p class="mode-help">{t('mode.practiceHint')}</p>}

      {switched && !finished && <p class="notice-inline">{t('pt.locked', { values: valuesPhrase(source) })}</p>}

      <ol class="progress" aria-label={t('common.rounds')}>
        {Array.from({ length: ROUNDS }, (_, i) => (
          <li
            class={i < points.length ? (points[i] >= 60 ? 'ok' : points[i] >= 30 ? 'mid' : 'no') : i === index ? 'now' : ''}
          />
        ))}
      </ol>

      <PlayerCard player={player}>
        {!revealed ? (
          <div class="pt__guess">
            <output class="pt__amount" for="pt-slider">
              {formatEur(guess)}
            </output>
            <input
              id="pt-slider"
              class="pt__slider"
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={slider}
              aria-label={t('pt.aria')}
              aria-valuetext={formatEur(guess)}
              onInput={(e) => setSlider(Number((e.target as HTMLInputElement).value))}
            />
            <div class="pt__scale" aria-hidden="true">
              {[500_000, 5_000_000, 50_000_000, 250_000_000].map((v) => (
                <span>{formatEur(v)}</span>
              ))}
            </div>
            <div class="pt__nudge">
              <button class="btn btn--ghost" onClick={() => setSlider((s) => Math.max(0, s - 0.004))} aria-label={t('pt.less')}>
                −
              </button>
              <button class="btn btn--primary" onClick={lockIn}>
                {t('pt.lock')}
              </button>
              <button class="btn btn--ghost" onClick={() => setSlider((s) => Math.min(1, s + 0.004))} aria-label={t('pt.more')}>
                +
              </button>
            </div>
          </div>
        ) : (
          <div class="pt__reveal">
            <p class={`bm__verdict ${lastPoints! >= 60 ? 'good' : lastPoints! >= 30 ? '' : 'bad'}`}>
              {t('pt.reveal', {
                emoji: emoji(lastPoints!),
                points: lastPoints!,
                guess: formatEur(guesses[index]),
                actual: formatEur(actual),
                pct: formatPct(guesses[index] / actual - 1),
              })}
            </p>
            <ValueCompare player={player} />
            {!finished && (
              <button class="btn btn--primary" onClick={nextPlayer}>
                {t('common.nextPlayerArrow')}
              </button>
            )}
          </div>
        )}
      </PlayerCard>

      {finished && (
        <div class={`end ${total >= 300 ? 'end--win' : 'end--lose'}`}>
          <p class="end__title">
            {total}/{ROUNDS * MAX_POINTS}
            {newBest ? t('common.newBestSuffix') : ''}
          </p>
          <p class="end__note pt__emoji">{points.map(emoji).join(' ')}</p>
          {mode === 'daily' && <DailyDone countdown={countdown} streak={dailyStreak(GAME)} />}
          <div class="end__actions">
            <button class="btn btn--primary" onClick={onRestart}>
              {mode === 'daily' ? t('mode.practice') : t('common.playAgain')}
            </button>
            <button class="btn" onClick={share}>
              {t('common.share')}
            </button>
          </div>
          {note && (
            <p class="end__note" role="status">
              {note}
            </p>
          )}
        </div>
      )}
    </>
  );
}
