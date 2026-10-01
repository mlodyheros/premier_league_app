import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Avatar, Crest } from '../../components/Avatar';
import { Pitch } from '../../components/Pitch';
import { resultsGrid, SeasonResult, seasonBadges, userRow } from '../../components/SeasonResult';
import { notifyShare } from '../../components/Toast';
import { useDataset } from '../../data/store';
import { shareValues, valueOf, valueSource, valuesPhrase, type ValueSource } from '../../data/valueSource';
import { t, tj } from '../../i18n';
import { posLabel } from '../../i18n/labels';
import { trackEvent } from '../../lib/analytics';
import { formatDecimal, formatEur, ordinal } from '../../lib/format';
import { buzz, reducedMotion } from '../../lib/motion';
import { playSeason, type PlayedSeason } from '../../lib/playSeason';
import { getBest, submitBest } from '../../lib/records';
import { pick } from '../../lib/rng';
import { DIFFICULTY, type Difficulty } from '../../lib/season';
import { shareText, siteUrl } from '../../lib/share';
import { readJson, writeJson } from '../../lib/storage';
import { formationByKey, FORMATIONS, teamStrength, type Lineup, type Slot } from '../../lib/strength';
import {
  byName,
  candidates,
  draftedIds,
  drawSpin,
  drawsPosition,
  DRAFT_MODES,
  fillableSlots,
  hidesRatings,
  openSlots,
  RESPINS,
  type DraftMode,
  type Spin,
} from './logic';

type SavedSeason = PlayedSeason;

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
    // Stage one spins the clubs; in the position modes stage two then spins
    // the positions, with the club already settled.
    const positions = [...fillableSlots(players, landing.club, formation, lineup)];
    let at = 0;
    timers.current = REEL.map((gap) => {
      at += gap;
      return window.setTimeout(() => setReel({ club: pick(clubCodes), slot: null }), at);
    });
    if (drawsPosition(draft)) {
      at += 260;
      timers.current.push(window.setTimeout(() => (buzz('tap'), setReel({ club: landing.club, slot: '' })), at));
      for (const gap of REEL.slice(3)) {
        at += gap;
        timers.current.push(window.setTimeout(() => setReel({ club: landing.club, slot: pick(positions) }), at));
      }
    }
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
    const season = playSeason({
      players,
      meta,
      source,
      formation,
      lineup,
      strength,
      difficulty,
      draft,
      without: draftedIds(lineup),
    });
    const row = userRow(season.table);
    trackEvent(`road/${difficulty}/${draft}/ovr-${Math.floor(strength)}/pos-${season.position}/pts-${Math.floor(row.points / 5) * 5}`);

    submitBest(bestKey, row.points);
    const totals = readJson<Totals>(TOTALS_KEY) ?? { seasons: 0, titles: 0, perfect: 0 };
    writeJson(TOTALS_KEY, {
      seasons: totals.seasons + 1,
      titles: totals.titles + (season.position === 1 ? 1 : 0),
      perfect: totals.perfect + (row.points >= 100 ? 1 : 0),
    });

    setJustPlayed(true);
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    setState((s) => ({ ...s, season }));
  }

  function newDraft() {
    setState(fresh(state.formation, difficulty, draft));
    setSelected(null);
    setJustPlayed(false);
  }

  async function share(season: SavedSeason) {
    const row = userRow(season.table);
    const icons = seasonBadges(row, season.position).map((b) => b.icon).join('');
    const modes = [
      season.draft && season.draft !== 'standard' ? t(`road.draft.${season.draft as DraftMode}`) : '',
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
    notifyShare(await shareText(`${head}\n${resultsGrid(season)}\n${shareValues(season.source)} · ${siteUrl()}#/road100`));
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
                    <div class="spinner__reel" key={`${shown.club}-${spinning && shown.slot === null}`}>
                      <Crest code={shown.club} size={56} />
                      <div class="spinner__text">
                        <span class="spinner__club">{meta.clubs[shown.club].name}</span>
                        {shown.slot !== null && (
                          <span class="spinner__slot" key={shown.slot}>
                            {shown.slot
                              ? t('road.drawnSlot', {
                                  pos: posLabel(formation.slots.find((s) => s.id === shown.slot)?.type ?? 'CM'),
                                })
                              : t('road.drawingSlot')}
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
        <SeasonResult
          season={state.season}
          formation={formation}
          lineup={lineup}
          animate={justPlayed}
          chips={[
            state.season.draft && state.season.draft !== 'standard' ? t(`road.draft.${state.season.draft as DraftMode}`) : '',
            state.season.difficulty === 'arcade' ? t('road.mode.arcade') : '',
          ].filter(Boolean)}
          actions={
            <>
              <button class="btn btn--primary" onClick={newDraft}>
                {t('road.newDraft')}
              </button>
              <button class="btn" onClick={() => share(state.season!)}>
                {t('common.share')}
              </button>
            </>
          }
        />
      )}
    </section>
  );
}
