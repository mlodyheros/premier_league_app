import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { Pitch } from '../../components/Pitch';
import { useDataset } from '../../data/store';
import type { Player } from '../../data/types';
import { shareValues, valueSource, valuesPhrase } from '../../data/valueSource';
import { t, tj } from '../../i18n';
import { posLabel, shareNote } from '../../i18n/labels';
import { fold, formatDecimal, formatEur, formatOdds } from '../../lib/format';
import { clubsBeaten, clubTeams, withUserTeam } from '../../lib/league';
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
    const opponents = league.slice(1).map((team) => team.strength);
    return {
      points: expectedPoints(strength, opponents),
      perfect: perfectSeasonOdds(strength, opponents),
      beaten: clubsBeaten(clubs, strength),
    };
  }, [complete, strength, clubs]);

  async function share() {
    const lines = [...formation.slots].reverse().map((s) => lineup[s.id]?.short ?? '?');
    const head = t('budget.share', {
      budget: formatEur(budget),
      ovr: formatDecimal(strength),
      grade: grade(strength),
      values: shareValues(source),
    });
    setNote(shareNote(await shareText(`${head}\n${formation.label}: ${lines.join(', ')}\n${siteUrl()}#/budget`)));
  }

  return (
    <section class="game budget">
      <div class="game__head">
        <h1>{t('game.budget.title')}</h1>
        <div class="scorebug">
          <span>
            <small>{t('common.ovr')}</small>
            <b>{strength ? formatDecimal(strength) : '–'}</b>
          </span>
          <span>
            <small>{t('common.best')}</small>
            <b>{best ? formatDecimal(best) : '–'}</b>
          </span>
        </div>
      </div>
      <p class="lede">
        {tj('budget.lede', { values: <b>{valuesPhrase(source)}</b> })}
      </p>

      <div class="controls">
        <label>
          {t('budget.budget')}
          <select value={budget} onChange={(e) => setBudget(Number((e.target as HTMLSelectElement).value))}>
            {BUDGETS.map((b) => (
              <option value={b}>{formatEur(b)}</option>
            ))}
          </select>
        </label>
        <label>
          {t('budget.formation')}
          <select value={formationKey} onChange={(e) => changeFormation((e.target as HTMLSelectElement).value)}>
            {FORMATIONS.map((f) => (
              <option value={f.key}>{f.label}</option>
            ))}
          </select>
        </label>
        <button class="btn btn--ghost" onClick={reset} disabled={!Object.keys(picks).length}>
          {t('budget.clear')}
        </button>
      </div>

      <div class={`budget__bar ${over ? 'over' : ''}`}>
        <div class="budget__fill" style={{ width: `${Math.min(100, (used / budget) * 100)}%` }} />
        <span>{tj('budget.spent', { v: <b>{formatEur(used)}</b> })}</span>
        <span>{tj(over ? 'budget.overBy' : 'budget.left', { v: <b>{formatEur(Math.abs(budget - used))}</b> })}</span>
      </div>
      {over && (
        <p class="notice-inline">
          {t('budget.overNotice', { budget: formatEur(budget), values: valuesPhrase(source) })}
        </p>
      )}

      <div class="squad-layout">
        <Pitch formation={formation} lineup={lineup} source={source} selected={selected} onSlot={openSlot} />

        <div class="picker" ref={pickerRef}>
          {!slot ? (
            <p class="picker__hint">
              {complete ? t('budget.hintSwap') : t('budget.hintPick')}
            </p>
          ) : (
            <>
              <div class="picker__head">
                <h2>{posLabel(slot.type)}</h2>
                {lineup[slot.id] && (
                  <button class="btn btn--ghost btn--sm" onClick={removeFromSlot}>
                    {t('budget.remove', { name: lineup[slot.id]!.short })}
                  </button>
                )}
              </div>
              <div class="picker__tools">
                <input
                  type="search"
                  placeholder={t('budget.filter')}
                  value={query}
                  onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                />
                <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as SortKey)} aria-label={t('budget.sort')}>
                  {(['rating', 'bargain', 'cheap', 'dear'] as SortKey[]).map((k) => (
                    <option value={k}>{t(`budget.sort.${k}`)}</option>
                  ))}
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
                          {meta.clubs[o.player.club].short} · {posLabel(o.player.pos)}
                          {o.fit < 1 && <em> · {t('budget.fit', { pct: Math.round(o.fit * 100) })}</em>}
                        </small>
                      </span>
                      <span class="prow__ovr">{Math.round(o.rating)}</span>
                      <span class="prow__price">{formatEur(o.price)}</span>
                    </button>
                  </li>
                ))}
                {!rows.length && <li class="picker__hint">{t('budget.none')}</li>}
              </ul>
            </>
          )}
        </div>
      </div>

      {complete && outlook && (
        <div class="end end--win">
          <p class="end__title">
            {t('budget.result', { ovr: formatDecimal(strength), grade: grade(strength) })}
            {newBest ? t('common.newBestSuffix') : ''}
          </p>
          <ul class="facts">
            <li>{tj('budget.beaten', { n: <b>{outlook.beaten}</b> })}</li>
            <li>{tj('budget.points', { n: <b>{Math.round(outlook.points)}</b> })}</li>
            <li>{tj('budget.odds', { odds: <b>{formatOdds(outlook.perfect)}</b> })}</li>
            <li>{tj('budget.spentOf', { v: <b>{formatEur(used)}</b>, budget: formatEur(budget) })}</li>
          </ul>
          <div class="end__actions">
            <button class="btn" onClick={share}>
              {t('common.share')}
            </button>
            <a class="btn btn--primary" href="#/road38">
              {t('budget.tryRoad')}
            </a>
          </div>
          {note && <p class="end__note" role="status">{note}</p>}
        </div>
      )}
    </section>
  );
}
