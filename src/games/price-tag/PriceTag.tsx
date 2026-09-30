import { useEffect, useMemo, useState } from 'preact/hooks';
import { PlayerCard } from '../../components/PlayerCard';
import { ValueCompare } from '../../components/ValueCompare';
import { useDataset } from '../../data/store';
import { shareValues, valueOf, valuePhrase, valueSource, valuesPhrase } from '../../data/valueSource';
import { t, tj } from '../../i18n';
import { shareNote } from '../../i18n/labels';
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
    const head = t('pt.share', { total, max: ROUNDS * MAX_POINTS, values: shareValues(source) });
    setNote(shareNote(await shareText(`${head}\n${points.map(emoji).join('')}\n${siteUrl()}#/price-tag`)));
  }

  const actual = valueOf(player, source);
  const lastPoints = revealed ? points[index] : null;

  return (
    <section class="game pt">
      <div class="game__head">
        <h1>{t('game.price.title')}</h1>
        <div class="scorebug">
          <span>
            <small>{t('common.score')}</small>
            <b>{total}</b>
          </span>
          <span>
            <small>{t('common.best')}</small>
            <b>{best ?? '–'}</b>
          </span>
        </div>
      </div>
      <p class="lede">
        {tj('pt.lede', { value: <b>{valuePhrase(source)}</b>, max: MAX_POINTS })}
      </p>

      {switched && (
        <p class="notice-inline">
          {t('pt.locked', { values: valuesPhrase(source) })}
        </p>
      )}

      <ol class="progress" aria-label={t('common.rounds')}>
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
