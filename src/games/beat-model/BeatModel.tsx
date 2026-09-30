import { useState } from 'preact/hooks';
import { PlayerCard } from '../../components/PlayerCard';
import { ValueCompare } from '../../components/ValueCompare';
import { useDataset } from '../../data/store';
import { t, tj } from '../../i18n';
import { shareNote } from '../../i18n/labels';
import { formatEur } from '../../lib/format';
import { getBest, submitBest } from '../../lib/records';
import { shareText, siteUrl } from '../../lib/share';
import { drawRound, modelNotes, ROUNDS, sideOf, type Side } from './logic';

const BEST_KEY = 'beat-model';

export function BeatModel() {
  const { players, meta } = useDataset();
  const [questions, setQuestions] = useState(() => drawRound(players));
  const [answers, setAnswers] = useState<Side[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [best, setBest] = useState(() => getBest(BEST_KEY));
  const [newBest, setNewBest] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const index = revealed ? answers.length - 1 : answers.length;
  const player = questions[Math.min(index, ROUNDS - 1)];
  const marks = answers.map((a, i) => a === sideOf(questions[i]));
  const score = marks.filter(Boolean).length;

  function answer(side: Side) {
    if (revealed) return;
    const next = [...answers, side];
    setAnswers(next);
    setRevealed(true);
    if (next.length === ROUNDS) {
      const final = next.filter((a, i) => a === sideOf(questions[i])).length;
      setNewBest(submitBest(BEST_KEY, final));
      setBest(getBest(BEST_KEY));
    }
  }

  function restart() {
    setQuestions(drawRound(players));
    setAnswers([]);
    setRevealed(false);
    setNewBest(false);
    setNote(null);
  }

  async function share() {
    const grid = marks.map((m) => (m ? '🟩' : '🟥')).join('');
    const head = t('bm.share', { score, rounds: ROUNDS });
    setNote(shareNote(await shareText(`${head}\n${grid}\n${siteUrl()}#/beat-model`)));
  }

  const right = revealed ? marks[index] : null;

  return (
    <section class="game bm">
      <div class="game__head">
        <h1>{t('game.beat.title')}</h1>
        <div class="scorebug">
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
      </div>
      <p class="lede">
        {tj('bm.lede', { over: <b>{t('bm.overWord')}</b>, under: <b>{t('bm.underWord')}</b> })}
      </p>

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
            {answers.length < ROUNDS && (
              <button class="btn btn--primary" onClick={() => setRevealed(false)}>
                {t('common.nextPlayerArrow')}
              </button>
            )}
          </div>
        )}
      </PlayerCard>

      {answers.length === ROUNDS && (
        <div class={`end ${score >= 7 ? 'end--win' : 'end--lose'}`}>
          <p class="end__title">
            {score}/{ROUNDS}
            {newBest ? t('common.newBestSuffix') : ''}
          </p>
          <p class="end__note">
            {score >= 8 ? t('bm.great') : score >= 6 ? t('bm.good') : t('bm.poor')} {t('bm.random')}
          </p>
          <div class="end__actions">
            <button class="btn btn--primary" onClick={restart}>
              {t('common.playAgain')}
            </button>
            <button class="btn" onClick={share}>
              {t('common.share')}
            </button>
            <a class="btn btn--ghost" href="#/how">
              {t('bm.howLink')}
            </a>
          </div>
          {note && <p class="end__note" role="status">{note}</p>}
        </div>
      )}
    </section>
  );
}
