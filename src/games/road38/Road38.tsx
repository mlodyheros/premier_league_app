import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Avatar, Crest } from '../../components/Avatar';
import { Pitch } from '../../components/Pitch';
import { notifyShare } from '../../components/Toast';
import { useDataset } from '../../data/store';
import { shareValues, valueOf, valueSource, valuesPhrase, type ValueSource } from '../../data/valueSource';
import { useCountUp } from '../../hooks/useCountUp';
import { t, tj } from '../../i18n';
import { posLabel } from '../../i18n/labels';
import { trackEvent } from '../../lib/analytics';
import { formatDecimal, formatEur, formatOdds, ordinal } from '../../lib/format';
import { clubTeams, USER_TEAM_ID, withUserTeam } from '../../lib/league';
import { buzz, celebrate, reducedMotion } from '../../lib/motion';
import { getBest, submitBest } from '../../lib/records';
import { pick } from '../../lib/rng';
import {
  DIFFICULTY,
  perfectSeasonOdds,
  simulateSeason,
  type Difficulty,
  type MatchResult,
  type TableRow,
} from '../../lib/season';
import { shareText, siteUrl } from '../../lib/share';
import { readJson, writeJson } from '../../lib/storage';
import { formationByKey, FORMATIONS, rating, teamStrength, type Lineup, type Slot } from '../../lib/strength';
import {
  badges,
  byName,
  candidates,
  draftedIds,
  drawSpin,
  drawsPosition,
  DRAFT_MODES,
  fillableSlots,
  hidesRatings,
  openSlots,
  resultsGrid,
  RESPINS,
  userRow,
  type DraftMode,
  type Spin,
} from './logic';

interface SavedSeason {
  source: ValueSource;
  difficulty?: Difficulty;
  draft?: DraftMode;
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
  spin: Spin | null;
  season: SavedSeason | null;
  difficulty?: Difficulty;
  draft?: DraftMode;
  /** Saved by older versions, before positions could be drawn. */
  club?: string | null;
}

interface Totals {
  seasons: number;
  titles: number;
  perfect: number;
}

const KEY = 'road:state';
const TOTALS_KEY = 'road:totals';
/** The reel slows down: the gaps between frames, in ms. */
const REEL = [55, 55, 60, 65, 70, 80, 90, 105, 125, 150, 185, 230, 290];

function fresh(formation = '433', difficulty: Difficulty = 'realistic', draft: DraftMode = 'standard'): State {
  return { formation, picks: {}, respins: RESPINS, spin: null, season: null, difficulty, draft };
}

function load(): State {
  const saved = readJson<State>(KEY);
  if (!saved) return fresh();
  // Older saves kept only the club.
  if (saved.spin === undefined) saved.spin = saved.club ? { club: saved.club, slot: null } : null;
  return saved;
}

/** Realistic standard keeps the original key, so bests from before modes existed still count. */
function bestKeyFor(source: ValueSource, difficulty: Difficulty, draft: DraftMode): string {
  let key = `road:pts:${source}`;
  if (difficulty !== 'realistic') key += `:${difficulty}`;
  if (draft !== 'standard') key += `:${draft}`;
  return key;
}

export function Road38() {
  const { players, meta } = useDataset();
  const source = valueSource.value;
  const playerByName = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);
  const clubCodes = useMemo(() => Object.keys(meta.clubs), [meta]);

  const [state, setState] = useState<State>(load);
  const [selected, setSelected] = useState<string | null>(null);
  const [reel, setReel] = useState<Spin | null>(null);
  const [landed, setLanded] = useState(false);
  const [justPlayed, setJustPlayed] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => writeJson(KEY, state), [state]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const formation = formationByKey(state.formation);
  const lineup: Lineup = Object.fromEntries(Object.entries(state.picks).map(([s, n]) => [s, playerByName.get(n)]));
  const open = openSlots(formation, lineup);
  const complete = open.length === 0;
  const strength = teamStrength(formation, lineup, source);
  const difficulty: Difficulty = state.difficulty ?? 'realistic';
  const draft: DraftMode = state.draft ?? 'standard';
  const blind = hidesRatings(draft);
  const bestKey = bestKeyFor(source, difficulty, draft);
  const best = getBest(bestKey);
  const started = Object.keys(state.picks).length > 0 || !!state.spin;
  const spinning = reel !== null;

  // In the position modes the drawn slot is the only one that can be filled.
  const drawnSlot = state.spin?.slot ? (formation.slots.find((s) => s.id === state.spin!.slot) ?? null) : null;
  const chosenSlot = drawnSlot ?? formation.slots.find((s) => s.id === selected && !lineup[s.id]) ?? null;
  const rawList = state.spin ? candidates(players, state.spin.club, formation, lineup, source, chosenSlot) : [];
  const list = blind ? byName(rawList) : rawList;
  const hint = drawnSlot
    ? new Set([drawnSlot.id])
    : state.spin
      ? fillableSlots(players, state.spin.club, formation, lineup)
      : undefined;

  function spin(isRespin: boolean) {
    if (spinning) return;
    const landing = drawSpin(players, clubCodes, formation, lineup, draft, Math.random, isRespin ? state.spin : null);
    if (!landing) return;
    setSelected(null);
    setLanded(false);
    buzz('tap');
    const finish = () => {
      setReel(null);
      setLanded(true);
      buzz('good');
      setState((s) => ({ ...s, spin: landing, respins: isRespin ? s.respins - 1 : s.respins }));
    };
    if (reducedMotion()) return finish();
    const positions = open.map((s) => s.id);
    let at = 0;
    timers.current = REEL.map((gap) => {
      at += gap;
      return window.setTimeout(
        () => setReel({ club: pick(clubCodes), slot: drawsPosition(draft) ? pick(positions) : null }),
        at,
      );
    });
    timers.current.push(window.setTimeout(finish, at + 200));
  }

  function choose(playerName: string, slot: Slot) {
    buzz('tap');
    setState((s) => ({ ...s, picks: { ...s.picks, [slot.id]: playerName }, spin: null }));
    setSelected(null);
    setLanded(false);
  }

  function onSlot(slot: Slot) {
    if (lineup[slot.id] || !state.spin || drawnSlot) return;
    setSelected(selected === slot.id ? null : slot.id);
  }

  function kickOff() {
    const without = draftedIds(lineup);
    const clubs = clubTeams(players, meta, source, without);
    const { model, bonus } = DIFFICULTY[difficulty];
    const { league, replaced } = withUserTeam(clubs, strength + bonus);
    const opponents = league.filter((team) => team.id !== USER_TEAM_ID).map((team) => team.strength);
    const odds = perfectSeasonOdds(strength + bonus, opponents, model);
    const season = simulateSeason(league, USER_TEAM_ID, Math.random, model);
    const row = userRow(season.table, USER_TEAM_ID);
    trackEvent(`road/${difficulty}/${draft}/ovr-${Math.floor(strength)}/pos-${season.position}/w-${row.won}`);

    submitBest(bestKey, row.points);
    const totals = readJson<Totals>(TOTALS_KEY) ?? { seasons: 0, titles: 0, perfect: 0 };
    writeJson(TOTALS_KEY, {
      seasons: totals.seasons + 1,
      titles: totals.titles + (season.position === 1 ? 1 : 0),
      perfect: totals.perfect + (row.won === 38 ? 1 : 0),
    });

    setJustPlayed(true);
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    setState((s) => ({
      ...s,
      season: {
        source,
        difficulty,
        draft,
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
    setState(fresh(state.formation, difficulty, draft));
    setSelected(null);
    setJustPlayed(false);
  }

  async function share(season: SavedSeason) {
    const row = userRow(season.table, USER_TEAM_ID);
    const icons = badges(row, season.position).map((b) => b.icon).join('');
    const modes = [
      season.draft && season.draft !== 'standard' ? t(`road.draft.${season.draft}`) : '',
      season.difficulty === 'arcade' ? t('road.mode.arcade') : '',
    ].filter(Boolean);
    const head = t('road.share', {
      w: row.won,
      d: row.drawn,
      l: row.lost,
      pts: row.points,
      pos: ordinal(season.position),
      icons: [icons, ...modes].filter(Boolean).join(' · '),
    });
    notifyShare(await shareText(`${head}\n${resultsGrid(season.results)}\n${shareValues(season.source)} · ${siteUrl()}#/road38`));
  }

  const shown = reel ?? state.spin;

  return (
    <section class="game road">
      <div class="game__head">
        <h1>{t('game.road.title')}</h1>
        <div class="scorebug">
          <span>
            <small>{t('common.ovr')}</small>
            <b>{blind && !state.season ? '?' : strength ? formatDecimal(strength) : '–'}</b>
          </span>
          <span>
            <small>{t('road.bestPts')}</small>
            <b>{best ?? '–'}</b>
          </span>
        </div>
      </div>
      <p class="lede">
        {tj('road.lede', {
          respins: t('road.respins', { count: RESPINS }),
          values: <b>{valuesPhrase(source)}</b>,
        })}
      </p>

      {!state.season && (
        <>
          <div class="controls">
            <label>
              {t('budget.formation')}
              <select
                value={state.formation}
                disabled={started}
                onChange={(e) => setState(fresh((e.target as HTMLSelectElement).value, difficulty, draft))}
              >
                {FORMATIONS.map((f) => (
                  <option value={f.key}>{f.label}</option>
                ))}
              </select>
            </label>
            <label>
              {t('road.draft')}
              <select
                value={draft}
                disabled={started}
                onChange={(e) => setState(fresh(state.formation, difficulty, (e.target as HTMLSelectElement).value as DraftMode))}
              >
                {DRAFT_MODES.map((d) => (
                  <option value={d}>{t(`road.draft.${d}`)}</option>
                ))}
              </select>
            </label>
            <label>
              {t('road.mode')}
              <select
                value={difficulty}
                onChange={(e) =>
                  setState((st) => ({ ...st, difficulty: (e.target as HTMLSelectElement).value as Difficulty }))
                }
              >
                {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
                  <option value={d}>{t(`road.mode.${d}`)}</option>
                ))}
              </select>
            </label>
          </div>
          <p class="mode-help">
            {t(`road.draft.help.${draft}`)} {t(`road.mode.help.${difficulty}`, { bonus: DIFFICULTY.arcade.bonus })}
          </p>
          <p class="controls__info">{t('road.progress', { picked: 11 - open.length, count: state.respins })}</p>

          <div class="squad-layout">
            <Pitch
              formation={formation}
              lineup={lineup}
              source={source}
              selected={chosenSlot?.id}
              highlight={hint}
              onSlot={onSlot}
              hideRatings={blind}
            />

            <div class="picker">
              {!complete && (
                <div class={`spinner ${spinning ? 'spinner--on' : ''} ${landed ? 'spinner--landed' : ''}`} aria-live="polite">
                  {shown ? (
                    <div class="spinner__reel" key={`${shown.club}-${shown.slot}-${spinning}`}>
                      <Crest code={shown.club} size={56} />
                      <div class="spinner__text">
                        <span class="spinner__club">{meta.clubs[shown.club].name}</span>
                        {shown.slot && (
                          <span class="spinner__slot">
                            {t('road.drawnSlot', {
                              pos: posLabel(formation.slots.find((s) => s.id === shown.slot)?.type ?? 'CM'),
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p class="picker__hint">{t(open.length === 11 ? 'road.spinFirst' : 'road.spinNext')}</p>
                  )}
                  <div class="spinner__actions">
                    {!state.spin && (
                      <button class="btn btn--primary btn--spin" onClick={() => spin(false)} disabled={spinning}>
                        {spinning ? t('road.spinning') : t('road.spin')}
                      </button>
                    )}
                    {state.spin && !spinning && (
                      <button class="btn" onClick={() => spin(true)} disabled={state.respins === 0}>
                        {t('road.respin', { n: state.respins })}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {state.spin && !spinning && (
                <>
                  <p class="picker__hint">
                    {drawnSlot
                      ? t('road.pickForSlot', { pos: posLabel(drawnSlot.type) })
                      : chosenSlot
                        ? t('road.showingSlot', { pos: posLabel(chosenSlot.type) })
                        : t('road.pickHint')}
                  </p>
                  <ul class="picker__list">
                    {list.map((c, i) => (
                      <li style={{ '--i': i }}>
                        <button class="prow" onClick={() => choose(c.player.name, c.slot)}>
                          <Avatar player={c.player} size={30} />
                          <span class="prow__name">
                            {c.player.name}
                            <small>
                              {posLabel(c.player.pos)}
                              {!drawnSlot && <> → {posLabel(c.slot.type)}</>}
                              {!blind && <> · {formatEur(valueOf(c.player, source))}</>}
                            </small>
                          </span>
                          {!blind && <span class="prow__ovr">{Math.round(c.rating)}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {complete && (
                <div class="kickoff">
                  <p>
                    {blind ? t('road.completeBlind') : tj('road.complete', { ovr: <b>{formatDecimal(strength)}</b> })}
                  </p>
                  <button class="btn btn--primary btn--big btn--pulse" onClick={kickOff}>
                    {t('road.kickoff')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {state.season && (
        <SeasonView
          season={state.season}
          lineup={lineup}
          formation={formation}
          animate={justPlayed}
          onShare={share}
          onNew={newDraft}
        />
      )}
    </section>
  );
}

function SeasonView({
  season,
  lineup,
  formation,
  animate,
  onShare,
  onNew,
}: {
  season: SavedSeason;
  lineup: Lineup;
  formation: ReturnType<typeof formationByKey>;
  animate: boolean;
  onShare: (s: SavedSeason) => void;
  onNew: () => void;
}) {
  const row = userRow(season.table, USER_TEAM_ID);
  const earned = badges(row, season.position);
  const won = useCountUp(row.won, animate, 1400);
  const drawn = useCountUp(row.drawn, animate, 1400);
  const lost = useCountUp(row.lost, animate, 1400);
  const points = useCountUp(row.points, animate, 1600);

  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(() => {
      if (season.position === 1) celebrate(row.won === 38 || row.lost === 0);
      buzz(season.position === 1 ? 'good' : 'tap');
    }, 1500);
    return () => clearTimeout(timer);
  }, [animate]);

  const modes = [
    season.draft && season.draft !== 'standard' ? t(`road.draft.${season.draft}`) : null,
    season.difficulty === 'arcade' ? t('road.mode.arcade') : null,
  ].filter(Boolean);

  return (
    <div class={`season ${animate ? 'season--fresh' : ''}`}>
      <div class={`end ${season.position === 1 ? 'end--win' : 'end--lose'}`}>
        {modes.map((m) => (
          <span class="mode-chip">{m}</span>
        ))}
        <p class="season__record" aria-label={`${row.won}-${row.drawn}-${row.lost}`}>
          {Math.round(won)}-{Math.round(drawn)}-{Math.round(lost)}
        </p>
        <p class="end__title">{t('road.result', { pts: Math.round(points), pos: ordinal(season.position) })}</p>
        {earned.length > 0 && (
          <ul class="badges">
            {earned.map((b) => (
              <li>
                <span aria-hidden="true">{b.icon}</span> {t(b.label)}
              </li>
            ))}
          </ul>
        )}
        <p class="end__note">
          {tj('road.note', {
            ovr: formatDecimal(season.strength),
            boost: season.difficulty === 'arcade' ? t('road.boost', { n: DIFFICULTY.arcade.bonus }) : '',
            odds: <b>{formatOdds(season.odds)}</b>,
            club: season.replaced,
            gf: row.goalsFor,
            ga: row.goalsAgainst,
          })}
        </p>
        <ol class="strip" aria-label={t('road.results')}>
          {season.results.map((r, i) => (
            <li
              class={`strip__m strip__m--${r.outcome}`}
              style={{ '--i': i }}
              title={`${i + 1}. ${t(r.home ? 'road.home' : 'road.away', { opp: r.opponent })} ${r.goalsFor}-${r.goalsAgainst}`}
            >
              <span class="sr-only">
                {t(r.home ? 'road.home' : 'road.away', { opp: r.opponent })} {r.goalsFor}-{r.goalsAgainst}
              </span>
            </li>
          ))}
        </ol>
        <div class="end__actions">
          <button class="btn btn--primary" onClick={onNew}>
            {t('road.newDraft')}
          </button>
          <button class="btn" onClick={() => onShare(season)}>
            {t('common.share')}
          </button>
        </div>
      </div>

      <div class="xi-reveal">
        <h2>{t('road.yourXi')}</h2>
        <ul>
          {[...formation.slots].reverse().map((slot, i) => {
            const p = lineup[slot.id];
            if (!p) return null;
            return (
              <li style={{ '--i': i }}>
                <span class="xi-reveal__pos">{posLabel(slot.type)}</span>
                <Avatar player={p} size={28} />
                <span class="xi-reveal__name">{p.name}</span>
                <span class="xi-reveal__ovr">{rating(p, season.source)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <details class="table-wrap" open>
        <summary>{t('road.table')}</summary>
        <table class="league">
          <thead>
            <tr>
              <th>#</th>
              <th class="l">{t('road.col.team')}</th>
              <th>{t('road.col.w')}</th>
              <th>{t('road.col.d')}</th>
              <th>{t('road.col.l')}</th>
              <th>{t('road.col.gd')}</th>
              <th>{t('road.col.pts')}</th>
            </tr>
          </thead>
          <tbody>
            {season.table.map((team, i) => (
              <tr class={team.id === USER_TEAM_ID ? 'you' : ''}>
                <td>{i + 1}</td>
                <td class="l">
                  <span class="league__team">
                    {team.id === USER_TEAM_ID ? (
                      <span class="league__you" aria-hidden="true">
                        ★
                      </span>
                    ) : (
                      <Crest code={team.id} size={18} />
                    )}
                    {team.id === USER_TEAM_ID ? t('road.yourXi') : team.name}
                  </span>
                </td>
                <td>{team.won}</td>
                <td>{team.drawn}</td>
                <td>{team.lost}</td>
                <td>
                  {team.goalsFor - team.goalsAgainst > 0 ? '+' : ''}
                  {team.goalsFor - team.goalsAgainst}
                </td>
                <td>
                  <b>{team.points}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
