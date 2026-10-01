import { useMemo, useState } from 'preact/hooks';
import { DailyDone, ModeTabs } from '../../components/ModeTabs';
import { PlayerCard } from '../../components/PlayerCard';
import { ValueCompare } from '../../components/ValueCompare';
import { useCountdown } from '../../hooks/useCountdown';
import { useDataset } from '../../data/store';
import type { Player } from '../../data/types';
import { t, tj } from '../../i18n';
import { shareNote } from '../../i18n/labels';
import { trackEvent } from '../../lib/analytics';
import { dailyRand, dailyStreak, recordDaily, type Mode } from '../../lib/daily';
import { formatEur } from '../../lib/format';
import { getBest, submitBest } from '../../lib/records';
import { dayNumber, todayKey } from '../../lib/rng';
import { shareText, siteUrl } from '../../lib/share';
import { readJson, writeJson } from '../../lib/storage';
import { drawRound, modelNotes, ROUNDS, sideOf, type Side } from './logic';

const GAME = 'beat';
const BEST_KEY = 'beat-model';
const MODE_KEY = 'beat:mode';
const dailyKey = (day: string) => `beat:daily:${day}`;

export function BeatModel() {
  const { players } = useDataset();
  const [day] = useState(todayKey);
  const [mode, setMode] = useState<Mode>(() => readJson<Mode>(MODE_KEY) ?? 'daily');

  const dailyQuestions = useMemo(() => drawRound(players, dailyRand(GAME, day)), [players, day]);
  const [practice, setPractice] = useState(() => drawRound(players));
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
    setPractice(drawRound(players));
    setPracticeAnswers([]);
  }

  return (
    <section class="game bm">
      <div class="game__head">
        <h1>{t('game.beat.title')}</h1>
        <ModeTabs mode={mode} day={day} onChange={switchMode} />
      </div>
      <p class="lede">
        {tj('bm.lede', { over: <b>{t('bm.overWord')}</b>, under: <b>{t('bm.underWord')}</b> })}
      </p>
      {mode === 'practice' && <p class="mode-help">{t('mode.practiceHint')}</p>}
      <Round
        key={mode === 'daily' ? `daily-${day}` : `practice-${practice.map((p) => p.id).join('-')}`}
        mode={mode}
        day={day}
        questions={questions}
        answers={answers}
        onAnswers={setAnswers}
        onRestart={mode === 'practice' ? newPractice : () => switchMode('practice')}
      />
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
  const [note, setNote] = useState<string | null>(null);
  const finished = answers.length === ROUNDS;
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
    if (next.length === ROUNDS) {
      const final = next.filter((a, i) => a === sideOf(questions[i])).length;
      setNewBest(submitBest(BEST_KEY, final));
      setBest(getBest(BEST_KEY));
      if (mode === 'daily') recordDaily(GAME, day);
      trackEvent(`beat/${mode}/score-${final}`);
    }
  }

  async function share() {
    const grid = marks.map((m) => (m ? '🟩' : '🟥')).join('');
    const title = mode === 'daily' ? `${t('game.beat.title')} #${dayNumber(day)}` : t('game.beat.title');
    setNote(shareNote(await shareText(`${title} ${score}/${ROUNDS}\n${grid}\n${siteUrl()}#/beat-model`)));
  }

  const right = revealed ? marks[index] : null;

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
          <li class={i < marks.length ? (marks[i] ? 'ok' : 'no') : i === index ? 'now' : ''} />
        ))}
      </ol>

      <PlayerCard player={player}>
        <p class="bm__tm">
          <small>{t('bm.tm')}</small>
          {formatEur(player.tm)}
        </p>
        {!revealed ? (
          <div class="hl__buttons">
            <button class="btn btn--primary" onClick={() => answer('over')}>
              {t('bm.more')}
            </button>
            <button class="btn btn--magenta" onClick={() => answer('under')}>
              {t('bm.less')}
            </button>
          </div>
        ) : (
          <div class="bm__reveal">
            <p class={`bm__verdict ${right ? 'good' : 'bad'}`}>
              {t('bm.verdict', { mark: right ? t('bm.right') : t('bm.wrong'), value: formatEur(player.model) })}
            </p>
            <ValueCompare player={player} range />
            {modelNotes(player, meta.gameweek).length > 0 && (
              <ul class="bm__notes">
                {modelNotes(player, meta.gameweek).map((n) => (
                  <li>{t(n.key, n.params)}</li>
                ))}
              </ul>
            )}
            {!finished && (
              <button class="btn btn--primary" onClick={() => setRevealed(false)}>
                {t('common.nextPlayerArrow')}
              </button>
            )}
          </div>
        )}
      </PlayerCard>

      {finished && (
        <div class={`end ${score >= 7 ? 'end--win' : 'end--lose'}`}>
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
