import { useState } from 'preact/hooks';
import { PlayerCard } from '../../components/PlayerCard';
import { ValueCompare } from '../../components/ValueCompare';
import { useDataset } from '../../data/store';
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
    const r = await shareText(`Beat the Model ${score}/${ROUNDS}\n${grid}\n${siteUrl()}#/beat-model`);
    setNote(r === 'copied' ? 'Copied to clipboard' : r === 'shared' ? 'Shared' : 'Could not share');
  }

  const right = revealed ? marks[index] : null;

  return (
    <section class="game bm">
      <div class="game__head">
        <h1>Beat the Model</h1>
        <div class="scorebug">
          <span>
            <small>Score</small>
            <b>
              {score}/{answers.length}
            </b>
          </span>
          <span>
            <small>Best</small>
            <b>{best ?? '–'}</b>
          </span>
        </div>
      </div>
      <p class="lede">
        Here's the player and his Transfermarkt value. Does the model rate him <b>over</b> or <b>under</b> that? This
        game always compares both, whatever the switch says.
      </p>

      <ol class="progress" aria-label="Rounds">
        {Array.from({ length: ROUNDS }, (_, i) => (
          <li class={i < marks.length ? (marks[i] ? 'ok' : 'no') : i === index ? 'now' : ''} />
        ))}
      </ol>

      <PlayerCard player={player}>
        <p class="bm__tm">
          <small>Transfermarkt</small>
          {formatEur(player.tm)}
        </p>
        {!revealed ? (
          <div class="hl__buttons">
            <button class="btn btn--primary" onClick={() => answer('over')}>
              ▲ Model says more
            </button>
            <button class="btn btn--magenta" onClick={() => answer('under')}>
              ▼ Model says less
            </button>
          </div>
        ) : (
          <div class="bm__reveal">
            <p class={`bm__verdict ${right ? 'good' : 'bad'}`}>
              {right ? '✓ Right' : '✗ Wrong'}: the model says {formatEur(player.model)}
            </p>
            <ValueCompare player={player} range />
            {modelNotes(player, meta.gameweek).length > 0 && (
              <ul class="bm__notes">
                {modelNotes(player, meta.gameweek).map((n) => (
                  <li>{n}</li>
                ))}
              </ul>
            )}
            {answers.length < ROUNDS && (
              <button class="btn btn--primary" onClick={() => setRevealed(false)}>
                Next player →
              </button>
            )}
          </div>
        )}
      </PlayerCard>

      {answers.length === ROUNDS && (
        <div class={`end ${score >= 7 ? 'end--win' : 'end--lose'}`}>
          <p class="end__title">
            {score}/{ROUNDS} {newBest ? '· new best!' : ''}
          </p>
          <p class="end__note">
            {score >= 8
              ? 'You read the model like its author.'
              : score >= 6
                ? 'Better than a coin toss.'
                : 'The model is harder to read than it looks.'}{' '}
            Guessing at random scores 5 on average.
          </p>
          <div class="end__actions">
            <button class="btn btn--primary" onClick={restart}>
              Play again
            </button>
            <button class="btn" onClick={share}>
              Share
            </button>
            <a class="btn btn--ghost" href="#/how">
              How the model works
            </a>
          </div>
          {note && <p class="end__note" role="status">{note}</p>}
        </div>
      )}
    </section>
  );
}
