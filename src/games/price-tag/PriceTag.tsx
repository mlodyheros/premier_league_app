import { useEffect, useMemo, useState } from 'preact/hooks';
import { PlayerCard } from '../../components/PlayerCard';
import { ValueCompare } from '../../components/ValueCompare';
import { useDataset } from '../../data/store';
import { SOURCE_LABEL, SOURCE_SHORT, valueOf, valueSource } from '../../data/valueSource';
import { formatEur, formatPct } from '../../lib/format';
import { getBest, submitBest } from '../../lib/records';
import { shuffled } from '../../lib/rng';
import { shareText, siteUrl } from '../../lib/share';
import { emoji, eurToSlider, MAX_POINTS, pool, ROUNDS, score, sliderToEur } from './logic';

const START = eurToSlider(15_000_000);

export function PriceTag() {
  const { players } = useDataset();
  // The round keeps the value source it started with, so earlier guesses are
  // never re-scored by a switch mid-round.
  const [source, setSource] = useState(valueSource.value);
  const switched = valueSource.value !== source;
  const candidates = useMemo(() => pool(players), [players]);
  const [round, setRound] = useState(() => shuffled(candidates).slice(0, ROUNDS));
  const [slider, setSlider] = useState(START);
  const [guesses, setGuesses] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const bestKey = `price-tag:${source}`;
  const [best, setBest] = useState(() => getBest(bestKey));
  const [newBest, setNewBest] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => setBest(getBest(bestKey)), [bestKey]);

  const index = revealed ? guesses.length - 1 : guesses.length;
  const player = round[Math.min(index, ROUNDS - 1)];
  const points = guesses.map((g, i) => score(g, valueOf(round[i], source)));
  const total = points.reduce((a, b) => a + b, 0);
  const finished = guesses.length === ROUNDS;
  const guess = sliderToEur(slider);

  function lockIn() {
    const next = [...guesses, guess];
    setGuesses(next);
    setRevealed(true);
    if (next.length === ROUNDS) {
      const sum = next.reduce((a, g, i) => a + score(g, valueOf(round[i], source)), 0);
      setNewBest(submitBest(bestKey, sum));
      setBest(getBest(bestKey));
    }
  }

  function nextPlayer() {
    setRevealed(false);
    setSlider(START);
  }

  function restart() {
    setSource(valueSource.value);
    setRound(shuffled(candidates).slice(0, ROUNDS));
    setGuesses([]);
    setRevealed(false);
    setSlider(START);
    setNewBest(false);
    setNote(null);
  }

  async function share() {
    const r = await shareText(
      `Price Tag ${total}/${ROUNDS * MAX_POINTS} · ${SOURCE_SHORT[source]} values\n${points.map(emoji).join('')}\n${siteUrl()}#/price-tag`,
    );
    setNote(r === 'copied' ? 'Copied to clipboard' : r === 'shared' ? 'Shared' : 'Could not share');
  }

  const actual = valueOf(player, source);
  const lastPoints = revealed ? points[index] : null;

  return (
    <section class="game pt">
      <div class="game__head">
        <h1>Price Tag</h1>
        <div class="scorebug">
          <span>
            <small>Score</small>
            <b>{total}</b>
          </span>
          <span>
            <small>Best</small>
            <b>{best ?? '–'}</b>
          </span>
        </div>
      </div>
      <p class="lede">
        Slide to the <b>{SOURCE_LABEL[source]}</b> value you think each player has. Up to {MAX_POINTS} points a player:
        spot on scores 100, three times out scores nothing.
      </p>

      {switched && (
        <p class="notice-inline">
          This round keeps {SOURCE_LABEL[source]} values. The switch applies from your next round.
        </p>
      )}

      <ol class="progress" aria-label="Rounds">
        {Array.from({ length: ROUNDS }, (_, i) => (
          <li class={i < points.length ? (points[i] >= 60 ? 'ok' : points[i] >= 30 ? 'mid' : 'no') : i === index ? 'now' : ''} />
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
              aria-label="Your valuation"
              aria-valuetext={formatEur(guess)}
              onInput={(e) => setSlider(Number((e.target as HTMLInputElement).value))}
            />
            <div class="pt__scale" aria-hidden="true">
              <span>€500K</span>
              <span>€5M</span>
              <span>€50M</span>
              <span>€250M</span>
            </div>
            <div class="pt__nudge">
              <button class="btn btn--ghost" onClick={() => setSlider((s) => Math.max(0, s - 0.004))} aria-label="Lower">
                −
              </button>
              <button class="btn btn--primary" onClick={lockIn}>
                Lock it in
              </button>
              <button class="btn btn--ghost" onClick={() => setSlider((s) => Math.min(1, s + 0.004))} aria-label="Higher">
                +
              </button>
            </div>
          </div>
        ) : (
          <div class="pt__reveal">
            <p class={`bm__verdict ${lastPoints! >= 60 ? 'good' : lastPoints! >= 30 ? '' : 'bad'}`}>
              {emoji(lastPoints!)} {lastPoints} points · you said {formatEur(guesses[index])}, it's {formatEur(actual)} (
              {formatPct(guesses[index] / actual - 1)})
            </p>
            <ValueCompare player={player} />
            {!finished && (
              <button class="btn btn--primary" onClick={nextPlayer}>
                Next player →
              </button>
            )}
          </div>
        )}
      </PlayerCard>

      {finished && (
        <div class={`end ${total >= 300 ? 'end--win' : 'end--lose'}`}>
          <p class="end__title">
            {total}/{ROUNDS * MAX_POINTS} {newBest ? '· new best!' : ''}
          </p>
          <p class="end__note pt__emoji">{points.map(emoji).join(' ')}</p>
          <div class="end__actions">
            <button class="btn btn--primary" onClick={restart}>
              Play again
            </button>
            <button class="btn" onClick={share}>
              Share
            </button>
          </div>
          {note && <p class="end__note" role="status">{note}</p>}
        </div>
      )}
    </section>
  );
}
