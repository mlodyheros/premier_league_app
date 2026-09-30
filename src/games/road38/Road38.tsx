import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { Pitch } from '../../components/Pitch';
import { useDataset } from '../../data/store';
import { SOURCE_LABEL, SOURCE_SHORT, valueOf, valueSource, type ValueSource } from '../../data/valueSource';
import { formatEur, ordinal } from '../../lib/format';
import { clubTeams, formatOdds, USER_TEAM_ID, withUserTeam } from '../../lib/league';
import { getBest, submitBest } from '../../lib/records';
import { pick } from '../../lib/rng';
import { perfectSeasonOdds, simulateSeason, type MatchResult, type TableRow } from '../../lib/season';
import { shareText, siteUrl } from '../../lib/share';
import { readJson, writeJson } from '../../lib/storage';
import { formationByKey, FORMATIONS, teamStrength, type Lineup, type Slot } from '../../lib/strength';
import {
  badges,
  candidates,
  draftedIds,
  fillableSlots,
  openSlots,
  resultsGrid,
  RESPINS,
  spinnableClubs,
  userRow,
} from './logic';

interface SavedSeason {
  source: ValueSource;
  strength: number;
  odds: number;
  replaced: string;
  results: MatchResult[];
  table: TableRow[];
  position: number;
}

interface State {
  formation: string;
  /** slot id -> player name */
  picks: Record<string, string>;
  respins: number;
  club: string | null;
  season: SavedSeason | null;
}

interface Totals {
  seasons: number;
  titles: number;
  perfect: number;
}

const KEY = 'road:state';
const TOTALS_KEY = 'road:totals';
const SPIN_MS = 900;

function fresh(formation = '433'): State {
  return { formation, picks: {}, respins: RESPINS, club: null, season: null };
}

export function Road38() {
  const { players, meta } = useDataset();
  const source = valueSource.value;
  const byName = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);
  const clubCodes = useMemo(() => Object.keys(meta.clubs), [meta]);

  const [state, setState] = useState<State>(() => readJson<State>(KEY) ?? fresh());
  const [selected, setSelected] = useState<string | null>(null);
  const [spinning, setSpinning] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const spinTimer = useRef<number | undefined>(undefined);

  useEffect(() => writeJson(KEY, state), [state]);
  useEffect(() => () => clearInterval(spinTimer.current), []);

  const formation = formationByKey(state.formation);
  const lineup: Lineup = Object.fromEntries(Object.entries(state.picks).map(([s, n]) => [s, byName.get(n)]));
  const open = openSlots(formation, lineup);
  const complete = open.length === 0;
  const strength = teamStrength(formation, lineup, source);
  const bestKey = `road:pts:${source}`;
  const best = getBest(bestKey);

  const selectedSlot = formation.slots.find((s) => s.id === selected && !lineup[s.id]) ?? null;
  const list = state.club ? candidates(players, state.club, formation, lineup, source, selectedSlot) : [];
  const hint = state.club ? fillableSlots(players, state.club, formation, lineup) : undefined;

  function spin(isRespin: boolean) {
    if (spinning) return;
    const pool = spinnableClubs(players, clubCodes, formation, lineup, source).filter(
      (c) => !isRespin || c !== state.club,
    );
    if (!pool.length) return;
    const landing = pick(pool);
    setSelected(null);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      setSpinning(null);
      setState((s) => ({ ...s, club: landing, respins: isRespin ? s.respins - 1 : s.respins }));
    };
    if (reduce) return finish();
    const started = Date.now();
    spinTimer.current = window.setInterval(() => {
      if (Date.now() - started >= SPIN_MS) {
        clearInterval(spinTimer.current);
        finish();
      } else {
        setSpinning(pick(clubCodes));
      }
    }, 70);
  }

  function choose(playerName: string, slot: Slot) {
    setState((s) => ({ ...s, picks: { ...s.picks, [slot.id]: playerName }, club: null }));
    setSelected(null);
  }

  function onSlot(slot: Slot) {
    if (lineup[slot.id] || !state.club) return;
    setSelected(selected === slot.id ? null : slot.id);
  }

  function kickOff() {
    const without = draftedIds(lineup);
    const clubs = clubTeams(players, meta, source, without);
    const { league, replaced } = withUserTeam(clubs, strength);
    const opponents = league.filter((t) => t.id !== USER_TEAM_ID).map((t) => t.strength);
    const odds = perfectSeasonOdds(strength, opponents);
    const season = simulateSeason(league, USER_TEAM_ID, Math.random);
    const row = userRow(season.table, USER_TEAM_ID);

    submitBest(bestKey, row.points);
    const totals = readJson<Totals>(TOTALS_KEY) ?? { seasons: 0, titles: 0, perfect: 0 };
    writeJson(TOTALS_KEY, {
      seasons: totals.seasons + 1,
      titles: totals.titles + (season.position === 1 ? 1 : 0),
      perfect: totals.perfect + (row.won === 38 ? 1 : 0),
    });

    setState((s) => ({
      ...s,
      season: {
        source,
        strength,
        odds,
        replaced: replaced.name,
        results: season.results,
        table: season.table,
        position: season.position,
      },
    }));
  }

  function newDraft() {
    setState(fresh(state.formation));
    setSelected(null);
    setNote(null);
  }

  async function share(season: SavedSeason) {
    const row = userRow(season.table, USER_TEAM_ID);
    const icons = badges(row, season.position).map((b) => b.icon).join('');
    const text = `Road to 38-0 · ${row.won}-${row.drawn}-${row.lost} · ${row.points} pts · ${ordinal(season.position)} ${icons}\n${resultsGrid(season.results)}\n${SOURCE_SHORT[season.source]} values · ${siteUrl()}#/road38`;
    const r = await shareText(text);
    setNote(r === 'copied' ? 'Copied to clipboard' : r === 'shared' ? 'Shared' : 'Could not share');
  }

  const shownClub = spinning ?? state.club;

  return (
    <section class="game road">
      <div class="game__head">
        <h1>Road to 38-0</h1>
        <div class="scorebug">
          <span>
            <small>OVR</small>
            <b>{strength ? strength.toFixed(1) : '–'}</b>
          </span>
          <span>
            <small>Best pts</small>
            <b>{best ?? '–'}</b>
          </span>
        </div>
      </div>
      <p class="lede">
        Spin a club, take one of its players for an open position, and spin again until your XI is full. You have{' '}
        {RESPINS} re-spins. Then play a 38-game season against the real league. Ratings use <b>{SOURCE_LABEL[source]}</b>{' '}
        values, and every player you take leaves his club weaker.
      </p>

      {!state.season && (
        <>
          <div class="controls">
            <label>
              Formation
              <select
                value={state.formation}
                disabled={Object.keys(state.picks).length > 0}
                onChange={(e) => setState(fresh((e.target as HTMLSelectElement).value))}
              >
                {FORMATIONS.map((f) => (
                  <option value={f.key}>{f.label}</option>
                ))}
              </select>
            </label>
            <span class="controls__info">
              {11 - open.length}/11 picked · {state.respins} re-spin{state.respins === 1 ? '' : 's'} left
            </span>
          </div>

          <div class="squad-layout">
            <Pitch
              formation={formation}
              lineup={lineup}
              source={source}
              selected={selectedSlot?.id}
              highlight={hint}
              onSlot={onSlot}
            />

            <div class="picker">
              {!complete && (
                <div class={`spinner ${spinning ? 'spinner--on' : ''}`} aria-live="polite">
                  {shownClub ? (
                    <div class="spinner__club">
                      <i
                        style={{
                          background: meta.clubs[shownClub].primary,
                          borderColor: meta.clubs[shownClub].secondary,
                        }}
                      />
                      <span>{meta.clubs[shownClub].name}</span>
                    </div>
                  ) : (
                    <p class="picker__hint">Spin to draw your {open.length === 11 ? 'first' : 'next'} club.</p>
                  )}
                  <div class="spinner__actions">
                    {!state.club && (
                      <button class="btn btn--primary" onClick={() => spin(false)} disabled={!!spinning}>
                        {spinning ? 'Spinning…' : 'Spin'}
                      </button>
                    )}
                    {state.club && !spinning && (
                      <button class="btn" onClick={() => spin(true)} disabled={state.respins === 0}>
                        Re-spin ({state.respins})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {state.club && !spinning && (
                <>
                  <p class="picker__hint">
                    {selectedSlot
                      ? `Showing players for ${selectedSlot.type}. Tap the position again to see everyone.`
                      : 'Pick a player. He goes to his best open position, or tap a glowing position first.'}
                  </p>
                  <ul class="picker__list">
                    {list.map((c) => (
                      <li>
                        <button class="prow" onClick={() => choose(c.player.name, c.slot)}>
                          <Avatar player={c.player} size={30} />
                          <span class="prow__name">
                            {c.player.name}
                            <small>
                              {c.player.pos} → {c.slot.type} · {formatEur(valueOf(c.player, source))}
                            </small>
                          </span>
                          <span class="prow__ovr">{Math.round(c.rating)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {complete && (
                <div class="kickoff">
                  <p>
                    Your XI is complete: <b>{strength.toFixed(1)} OVR</b>.
                  </p>
                  <button class="btn btn--primary btn--big" onClick={kickOff}>
                    Kick off the season ⚽
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {state.season && <SeasonView season={state.season} onShare={share} onNew={newDraft} note={note} lineup={lineup} />}
    </section>
  );
}

function SeasonView({
  season,
  lineup,
  onShare,
  onNew,
  note,
}: {
  season: SavedSeason;
  lineup: Lineup;
  onShare: (s: SavedSeason) => void;
  onNew: () => void;
  note: string | null;
}) {
  const row = userRow(season.table, USER_TEAM_ID);
  const earned = badges(row, season.position);
  const names = Object.values(lineup)
    .flatMap((p) => (p ? [p.short] : []))
    .join(', ');

  return (
    <div class="season">
      <div class={`end ${season.position === 1 ? 'end--win' : 'end--lose'}`}>
        <p class="season__record">
          {row.won}-{row.drawn}-{row.lost}
        </p>
        <p class="end__title">
          {row.points} pts · {ordinal(season.position)}
        </p>
        {earned.length > 0 && (
          <ul class="badges">
            {earned.map((b) => (
              <li>
                <span aria-hidden="true">{b.icon}</span> {b.label}
              </li>
            ))}
          </ul>
        )}
        <p class="end__note">
          Your {season.strength.toFixed(1)} OVR XI had a <b>{formatOdds(season.odds)}</b> chance of going 38-0. It took{' '}
          {season.replaced}'s place in the league. Goals {row.goalsFor}–{row.goalsAgainst}.
        </p>
        <ol class="strip" aria-label="Results in order">
          {season.results.map((r, i) => (
            <li
              class={`strip__m strip__m--${r.outcome}`}
              title={`${i + 1}. ${r.home ? 'vs' : 'at'} ${r.opponent} ${r.goalsFor}-${r.goalsAgainst}`}
            >
              <span class="sr-only">
                {r.home ? 'vs' : 'at'} {r.opponent} {r.goalsFor}-{r.goalsAgainst}
              </span>
            </li>
          ))}
        </ol>
        <div class="end__actions">
          <button class="btn btn--primary" onClick={onNew}>
            New draft
          </button>
          <button class="btn" onClick={() => onShare(season)}>
            Share
          </button>
        </div>
        {note && <p class="end__note" role="status">{note}</p>}
        <p class="end__foot">Your XI: {names}</p>
      </div>

      <details class="table-wrap" open>
        <summary>Final table</summary>
        <table class="league">
          <thead>
            <tr>
              <th>#</th>
              <th class="l">Team</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>GD</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {season.table.map((t, i) => (
              <tr class={t.id === USER_TEAM_ID ? 'you' : ''}>
                <td>{i + 1}</td>
                <td class="l">{t.name}</td>
                <td>{t.won}</td>
                <td>{t.drawn}</td>
                <td>{t.lost}</td>
                <td>{t.goalsFor - t.goalsAgainst > 0 ? '+' : ''}{t.goalsFor - t.goalsAgainst}</td>
                <td>
                  <b>{t.points}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
