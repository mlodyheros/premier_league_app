import { GameHeader, OtherGames } from '../../components/GameHeader';
import { useRevealWhen } from '../../hooks/useRevealWhen';
import { Icon } from '../../components/Icon';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { DailyDone, ModeTabs } from '../../components/ModeTabs';
import { PoolNote } from '../../components/PoolNote';
import { PlayerCard } from '../../components/PlayerCard';
import { useCountdown } from '../../hooks/useCountdown';
import { useDataset } from '../../data/store';
import type { Player } from '../../data/types';
import { shareValues, valueOf, valuePhrase, valueSource, valuesPhrase, type ValueSource } from '../../data/valueSource';
import { t, tj } from '../../i18n';
import { useCountUp } from '../../hooks/useCountUp';
import { trackEvent } from '../../lib/analytics';
import { buzz, celebrate } from '../../lib/motion';
import { dailyStreak, recordDaily, type Mode } from '../../lib/daily';
import { priceRound } from '../../lib/dailyRounds';
import { formatEur, formatPct } from '../../lib/format';
import { getBest, submitBest } from '../../lib/records';
import { dayNumber, shuffled, todayKey } from '../../lib/rng';
import { shareText, shareUrl } from '../../lib/share';
import { notifyShare } from '../../components/Toast';
import { readJson, writeJson } from '../../lib/storage';
import { emoji, verdictIcon, eurToSlider, MAX_POINTS, ROUNDS, score, SLIDER_MID, sliderToEur, stepPrice } from './logic';
import { poolLevel, poolOf } from '../../lib/pools';

const GAME = 'price';
const START = eurToSlider(SLIDER_MID);
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
  const { players, schedule } = useDataset();
  const [day] = useState(todayKey);
  const [mode, setMode] = useState<Mode>(() => readJson<Mode>(MODE_KEY) ?? 'daily');
  const dailyRound = useMemo(() => priceRound(players, schedule, day), [players, schedule, day]);
  const practicePool = () => poolOf(players, poolLevel.value);
  const [daily, setDaily] = useState<Progress>(
    () => readJson<Progress>(dailyKey(day)) ?? { source: valueSource.value, guesses: [] },
  );
  const [practiceRound, setPracticeRound] = useState(() => shuffled(practicePool()).slice(0, ROUNDS));
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
    setPracticeRound(shuffled(practicePool()).slice(0, ROUNDS));
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
      <GameHeader game="price" tabs={<ModeTabs mode={mode} day={day} onChange={switchMode} />}>
        <p>{tj('pt.lede', { value: <b>{valuePhrase()}</b>, max: MAX_POINTS })}</p>
      </GameHeader>
      <Round
        key={isDaily ? `daily-${day}` : `practice-${practiceRound.map((p) => p.id).join('-')}`}
        mode={mode}
        day={day}
        round={isDaily ? dailyRound : practiceRound}
        progress={isDaily ? daily : practice}
        onProgress={isDaily ? saveDaily : setPractice}
        onRestart={isDaily ? () => switchMode('practice') : newPractice}
      />
      <OtherGames current="price" />
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
  const finished = guesses.length === ROUNDS;
  const endRef = useRevealWhen(finished);
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
    const got = score(guess, valueOf(round[next.length - 1], source));
    buzz(got >= 60 ? 'good' : got >= 30 ? 'tap' : 'bad');
    if (got >= 90) celebrate();
    if (next.length === ROUNDS) {
      const sum = next.reduce((a, g, i) => a + score(g, valueOf(round[i], source)), 0);
      setNewBest(submitBest(bestKey, sum));
      setBest(getBest(bestKey));
      if (mode === 'daily') recordDaily(GAME, day, true, `${sum}/${ROUNDS * MAX_POINTS}`);
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
    notifyShare(await shareText(`${head}\n${points.map(emoji).join('')}\n${shareUrl('price-tag')}`));
  }

  const actual = valueOf(player, source);
  // The true value counts up when a guess is locked in (not when coming back to a finished round).
  const [counting] = useState(() => guesses.length === 0);
  const actualShown = Math.round(useCountUp(actual, revealed && counting, 800) / 100_000) * 100_000;
  const pointsShown = useCountUp(revealed ? (points[index] ?? 0) : 0, revealed && counting, 900);
  const lastPoints = revealed ? points[index] : null;

  return (
    <>
      <div class="scorebug scorebug--inline">
        <span>
          <small>{t('common.score')}</small>
          <b>
            {total}
            <i>/{ROUNDS * MAX_POINTS}</i>
          </b>
        </span>
        <span>
          <small>{t('common.best')}</small>
          <b>{best ?? '–'}</b>
        </span>
      </div>
      {mode === 'practice' && (
        <>
          <p class="mode-help">{t('mode.practiceHint')}</p>
          <PoolNote />
        </>
      )}

      {switched && !finished && <p class="notice-inline">{t('pt.locked', { values: valuesPhrase(source) })}</p>}

      <ol class="progress" aria-label={t('common.rounds')}>
        {Array.from({ length: ROUNDS }, (_, i) => (
          <li class={i < points.length ? (points[i] >= 60 ? 'ok' : points[i] >= 30 ? 'mid' : 'no') : i === index ? 'now' : ''}>
            <span class="sr-only">
              {i < points.length
                ? t('progress.points', { n: i + 1, points: points[i] })
                : t(i === index ? 'progress.now' : 'progress.todo', { n: i + 1 })}
            </span>
          </li>
        ))}
      </ol>

      <PlayerCard
        player={player}
        head={
          <>
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
                  {[500_000, 15_000_000, 40_000_000, 250_000_000].map((v) => (
                    <span style={{ left: `${eurToSlider(v) * 100}%` }}>{formatEur(v, undefined, true)}</span>
                  ))}
                </div>
                <div class="pt__nudge">
                  <button class="btn btn--ghost" onClick={() => setSlider((s) => eurToSlider(stepPrice(sliderToEur(s), -1)))} aria-label={t('pt.less')}>
                    −
                  </button>
                  <button class="btn btn--primary" onClick={lockIn}>
                    {t('pt.lock')}
                  </button>
                  <button class="btn btn--ghost" onClick={() => setSlider((s) => eurToSlider(stepPrice(sliderToEur(s), 1)))} aria-label={t('pt.more')}>
                    +
                  </button>
                </div>
              </div>
            ) : (
              <div class="pt__reveal">
                <div class={`pt__score ${lastPoints! >= 60 ? 'good' : lastPoints! >= 30 ? 'mid' : 'bad'}`}>
                  <span class="pt__points">
                    +{Math.round(pointsShown)}
                    <small>{t('pt.pointsWord')}</small>
                  </span>
                  <span class="pt__emoji-big">
                    <Icon name={verdictIcon(lastPoints!)} size={44} />
                  </span>
                </div>
                <dl class="pt__compare">
                  <div>
                    <dt>{t('pt.yourGuess')}</dt>
                    <dd>{formatEur(guesses[index])}</dd>
                  </div>
                  <div class="pt__actual">
                    <dt>{valuePhrase(source)}</dt>
                    <dd>{formatEur(actualShown)}</dd>
                  </div>
                  <div>
                    <dt>{t('pt.off')}</dt>
                    <dd>{formatPct(guesses[index] / actual - 1)}</dd>
                  </div>
                </dl>
                {!finished && (
                  <button class="btn btn--primary" onClick={nextPlayer}>
                    {t('common.nextPlayerArrow')}
                  </button>
                )}
              </div>
            )}
          </>
        }
      />

      {finished && (
        <div class={`end ${total >= 300 ? 'end--win' : 'end--lose'}`} ref={endRef}>
          <p class="end__title">
            {total}/{ROUNDS * MAX_POINTS}
            {newBest ? t('common.newBestSuffix') : ''}
          </p>
          <p class="pt__dots" aria-hidden="true">
            {points.map((pts) => (
              <span class={`pt__dot ${pts >= 60 ? 'good' : pts >= 30 ? 'mid' : 'bad'}`}>
                <Icon name={verdictIcon(pts)} size={18} />
              </span>
            ))}
          </p>
          {mode === 'daily' && <DailyDone countdown={countdown} streak={dailyStreak(GAME)} />}
          <div class="end__actions">
            <button class="btn btn--primary" onClick={onRestart}>
              {mode === 'daily' ? t('mode.practice') : t('common.playAgain')}
            </button>
            <button class="btn" onClick={share}>
              {t('common.share')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
