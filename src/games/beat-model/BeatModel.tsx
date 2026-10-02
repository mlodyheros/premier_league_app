import { GameHeader, OtherGames } from '../../components/GameHeader';
import { useRevealWhen } from '../../hooks/useRevealWhen';
import { useMemo, useState } from 'preact/hooks';
import { DailyDone, ModeTabs } from '../../components/ModeTabs';
import { PoolNote } from '../../components/PoolNote';
import { PlayerCard } from '../../components/PlayerCard';
import { useCountdown } from '../../hooks/useCountdown';
import { useDataset } from '../../data/store';
import type { Player } from '../../data/types';
import { t, tj } from '../../i18n';
import { trackEvent } from '../../lib/analytics';
import { buzz, celebrate } from '../../lib/motion';
import { dailyStreak, recordDaily, type Mode } from '../../lib/daily';
import { poolLevel, poolOf } from '../../lib/pools';
import { beatRound } from '../../lib/dailyRounds';
import { formatEur, formatPct } from '../../lib/format';
import { useCountUp } from '../../hooks/useCountUp';
import { modelGap } from '../../data/valueSource';
import { getBest, submitBest } from '../../lib/records';
import { dayNumber, todayKey } from '../../lib/rng';
import { shareText, shareUrl } from '../../lib/share';
import { notifyShare } from '../../components/Toast';
import { readJson, writeJson } from '../../lib/storage';
import { drawRound, modelNotes, ROUNDS, sideOf, type Side } from './logic';

const GAME = 'beat';
const BEST_KEY = 'beat-model';
const MODE_KEY = 'beat:mode';
const dailyKey = (day: string) => `beat:daily:${day}`;

export function BeatModel() {
  const { players, schedule } = useDataset();
  const [day] = useState(todayKey);
  const [mode, setMode] = useState<Mode>(() => readJson<Mode>(MODE_KEY) ?? 'daily');

  const dailyQuestions = useMemo(() => beatRound(players, schedule, day), [players, schedule, day]);
  const [practice, setPractice] = useState(() => drawRound(poolOf(players, poolLevel.value)));
  const [practiceAnswers, setPracticeAnswers] = useState<Side[]>([]);
  const [dailyAnswers, setDailyAnswers] = useState<Side[]>(() => readJson<Side[]>(dailyKey(day)) ?? []);

  const questions = mode === 'daily' ? dailyQuestions : practice;
  const answers = mode === 'daily' ? dailyAnswers : practiceAnswers;

  function switchMode(m: Mode) {
    writeJson(MODE_KEY, m);
    setMode(m);
  }

  function setAnswers(next: Side[]) {
    if (mode === 'daily') {
      setDailyAnswers(next);
      writeJson(dailyKey(day), next);
    } else {
      setPracticeAnswers(next);
    }
  }

  function newPractice() {
    setPractice(drawRound(poolOf(players, poolLevel.value)));
    setPracticeAnswers([]);
  }

  return (
    <section class="game bm">
      <GameHeader game="beat" tabs={<ModeTabs mode={mode} day={day} onChange={switchMode} />}>
        <p>
          {tj('bm.lede', {
            over: <b>{t('bm.overWord')}</b>,
            under: <b>{t('bm.underWord')}</b>,
          })}
        </p>
      </GameHeader>
      {mode === 'practice' && (
        <>
          <p class="mode-help">{t('mode.practiceHint')}</p>
          <PoolNote />
        </>
      )}
      <Round
        key={mode === 'daily' ? `daily-${day}` : `practice-${practice.map((p) => p.id).join('-')}`}
        mode={mode}
        day={day}
        questions={questions}
        answers={answers}
        onAnswers={setAnswers}
        onRestart={mode === 'practice' ? newPractice : () => switchMode('practice')}
      />
      <OtherGames current="beat" />
    </section>
  );
}

interface RoundProps {
  mode: Mode;
  day: string;
  questions: Player[];
  answers: Side[];
  onAnswers: (next: Side[]) => void;
  onRestart: () => void;
}

function Round({ mode, day, questions, answers, onAnswers, onRestart }: RoundProps) {
  const { meta } = useDataset();
  // Coming back mid-round shows the last answered player, revealed.
  const [revealed, setRevealed] = useState(answers.length > 0);
  const [best, setBest] = useState(() => getBest(BEST_KEY));
  const [newBest, setNewBest] = useState(false);
  const finished = answers.length === ROUNDS;
  const endRef = useRevealWhen(finished);
  const countdown = useCountdown(mode === 'daily' && finished);

  const index = revealed ? answers.length - 1 : answers.length;
  const player = questions[Math.min(Math.max(index, 0), ROUNDS - 1)];
  const marks = answers.map((a, i) => a === sideOf(questions[i]));
  const score = marks.filter(Boolean).length;

  function answer(side: Side) {
    if (revealed || finished) return;
    const next = [...answers, side];
    onAnswers(next);
    setRevealed(true);
    buzz(side === sideOf(questions[answers.length]) ? 'good' : 'bad');
    if (next.length === ROUNDS) {
      const final = next.filter((a, i) => a === sideOf(questions[i])).length;
      const isNew = submitBest(BEST_KEY, final);
      setNewBest(isNew);
      if (final >= 8) celebrate(final === ROUNDS);
      setBest(getBest(BEST_KEY));
      if (mode === 'daily') recordDaily(GAME, day, true, `${final}/${ROUNDS}`);
      trackEvent(`beat/${mode}/score-${final}`);
    }
  }

  async function share() {
    const grid = marks.map((m) => (m ? '🟩' : '🟥')).join('');
    const title = mode === 'daily' ? `${t('game.beat.title')} #${dayNumber(day)}` : t('game.beat.title');
    notifyShare(await shareText(`${title} ${score}/${ROUNDS}\n${grid}\n${shareUrl('beat-model')}`));
  }

  const right = revealed ? marks[index] : null;
  // The model's figure counts up when an answer is given (not when coming back to it).
  const [counting] = useState(() => answers.length === 0);
  const modelShown = Math.round(useCountUp(player.model, revealed && counting, 800) / 100_000) * 100_000;

  return (
    <>
      <div class="scorebug scorebug--inline">
        <span>
          <small>{t('common.score')}</small>
          <b>
            {score}/{answers.length}
          </b>
        </span>
        <span>
          <small>{t('common.best')}</small>
          <b>{best ?? '–'}</b>
        </span>
      </div>

      <ol class="progress" aria-label={t('common.rounds')}>
        {Array.from({ length: ROUNDS }, (_, i) => (
          <li class={i < marks.length ? (marks[i] ? 'ok' : 'no') : i === index ? 'now' : ''}>
            <span class="sr-only">
              {t(
                i < marks.length
                  ? marks[i]
                    ? 'progress.right'
                    : 'progress.wrong'
                  : i === index
                    ? 'progress.now'
                    : 'progress.todo',
                {
                  n: i + 1,
                },
              )}
            </span>
          </li>
        ))}
      </ol>

      <PlayerCard
        player={player}
        head={
          <>
            <div class={`duel ${revealed ? (right ? 'duel--right' : 'duel--wrong') : ''}`}>
              <div class="duel__side">
                <small>{t('bm.tm')}</small>
                <b>{formatEur(player.tm)}</b>
              </div>
              <span class="duel__vs" aria-hidden="true">
                {revealed ? (player.model > player.tm ? '<' : '>') : '?'}
              </span>
              <div class={`duel__side duel__side--model ${revealed ? (player.model > player.tm ? 'up' : 'down') : ''}`}>
                <small>{t('compare.model')}</small>
                <b>{revealed ? formatEur(modelShown) : '?'}</b>
                {revealed && <span class="duel__gap">{formatPct(modelGap(player))}</span>}
              </div>
            </div>
            {revealed ? (
              <>
                <GapBar tm={player.tm} model={player.model} />
                <p class={`verdict ${right ? 'verdict--good' : 'verdict--bad'}`}>{right ? t('bm.right') : t('bm.wrong')}</p>
              </>
            ) : (
              <p class="bm__question">{t('bm.question')}</p>
            )}
          </>
        }
      >
        {revealed && (
          <div class="bm__reveal">
            <p class="bm__range">
              {t('bm.range', {
                low: formatEur(player.low),
                high: formatEur(player.high),
              })}
            </p>
            {modelNotes(player, meta.gameweek).length > 0 && (
              <ul class="bm__notes">
                {modelNotes(player, meta.gameweek).map((n) => (
                  <li>{t(n.key, n.params)}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </PlayerCard>

      {!revealed ? (
        <div class="bm__buttons action-bar">
          <button class="btn btn--primary btn--huge" onClick={() => answer('over')}>
            <span aria-hidden="true">▲</span> {t('bm.more')}
          </button>
          <button class="btn btn--accent btn--huge" onClick={() => answer('under')}>
            <span aria-hidden="true">▼</span> {t('bm.less')}
          </button>
        </div>
      ) : (
        !finished && (
          <div class="bm__next action-bar">
            <button class="btn btn--primary btn--big" onClick={() => setRevealed(false)}>
              {t('common.nextPlayerArrow')}
            </button>
          </div>
        )
      )}

      {finished && (
        <div class={`end ${score >= 7 ? 'end--win' : 'end--lose'}`} ref={endRef}>
          <p class="end__title">
            {score}/{ROUNDS}
            {newBest ? t('common.newBestSuffix') : ''}
          </p>
          <p class="end__note">
            {score >= 8 ? t('bm.great') : score >= 6 ? t('bm.good') : t('bm.poor')} {t('bm.random')}
          </p>
          {mode === 'daily' && <DailyDone countdown={countdown} streak={dailyStreak(GAME)} />}
          <div class="end__actions">
            <button class="btn btn--primary" onClick={onRestart}>
              {mode === 'daily' ? t('mode.practice') : t('common.playAgain')}
            </button>
            <button class="btn" onClick={share}>
              {t('common.share')}
            </button>
            <a class="btn btn--ghost" href="#/how">
              {t('bm.howLink')}
            </a>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The gap at a glance: Transfermarkt in the middle, the model's figure to the
 * right (more) or left (less), on a scale that tops out at ±60%.
 */
function GapBar({ tm, model }: { tm: number; model: number }) {
  const gap = model / tm - 1;
  const reach = Math.min(Math.abs(gap) / 0.6, 1) * 50;
  const up = gap > 0;
  return (
    <div class="gapbar" aria-hidden="true">
      <div class="gapbar__track">
        <span
          class={`gapbar__fill ${up ? 'up' : 'down'}`}
          style={{ [up ? 'left' : 'right']: '50%', width: `${reach}%` }}
        />
        <span class="gapbar__tm" />
      </div>
      <div class="gapbar__labels">
        <span>−60%</span>
        <span>{t('bm.tm')}</span>
        <span>+60%</span>
      </div>
    </div>
  );
}
