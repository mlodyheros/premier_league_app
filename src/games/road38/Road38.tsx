import { GameHeader, OtherGames } from '../../components/GameHeader';
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
import { formatDecimal, formatEur, formatOdds, ordinal } from '../../lib/format';
import { buzz, reducedMotion } from '../../lib/motion';
import { playSeason, previewSeason, type PlayedSeason } from '../../lib/playSeason';
import { getBest, submitBest } from '../../lib/records';
import { pick } from '../../lib/rng';
import { DIFFICULTY, type Difficulty } from '../../lib/season';
import { shareText, shareUrl } from '../../lib/share';
import { readJson, writeJson } from '../../lib/storage';
import { formationByKey, FORMATIONS, teamStrength, type Lineup, type Slot } from '../../lib/strength';
import {
  byName,
  candidates,
  chemistry,
  CHEMISTRY_STEP,
  draftedIds,
  clubOptions,
  slotOptions,
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
  // What each reel shows while it spins (null when it is still).
  const [clubReel, setClubReel] = useState<string | null>(null);
  const [slotReel, setSlotReel] = useState<string | null>(null);
  const [landed, setLanded] = useState<{ club: boolean; slot: boolean }>({ club: false, slot: false });
  const [justPlayed, setJustPlayed] = useState(false);
  const timers = useRef<number[]>([]);
  /** Lands the reels at once (a tap while they spin); null when still. */
  const finish = useRef<(() => void) | null>(null);

  useEffect(() => writeJson(KEY, state), [state]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const formation = formationByKey(state.formation);
  const lineup: Lineup = Object.fromEntries(Object.entries(state.picks).map(([s, n]) => [s, playerByName.get(n)]));
  const open = openSlots(formation, lineup);
  const complete = open.length === 0;
  const chem = chemistry(lineup);
  const base = teamStrength(formation, lineup, source);
  /** The XI's rating with the chemistry bonus: what the season is played with. */
  const strength = base ? Math.round((base + chem.bonus) * 10) / 10 : 0;
  const difficulty: Difficulty = state.difficulty ?? 'realistic';
  const draft: DraftMode = state.draft ?? 'standard';
  const blind = hidesRatings(draft);
  const bestKey = bestKeyFor(source, difficulty, draft);
  const best = getBest(bestKey);
  const started = Object.keys(state.picks).length > 0 || !!state.spin;
  const spinning = clubReel !== null || slotReel !== null;
  const positional = drawsPosition(draft);
  const spun = state.spin;
  const ready = !!spun?.club && (!positional || !!spun.slot);

  // In the position modes the drawn slot is the only one that can be filled.
  const drawnSlot = state.spin?.slot ? (formation.slots.find((s) => s.id === state.spin!.slot) ?? null) : null;
  const chosenSlot = drawnSlot ?? formation.slots.find((s) => s.id === selected && !lineup[s.id]) ?? null;
  const rawList = ready ? candidates(players, spun!.club!, formation, lineup, source, chosenSlot) : [];
  const list = blind ? byName(rawList) : rawList;
  const hint = drawnSlot
    ? new Set([drawnSlot.id])
    : spun?.club
      ? fillableSlots(players, spun.club, formation, lineup)
      : undefined;

  // What each button may still draw: a club that can fill the drawn position,
  // a position the drawn club can fill.
  const clubPool = clubOptions(players, clubCodes, formation, lineup, spun?.slot ?? null, spun?.club);
  const slotPool = positional ? slotOptions(players, clubCodes, formation, lineup, spun?.club ?? null, spun?.slot) : [];
  const canRespin = state.respins > 0 && !spinning;

  /** Spin one reel through random faces, slowing down, and stop on `landing`; returns when it stops. */
  function runReel(set: (v: string | null) => void, faces: string[], landing: string, delay: number, stopped: () => void) {
    let at = delay;
    for (const gap of REEL) {
      at += gap;
      timers.current.push(window.setTimeout(() => set(pick(faces)), at));
    }
    at += 200;
    timers.current.push(
      window.setTimeout(() => {
        set(landing);
        buzz('good');
        stopped();
      }, at),
    );
    return at;
  }

  /** Draw the club, the position, or both; a re-draw costs one re-spin. */
  function draw(which: 'club' | 'slot' | 'both') {
    if (spinning) return;
    const respin = which === 'both' || (which === 'club' ? !!spun?.club : !!spun?.slot);
    if (respin && state.respins === 0) return;
    const club =
      which === 'slot'
        ? (spun?.club ?? null)
        : pick(clubOptions(players, clubCodes, formation, lineup, which === 'both' ? null : (spun?.slot ?? null), spun?.club));
    if (which !== 'slot' && !club) return;
    const slot =
      which === 'club'
        ? (spun?.slot ?? null)
        : pick(slotOptions(players, clubCodes, formation, lineup, club, which === 'slot' || which === 'both' ? spun?.slot : null));
    if (which !== 'club' && !slot) return;

    setSelected(null);
    setLanded({ club: false, slot: false });
    buzz('tap');
    const commit = () =>
      setState((st) => ({ ...st, spin: { club, slot }, respins: respin ? st.respins - 1 : st.respins }));
    if (reducedMotion()) {
      setLanded({ club: which !== 'slot', slot: which !== 'club' });
      return commit();
    }
    timers.current = [];
    let end = 0;
    if (which !== 'slot') {
      end = runReel(setClubReel, clubCodes, club!, 0, () => setLanded((l) => ({ ...l, club: true })));
    }
    if (which !== 'club') {
      const faces = open.map((sl) => sl.id);
      end = runReel(setSlotReel, faces, slot!, which === 'both' ? 220 : 0, () => setLanded((l) => ({ ...l, slot: true })));
    }
    // Both reels show their landing; then the draw is saved and the reels let go.
    finish.current = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      finish.current = null;
      setLanded({ club: which !== 'slot', slot: which !== 'club' });
      commit();
      setClubReel(null);
      setSlotReel(null);
    };
    timers.current.push(window.setTimeout(() => finish.current?.(), end + 350));
  }

  /** A tap while the reels spin stops them on the drawn club and position. */
  function stopReels() {
    if (!finish.current) return;
    buzz('good');
    finish.current();
  }

  function choose(playerName: string, slot: Slot) {
    buzz('tap');
    setState((s) => ({ ...s, picks: { ...s.picks, [slot.id]: playerName }, spin: null }));
    setSelected(null);
    setLanded({ club: false, slot: false });
  }

  function onSlot(slot: Slot) {
    if (lineup[slot.id] || !ready || drawnSlot) return;
    setSelected(selected === slot.id ? null : slot.id);
  }

  const preview = useMemo(
    () => (complete ? previewSeason({ players, meta, source, strength, difficulty, without: draftedIds(lineup) }) : null),
    [complete, strength, difficulty, source, state.picks],
  );

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

  /** The same XI, another season: luck and form are drawn again. */
  function replay() {
    trackEvent('road/replay');
    kickOff();
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
    notifyShare(await shareText(`${head}\n${resultsGrid(season)}\n${shareValues(season.source)} · ${shareUrl('road100')}`));
  }

  
  return (
    <section class="game road">
      <GameHeader
        game="road"
        score={
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
        }
      >
        <p>
          {tj('road.lede', {
            respins: t('road.respins', { count: RESPINS }),
            values: <b>{valuesPhrase(source)}</b>,
          })}
        </p>
      </GameHeader>

      {!state.season && (
        <>
          <details class="setup">
            <summary>
              <span class="setup__now">
                {formation.label} · {t(`road.draft.${draft}`)} · {t(`road.mode.${difficulty}`)}
              </span>
              <span class="setup__edit">{t('road.setup')}</span>
            </summary>
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
          {started && <p class="mode-help">{t('road.setupLocked')}</p>}
          </details>
          <p class="controls__info">
            {t('road.progress', { picked: 11 - open.length, count: state.respins })}
            {chem.bonus > 0 && (
              <span class="chem" title={t('road.chemHelp', { step: CHEMISTRY_STEP })}>
                🔗 {t('road.chem', { n: formatDecimal(chem.bonus) })}
              </span>
            )}
          </p>

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
                <div class="draws" aria-live="polite">
                  <ReelBox
                    label={t('road.reel.club')}
                    spinning={clubReel !== null}
                    onStop={stopReels}
                    landed={landed.club}
                    face={clubReel ?? spun?.club ?? null}
                    render={(code) => (
                      <>
                        <Crest code={code} size={52} />
                        <span class="reel__name">{meta.clubs[code].short}</span>
                      </>
                    )}
                  >
                    {spinning ? (
                      <button class="btn btn--spin" onClick={stopReels}>
                        {t('road.stop')}
                      </button>
                    ) : !spun?.club ? (
                      <button class="btn btn--primary btn--spin" onClick={() => draw('club')} disabled={spinning || !clubPool.length}>
                        {t('road.drawClub')}
                      </button>
                    ) : (
                      <button class="btn btn--ghost" onClick={() => draw('club')} disabled={!canRespin || !clubPool.length}>
                        {t('road.redrawClub', { n: state.respins })}
                      </button>
                    )}
                  </ReelBox>
                  {positional && (
                    <ReelBox
                      label={t('road.reel.slot')}
                      spinning={slotReel !== null}
                      onStop={stopReels}
                      landed={landed.slot}
                      face={slotReel ?? spun?.slot ?? null}
                      render={(id) => (
                        <span class="reel__pos">{posLabel(formation.slots.find((sl) => sl.id === id)?.type ?? 'CM')}</span>
                      )}
                    >
                      {spinning ? (
                        <button class="btn btn--spin" onClick={stopReels}>
                          {t('road.stop')}
                        </button>
                      ) : !spun?.slot ? (
                        <button class="btn btn--primary btn--spin" onClick={() => draw('slot')} disabled={spinning || !slotPool.length}>
                          {t('road.drawSlot')}
                        </button>
                      ) : (
                        <button class="btn btn--ghost" onClick={() => draw('slot')} disabled={!canRespin || !slotPool.length}>
                          {t('road.redrawSlot', { n: state.respins })}
                        </button>
                      )}
                    </ReelBox>
                  )}
                  {positional && spun?.club && spun?.slot && (
                    <button class="btn btn--ghost draws__both" onClick={() => draw('both')} disabled={!canRespin}>
                      {t('road.redrawBoth', { n: state.respins })}
                    </button>
                  )}
                </div>
              )}

              {ready && !spinning && (
                <>
                  {Object.values(lineup).some((p) => p?.club === spun!.club) ? (
                    <p class="chem-hint">🔗 {t('road.chemNext', { club: meta.clubs[spun!.club!].short, step: CHEMISTRY_STEP })}</p>
                  ) : null}
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
                  {preview && !blind && (
                    <dl class="kickoff__preview">
                      <div>
                        <dt>{t('road.expected')}</dt>
                        <dd>{Math.round(preview.points)}</dd>
                      </div>
                      <div>
                        <dt>{t('road.odds100')}</dt>
                        <dd>{formatOdds(preview.odds)}</dd>
                      </div>
                    </dl>
                  )}
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
          key={state.season.results.map((r) => `${r.goalsFor}${r.goalsAgainst}`).join('')}
          season={state.season}
          formation={formation}
          lineup={lineup}
          animate={justPlayed}
          imageTitle={t('game.road.title')}
          chips={[
            state.season.draft && state.season.draft !== 'standard' ? t(`road.draft.${state.season.draft as DraftMode}`) : '',
            state.season.difficulty === 'arcade' ? t('road.mode.arcade') : '',
          ].filter(Boolean)}
          actions={
            <>
              <button class="btn btn--primary" onClick={newDraft}>
                {t('road.newDraft')}
              </button>
              <button class="btn" onClick={replay}>
                {t('road.replay')}
              </button>
              <button class="btn" onClick={() => share(state.season!)}>
                {t('common.share')}
              </button>
            </>
          }
        />
      )}
      <OtherGames current="road" />
    </section>
  );
}

/** One reel: a framed face (or "?" before the first draw) and its button. */
function ReelBox({
  label,
  face,
  spinning,
  landed,
  render,
  onStop,
  children,
}: {
  onStop: () => void;
  label: string;
  face: string | null;
  spinning: boolean;
  landed: boolean;
  render: (face: string) => preact.ComponentChildren;
  children: preact.ComponentChildren;
}) {
  return (
    <div class={`reel ${spinning ? 'reel--on' : ''} ${landed ? 'reel--landed' : ''}`}>
      <span class="reel__label">{label}</span>
      <div
        class="reel__window"
        onClick={spinning ? onStop : undefined}
        role={spinning ? 'button' : undefined}
        aria-label={spinning ? t('road.stop') : undefined}
      >
        {face ? (
          <div class="reel__face" key={face}>
            {render(face)}
          </div>
        ) : (
          <span class="reel__empty">?</span>
        )}
      </div>
      {children}
    </div>
  );
}
