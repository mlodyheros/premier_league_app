import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { Pitch } from '../../components/Pitch';
import { useDataset } from '../../data/store';
import type { Player } from '../../data/types';
import { SOURCE_LABEL, SOURCE_SHORT, valueSource } from '../../data/valueSource';
import { fold, formatEur } from '../../lib/format';
import { clubsBeaten, clubTeams, formatOdds, withUserTeam } from '../../lib/league';
import { getBest, submitBest } from '../../lib/records';
import { expectedPoints, perfectSeasonOdds } from '../../lib/season';
import { shareText, siteUrl } from '../../lib/share';
import { readJson, writeJson } from '../../lib/storage';
import { formationByKey, FORMATIONS, teamStrength, type Lineup, type Slot } from '../../lib/strength';
import { BUDGETS, DEFAULT_BUDGET, grade, isComplete, options, spent, type SortKey } from './logic';

interface Saved {
  budget: number;
  formation: string;
  /** slot id -> player name (names survive data updates, ids may not). */
  picks: Record<string, string>;
}

const KEY = 'budget:draft';
const MAX_ROWS = 60;

export function BudgetXI() {
  const { players, meta } = useDataset();
  const source = valueSource.value;
  const byName = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);

  const saved = readJson<Saved>(KEY);
  const [budget, setBudget] = useState(saved?.budget ?? DEFAULT_BUDGET);
  const [formationKey, setFormationKey] = useState(saved?.formation ?? '433');
  const [picks, setPicks] = useState<Record<string, string>>(saved?.picks ?? {});
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('rating');
  const [note, setNote] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const formation = formationByKey(formationKey);
  const lineup: Lineup = Object.fromEntries(
    Object.entries(picks).map(([slot, name]) => [slot, byName.get(name)]),
  );

  useEffect(() => writeJson(KEY, { budget, formation: formationKey, picks }), [budget, formationKey, picks]);

  const used = spent(lineup, source);
  const over = used > budget;
  const strength = teamStrength(formation, lineup, source);
  const complete = isComplete(formation, lineup) && !over;
  const bestKey = `budget:${budget}:${source}`;
  const [best, setBest] = useState(() => getBest(bestKey));
  const [newBest, setNewBest] = useState(false);

  useEffect(() => {
    if (complete) {
      setNewBest(submitBest(bestKey, strength));
    } else {
      setNewBest(false);
    }
    setBest(getBest(bestKey));
  }, [complete, strength, bestKey]);

  const slot = formation.slots.find((s) => s.id === selected) ?? null;
  const rows = useMemo(() => {
    if (!slot) return [];
    const q = fold(query.trim());
    return options(players, slot, lineup, budget, source, sort)
      .filter((o) => !q || fold(`${o.player.name} ${o.player.short} ${meta.clubs[o.player.club].short}`).includes(q))
      .slice(0, MAX_ROWS);
  }, [slot, query, sort, picks, budget, source, players]);

  function openSlot(s: Slot) {
    setSelected(s.id === selected ? null : s.id);
    setQuery('');
    requestAnimationFrame(() => pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  function choose(p: Player) {
    if (!slot) return;
    const next = { ...picks, [slot.id]: p.name };
    setPicks(next);
    // Move on to the next empty slot, if any.
    const empty = formation.slots.find((s) => !next[s.id]);
    setSelected(empty ? empty.id : null);
    setQuery('');
  }

  function removeFromSlot() {
    if (!slot) return;
    const next = { ...picks };
    delete next[slot.id];
    setPicks(next);
  }

  function changeFormation(key: string) {
    // Keep players whose slot id exists in the new shape (the back four and keeper always do).
    const f = formationByKey(key);
    const ids = new Set(f.slots.map((s) => s.id));
    setPicks(Object.fromEntries(Object.entries(picks).filter(([id]) => ids.has(id))));
    setFormationKey(key);
    setSelected(null);
  }

  function reset() {
    setPicks({});
    setSelected(null);
  }

  const clubs = useMemo(() => clubTeams(players, meta, source), [players, meta, source]);
  const outlook = useMemo(() => {
    if (!complete) return null;
    const { league } = withUserTeam(clubs, strength);
    const opponents = league.slice(1).map((t) => t.strength);
    return {
      points: expectedPoints(strength, opponents),
      perfect: perfectSeasonOdds(strength, opponents),
      beaten: clubsBeaten(clubs, strength),
    };
  }, [complete, strength, clubs]);

  async function share() {
    const lines = [...formation.slots].reverse().map((s) => lineup[s.id]?.short ?? '?');
    const text = `Budget XI ${formatEur(budget)} · ${strength.toFixed(1)} OVR (${grade(strength)}) · ${SOURCE_SHORT[source]} values\n${formation.label}: ${lines.join(', ')}\n${siteUrl()}#/budget`;
    const r = await shareText(text);
    setNote(r === 'copied' ? 'Copied to clipboard' : r === 'shared' ? 'Shared' : 'Could not share');
  }

  return (
    <section class="game budget">
      <div class="game__head">
        <h1>Budget XI</h1>
        <div class="scorebug">
          <span>
            <small>OVR</small>
            <b>{strength ? strength.toFixed(1) : '–'}</b>
          </span>
          <span>
            <small>Best</small>
            <b>{best ? best.toFixed(1) : '–'}</b>
          </span>
        </div>
      </div>
      <p class="lede">
        Build the strongest XI you can within budget. Prices are <b>{SOURCE_LABEL[source]}</b> values. A player's
        rating mixes his performance with his value, and drops when he plays out of position.
      </p>

      <div class="controls">
        <label>
          Budget
          <select value={budget} onChange={(e) => setBudget(Number((e.target as HTMLSelectElement).value))}>
            {BUDGETS.map((b) => (
              <option value={b}>{formatEur(b)}</option>
            ))}
          </select>
        </label>
        <label>
          Formation
          <select value={formationKey} onChange={(e) => changeFormation((e.target as HTMLSelectElement).value)}>
            {FORMATIONS.map((f) => (
              <option value={f.key}>{f.label}</option>
            ))}
          </select>
        </label>
        <button class="btn btn--ghost" onClick={reset} disabled={!Object.keys(picks).length}>
          Clear
        </button>
      </div>

      <div class={`budget__bar ${over ? 'over' : ''}`}>
        <div class="budget__fill" style={{ width: `${Math.min(100, (used / budget) * 100)}%` }} />
        <span>
          Spent <b>{formatEur(used)}</b>
        </span>
        <span>
          {over ? 'Over by ' : 'Left '}
          <b>{formatEur(Math.abs(budget - used))}</b>
        </span>
      </div>
      {over && (
        <p class="notice-inline">
          This XI costs more than {formatEur(budget)} on {SOURCE_LABEL[source]} values. Swap someone out to finish it.
        </p>
      )}

      <div class="squad-layout">
        <Pitch formation={formation} lineup={lineup} source={source} selected={selected} onSlot={openSlot} />

        <div class="picker" ref={pickerRef}>
          {!slot ? (
            <p class="picker__hint">
              {complete ? 'Tap any position to swap a player.' : 'Tap a position on the pitch to pick a player for it.'}
            </p>
          ) : (
            <>
              <div class="picker__head">
                <h2>{slot.type}</h2>
                {lineup[slot.id] && (
                  <button class="btn btn--ghost btn--sm" onClick={removeFromSlot}>
                    Remove {lineup[slot.id]!.short}
                  </button>
                )}
              </div>
              <div class="picker__tools">
                <input
                  type="search"
                  placeholder="Filter by name or club"
                  value={query}
                  onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                />
                <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as SortKey)} aria-label="Sort">
                  <option value="rating">Best rated</option>
                  <option value="bargain">Best value</option>
                  <option value="cheap">Cheapest</option>
                  <option value="dear">Dearest</option>
                </select>
              </div>
              <ul class="picker__list">
                {rows.map((o) => (
                  <li>
                    <button
                      class={`prow ${lineup[slot.id]?.id === o.player.id ? 'prow--current' : ''}`}
                      disabled={!o.affordable}
                      onClick={() => choose(o.player)}
                    >
                      <Avatar player={o.player} size={30} />
                      <span class="prow__name">
                        {o.player.name}
                        <small>
                          {meta.clubs[o.player.club].short} · {o.player.pos}
                          {o.fit < 1 && <em> · {Math.round(o.fit * 100)}% fit</em>}
                        </small>
                      </span>
                      <span class="prow__ovr">{Math.round(o.rating)}</span>
                      <span class="prow__price">{formatEur(o.price)}</span>
                    </button>
                  </li>
                ))}
                {!rows.length && <li class="picker__hint">No one matches.</li>}
              </ul>
            </>
          )}
        </div>
      </div>

      {complete && outlook && (
        <div class="end end--win">
          <p class="end__title">
            {strength.toFixed(1)} OVR · grade {grade(strength)} {newBest ? '· new best!' : ''}
          </p>
          <ul class="facts">
            <li>
              Stronger than <b>{outlook.beaten}</b> of the 20 Premier League squads
            </li>
            <li>
              Expected points over a season: <b>{Math.round(outlook.points)}</b>
            </li>
            <li>
              Chance of going 38-0: <b>{formatOdds(outlook.perfect)}</b>
            </li>
            <li>
              Spent <b>{formatEur(used)}</b> of {formatEur(budget)}
            </li>
          </ul>
          <div class="end__actions">
            <button class="btn" onClick={share}>
              Share
            </button>
            <a class="btn btn--primary" href="#/road38">
              Try Road to 38-0 →
            </a>
          </div>
          {note && <p class="end__note" role="status">{note}</p>}
        </div>
      )}
    </section>
  );
}
