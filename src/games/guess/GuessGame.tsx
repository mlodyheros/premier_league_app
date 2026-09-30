import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Avatar, ClubChip } from '../../components/Avatar';
import { PlayerSearch } from '../../components/PlayerSearch';
import { StatsPanel } from '../../components/StatsPanel';
import { ValueCompare } from '../../components/ValueCompare';
import { useDataset } from '../../data/store';
import type { Player } from '../../data/types';
import { shareValues, sourceShort, valueOf, valueSource, valuesPhrase } from '../../data/valueSource';
import { t, tj } from '../../i18n';
import { continentName, countryName } from '../../i18n/countries';
import { posFull, posLabel, shareNote } from '../../i18n/labels';
import { formatDate, formatEur } from '../../lib/format';
import { dayNumber, msUntilTomorrow, pick, previousDayKey, todayKey } from '../../lib/rng';
import { shareText, siteUrl } from '../../lib/share';
import { loadStats, recordResult, saveStats } from '../../lib/stats';
import { readJson, writeJson } from '../../lib/storage';
import { compare, dailyPool, dailyTarget, MAX_GUESSES, shareGrid, type Feedback, type Mark } from './logic';

type Mode = 'daily' | 'unlimited';

/**
 * Saved progress. Players are stored by name, not id: ids are row numbers in
 * pl-value's dataset and shift when squads change, names do not.
 */
interface Round {
  target: string;
  guesses: string[];
  recorded: boolean;
  hard?: boolean;
  gaveUp?: boolean;
}

const MODE_KEY = 'guess:mode';
const dailyKey = (day: string) => `guess:daily:${day}`;
const UNLIMITED_KEY = 'guess:unlimited';

function newUnlimitedRound(players: Player[], hard: boolean): Round {
  const pool = hard ? players : dailyPool(players);
  return { target: pick(pool).name, guesses: [], recorded: false, hard };
}

export function GuessGame() {
  const { players } = useDataset();
  const byName = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);
  const source = valueSource.value;

  const [mode, setMode] = useState<Mode>(() => readJson<Mode>(MODE_KEY) ?? 'daily');
  const [day] = useState(todayKey);

  const [round, setRound] = useState<Round>(() => loadRound(mode));

  function loadRound(m: Mode): Round {
    if (m === 'daily') {
      const target = dailyTarget(players, day).name;
      const saved = readJson<Round>(dailyKey(day));
      return saved && saved.target === target ? saved : { target, guesses: [], recorded: false };
    }
    const saved = readJson<Round>(UNLIMITED_KEY);
    return saved && byName.has(saved.target) ? saved : newUnlimitedRound(players, false);
  }

  function switchMode(m: Mode) {
    writeJson(MODE_KEY, m);
    setMode(m);
    setRound(loadRound(m));
  }

  const target = byName.get(round.target)!;
  const guesses = round.guesses.map((n) => byName.get(n)).filter((p): p is Player => !!p);
  const feedback = guesses.map((g) => compare(g, target, source));
  const won = feedback.some((f) => f.correct);
  const over = won || !!round.gaveUp || guesses.length >= MAX_GUESSES;
  const statsKey = `guess-${mode}`;
  const [stats, setStats] = useState(() => loadStats(statsKey, MAX_GUESSES));

  useEffect(() => setStats(loadStats(statsKey, MAX_GUESSES)), [statsKey]);

  useEffect(() => {
    writeJson(mode === 'daily' ? dailyKey(day) : UNLIMITED_KEY, round);
  }, [round, mode, day]);

  // Record the result exactly once, when the round ends.
  useEffect(() => {
    if (!over || round.recorded) return;
    const next = recordResult(
      loadStats(statsKey, MAX_GUESSES),
      won,
      guesses.length,
      mode === 'daily' ? { today: day, yesterday: previousDayKey(day) } : undefined,
    );
    saveStats(statsKey, next);
    setStats(next);
    setRound((r) => ({ ...r, recorded: true }));
  }, [over]);

  function guess(p: Player) {
    if (over) return;
    setRound((r) => ({ ...r, guesses: [...r.guesses, p.name] }));
  }

  function giveUp() {
    setRound((r) => ({ ...r, gaveUp: true }));
  }

  const guessedIds = useMemo(() => new Set(guesses.map((g) => g.id)), [guesses]);
  const rows = guesses.map((g, i) => ({ g, f: feedback[i] })).reverse();

  return (
    <section class="game guess">
      <div class="game__head">
        <h1>{t('game.guess.title')}</h1>
        <div class="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'daily'} onClick={() => switchMode('daily')}>
            {t('guess.daily', { n: dayNumber(day) })}
          </button>
          <button role="tab" aria-selected={mode === 'unlimited'} onClick={() => switchMode('unlimited')}>
            {t('guess.unlimited')}
          </button>
        </div>
      </div>

      <p class="lede">
        {tj('guess.lede', {
          max: MAX_GUESSES,
          legend: (
            <span class="legend">
              <Tile mark="hit">{t('guess.exact')}</Tile> <Tile mark="near">{t('guess.close')}</Tile>
            </span>
          ),
          values: valuesPhrase(source),
        })}
      </p>

      {!over && (
        <div class="guess__input">
          <PlayerSearch onPick={guess} exclude={guessedIds} placeholder={t('guess.placeholder', { n: guesses.length + 1, max: MAX_GUESSES })} />
          {mode === 'unlimited' && guesses.length > 0 && (
            <button class="btn btn--ghost" onClick={giveUp}>
              {t('guess.giveUp')}
            </button>
          )}
        </div>
      )}

      {over && (
        <EndPanel
          won={won}
          gaveUp={!!round.gaveUp}
          target={target}
          feedback={feedback}
          mode={mode}
          day={day}
          stats={stats}
          onNext={
            mode === 'unlimited'
              ? () => setRound(newUnlimitedRound(players, !!round.hard))
              : undefined
          }
        />
      )}

      {mode === 'unlimited' && !over && guesses.length === 0 && (
        <label class="check">
          <input
            type="checkbox"
            checked={!!round.hard}
            onChange={(e) => setRound(newUnlimitedRound(players, (e.target as HTMLInputElement).checked))}
          />
          {t('guess.hard', { n: players.length })}
        </label>
      )}

      {rows.length > 0 && (
        <div class="guess__board" role="table" aria-label={t('guess.board')}>
          <div class="guess__cols" role="row" aria-hidden="true">
            <span>{t('guess.col.club')}</span>
            <span>{t('guess.col.pos')}</span>
            <span>{t('guess.col.nat')}</span>
            <span>{t('guess.col.age')}</span>
            <span>{t('guess.col.value', { source: sourceShort(source) })}</span>
          </div>
          {rows.map(({ g, f }) => (
            <GuessRow player={g} f={f} />
          ))}
        </div>
      )}
    </section>
  );
}

function Tile({ mark, children, dir }: { mark: Mark; children: ComponentChildren; dir?: 'up' | 'down' | null }) {
  const label = t(`guess.mark.${mark}`);
  const hint = dir === 'up' ? t('guess.higher') : dir === 'down' ? t('guess.lower') : '';
  return (
    <span class={`tile tile--${mark}`} role="cell" aria-label={`${label}${hint}`}>
      <span class="tile__v">{children}</span>
      {dir && <span class="tile__dir" aria-hidden="true">{dir === 'up' ? '▲' : '▼'}</span>}
    </span>
  );
}

function GuessRow({ player, f }: { player: Player; f: Feedback }) {
  const { meta } = useDataset();
  return (
    <div class={`guess__row ${f.correct ? 'guess__row--win' : ''}`} role="row">
      <div class="guess__who">
        <Avatar player={player} size={26} />
        <span>{player.name}</span>
      </div>
      <div class="guess__tiles">
        <Tile mark={f.club}>{meta.clubs[player.club].short}</Tile>
        <Tile mark={f.pos}>
          <abbr title={posFull(player.pos)}>{posLabel(player.pos)}</abbr>
        </Tile>
        <Tile mark={f.nat}>
          <span class="flag" title={`${countryName(player.nat)} · ${continentName(player.continent)}`}>
            {player.flag}
          </span>
        </Tile>
        <Tile mark={f.age.mark} dir={f.age.dir}>{player.age}</Tile>
        <Tile mark={f.value.mark} dir={f.value.dir}>
          {formatEur(valueOf(player), undefined, true)}
        </Tile>
      </div>
    </div>
  );
}

function useCountdown(active: boolean): string {
  const [ms, setMs] = useState(msUntilTomorrow);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setMs(msUntilTomorrow()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

interface EndProps {
  won: boolean;
  gaveUp: boolean;
  target: Player;
  feedback: Feedback[];
  mode: Mode;
  day: string;
  stats: ReturnType<typeof loadStats>;
  onNext?: () => void;
}

function EndPanel({ won, gaveUp, target, feedback, mode, day, stats, onNext }: EndProps) {
  const { meta } = useDataset();
  const [shared, setShared] = useState<string | null>(null);
  const countdown = useCountdown(mode === 'daily');
  const tries = won ? feedback.length : 'X';

  async function share() {
    const title = mode === 'daily' ? t('guess.shareDaily', { n: dayNumber(day) }) : t('guess.shareUnlimited');
    const text = `${title} ${tries}/${MAX_GUESSES} · ${shareValues()}\n${shareGrid(feedback)}\n${siteUrl()}#/guess`;
    setShared(shareNote(await shareText(text)));
  }

  return (
    <div class={`end ${won ? 'end--win' : 'end--lose'}`}>
      <p class="end__title">{won ? t('guess.won', { n: feedback.length }) : gaveUp ? t('guess.gaveUp') : t('guess.lost')}</p>
      <div class="reveal">
        <Avatar player={target} size={56} />
        <div>
          <p class="reveal__name">{target.name}</p>
          <p class="reveal__meta">
            <ClubChip code={target.club} /> · {posLabel(target.pos)} · {target.flag} {countryName(target.nat)} · {target.age}
          </p>
        </div>
      </div>
      <ValueCompare player={target} range />
      <div class="end__actions">
        <button class="btn" onClick={share}>
          {t('common.shareResult')}
        </button>
        {onNext && (
          <button class="btn btn--primary" onClick={onNext}>
            {t('common.nextPlayer')}
          </button>
        )}
      </div>
      {shared && <p class="end__note" role="status">{shared}</p>}
      {mode === 'daily' && (
        <p class="end__note">
          {tj('guess.nextDaily', { time: <b class="mono">{countdown}</b> })}
        </p>
      )}
      <StatsPanel stats={stats} highlight={won ? feedback.length : undefined} />
      <p class="end__foot">
        {t('guess.foot', { club: meta.clubs[target.club].name, date: formatDate(meta.dataDate) })}
      </p>
    </div>
  );
}
