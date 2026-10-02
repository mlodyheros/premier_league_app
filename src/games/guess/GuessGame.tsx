import { GameHeader, OtherGames } from '../../components/GameHeader';
import { cardFooter } from '../../lib/shareSpecs';
import { openShare } from '../../components/ShareSheet';
import { Icon } from '../../components/Icon';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Avatar, ClubChip, Crest } from '../../components/Avatar';
import { PlayerSearch } from '../../components/PlayerSearch';
import { StatsPanel } from '../../components/StatsPanel';
import { useDataset } from '../../data/store';
import type { Player } from '../../data/types';
import { shareValues, sourceShort, valueOf, valuePhrase, valueSource, valuesPhrase } from '../../data/valueSource';
import { t, tj } from '../../i18n';
import { continentName, countryName } from '../../i18n/countries';
import { posFull, posLabel } from '../../i18n/labels';
import { formatDate, formatEur } from '../../lib/format';
import { useCountdown } from '../../hooks/useCountdown';
import { rovingKeys } from '../../lib/a11y';
import { trackEvent } from '../../lib/analytics';
import { poolLevel, poolOf } from '../../lib/pools';
import { PoolNote } from '../../components/PoolNote';
import { buzz, celebrate } from '../../lib/motion';
import { saveDailyResult } from '../../lib/daily';
import { dayNumber, pick, previousDayKey, todayKey } from '../../lib/rng';
import { shareUrl } from '../../lib/share';
import type { Cell } from '../../lib/shareCard';
import { loadStats, recordResult, saveStats } from '../../lib/stats';
import { readJson, writeJson } from '../../lib/storage';
import { guessTarget } from '../../lib/dailyRounds';
import { compare, dailyPool, HINT_AFTER, MAX_GUESSES, shareGrid, stillPossible, type Feedback, type Mark } from './logic';

type Mode = 'daily' | 'unlimited';

/**
 * Saved progress. Players are stored by name, not id: ids are row numbers in
 * pl-value's dataset and shift when squads change, names do not.
 */
interface Round {
  target: string;
  guesses: string[];
  recorded: boolean;
  gaveUp?: boolean;
  /** The club hint was revealed. */
  hint?: boolean;
}

const MODE_KEY = 'guess:mode';
const dailyKey = (day: string) => `guess:daily:${day}`;
const UNLIMITED_KEY = 'guess:unlimited';

function newUnlimitedRound(players: Player[]): Round {
  return { target: pick(poolOf(players, poolLevel.value)).name, guesses: [], recorded: false };
}

export function GuessGame() {
  const { players, schedule } = useDataset();
  const byName = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);
  const source = valueSource.value;

  const [mode, setMode] = useState<Mode>(() => readJson<Mode>(MODE_KEY) ?? 'daily');
  const [day] = useState(todayKey);

  const [round, setRound] = useState<Round>(() => loadRound(mode));

  function loadRound(m: Mode): Round {
    if (m === 'daily') {
      const target = guessTarget(players, schedule, day).name;
      const saved = readJson<Round>(dailyKey(day));
      return saved && saved.target === target ? saved : { target, guesses: [], recorded: false };
    }
    const saved = readJson<Round>(UNLIMITED_KEY);
    return saved && byName.has(saved.target) ? saved : newUnlimitedRound(players);
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
    if (mode === 'daily') saveDailyResult('guess', day, `${won ? guesses.length : 'X'}/${MAX_GUESSES}`);
    trackEvent(`guess/${mode}/${won ? `won-${guesses.length}` : round.gaveUp ? 'gave-up' : 'lost'}`);
    // Let the last row's tiles flip before the celebration.
    if (won) setTimeout(() => celebrate(guesses.length <= 3), 700);
    setRound((r) => ({ ...r, recorded: true }));
  }, [over]);

  function guess(p: Player) {
    if (over) return;
    buzz(p.name === target.name ? 'good' : 'tap');
    setRound((r) => ({ ...r, guesses: [...r.guesses, p.name] }));
  }

  function giveUp() {
    setRound((r) => ({ ...r, gaveUp: true }));
  }

  const guessedIds = useMemo(() => new Set(guesses.map((g) => g.id)), [guesses]);
  // Who could it still be? Counted over the pool the answer was drawn from.
  const answerPool = useMemo(
    () => (mode === 'daily' ? dailyPool(players, day) : poolOf(players, poolLevel.value)),
    [mode, players, day, poolLevel.value],
  );
  const possible = useMemo(
    () => (guesses.length ? stillPossible(answerPool, guesses, feedback, source).length : answerPool.length),
    [answerPool, round.guesses, source],
  );
  const clubKnown = feedback.some((f) => f.club === 'hit');
  const canHint = !over && !round.hint && !clubKnown && guesses.length >= HINT_AFTER;
  const rows = guesses.map((g, i) => ({ g, f: feedback[i] })).reverse();

  return (
    <section class="game guess">
      <GameHeader
        game="guess"
        tabs={
          <div class="tabs" role="tablist" onKeyDown={rovingKeys}>
            <button
              role="tab"
              aria-selected={mode === 'daily'}
              tabIndex={mode === 'daily' ? 0 : -1}
              onClick={() => switchMode('daily')}
            >
              {t('guess.daily', { n: dayNumber(day) })}
            </button>
            <button
              role="tab"
              aria-selected={mode === 'unlimited'}
              tabIndex={mode === 'unlimited' ? 0 : -1}
              onClick={() => switchMode('unlimited')}
            >
              {t('guess.unlimited')}
            </button>
          </div>
        }
      >
        <p>
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
      </GameHeader>

      {!over && (
        <p class="guess__legend">
          <Tile mark="hit">{t('guess.exact')}</Tile> <Tile mark="near">{t('guess.close')}</Tile>
        </p>
      )}

      {!over && (
        <div class="guess__input">
          <PlayerSearch onPick={guess} exclude={guessedIds} placeholder={t('guess.placeholder', { n: guesses.length + 1, max: MAX_GUESSES })} />
          <p class="guess__status" aria-live="polite">
            <span>
              {t('guess.tries', { n: guesses.length + 1, max: MAX_GUESSES })} ·{' '}
              {t(guesses.length ? 'guess.possible' : 'guess.pool', { count: Math.max(possible, 1) })}
            </span>
            {canHint && (
              <button class="link-btn" onClick={() => setRound((r) => ({ ...r, hint: true }))}>
                <Icon name="bulb" size={18} /> {t('guess.hintButton')}
              </button>
            )}
          </p>
          {round.hint && !clubKnown && (
            <p class="guess__hint">
              <Icon name="bulb" size={18} /> {tj('guess.hintClub', { club: <ClubChip code={target.club} /> })}
            </p>
          )}
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
          hinted={!!round.hint}
          onNext={mode === 'unlimited' ? () => setRound(newUnlimitedRound(players)) : () => switchMode('unlimited')}
        />
      )}

      {mode === 'unlimited' && !over && guesses.length === 0 && <PoolNote />}

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
      <OtherGames current="guess" />
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
        <Tile mark={f.club}>
          <span class="tile__club">
            <Crest code={player.club} size={20} />
            <small>{meta.clubs[player.club].short}</small>
          </span>
        </Tile>
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

interface EndProps {
  won: boolean;
  gaveUp: boolean;
  target: Player;
  feedback: Feedback[];
  mode: Mode;
  day: string;
  stats: ReturnType<typeof loadStats>;
  hinted: boolean;
  onNext: () => void;
}

function EndPanel({ won, gaveUp, target, feedback, mode, day, stats, hinted, onNext }: EndProps) {
  const { meta } = useDataset();
  const countdown = useCountdown(mode === 'daily');
  const tries = won ? feedback.length : 'X';

  /** A card of the guesses' colours: no names, so it gives nothing away. */
  function share() {
    const cell: Record<Mark, Cell> = { hit: 'good', near: 'mid', miss: 'none' };
    const title = mode === 'daily' ? t('guess.shareDaily', { n: dayNumber(day) }) : t('guess.shareUnlimited');
    const text = `${title} ${tries}/${MAX_GUESSES}${hinted ? ' 💡' : ''} · ${shareValues()}\n${shareGrid(feedback)}\n${shareUrl('guess')}`;
    openShare(
      {
        game: t('game.guess.title'),
        kicker: mode === 'daily' ? t('mode.daily', { n: dayNumber(day) }) : t('guess.unlimited'),
        headline: `${tries}/${MAX_GUESSES}`,
        sub: (won ? t('guess.won', { n: feedback.length }) : t('guess.lost')) + (hinted ? ` · ${t('guess.hintUsed')}` : ''),
        grid: feedback.map((f) => [f.club, f.pos, f.nat, f.age.mark, f.value.mark].map((m) => cell[m])),
        ...cardFooter(t('share.ctaGuess')),
      },
      text,
      'pl-games-guess',
    );
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
      <p class="reveal__value">
        <small>{valuePhrase()}</small>
        {formatEur(valueOf(target))}
      </p>
      <div class="end__actions">
        <button class="btn" onClick={share}>
          <Icon name="share" size={18} /> {t('common.share')}
        </button>
        <button class="btn btn--primary" onClick={onNext}>
          {mode === 'daily' ? t('guess.keepPlaying') : t('common.nextPlayer')}
        </button>
      </div>
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
