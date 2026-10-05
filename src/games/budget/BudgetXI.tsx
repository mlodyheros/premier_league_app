import { GameHeader, OtherGames } from '../../components/GameHeader';
import { useRevealWhen } from '../../hooks/useRevealWhen';
import { Icon } from '../../components/Icon';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { Pitch } from '../../components/Pitch';
import { useDataset } from '../../data/store';
import type { Player } from '../../data/types';
import { shareValues, valueSource, valuesPhrase } from '../../data/valueSource';
import { t, tj } from '../../i18n';
import { posLabel } from '../../i18n/labels';
import { fold, formatDecimal, formatEur, formatOdds } from '../../lib/format';
import { clubsBeaten, clubTeams, withUserTeam } from '../../lib/league';
import { celebrate } from '../../lib/motion';
import { getBest, submitBest } from '../../lib/records';
import { expectedPoints } from '../../lib/season';
import { rovingKeys } from '../../lib/a11y';
import { trackEvent } from '../../lib/analytics';
import { shareUrl } from '../../lib/share';
import { openShare } from '../../components/ShareSheet';
import { cardFooter, xiOnPitch } from '../../lib/shareSpecs';
import { readJson, writeJson } from '../../lib/storage';
import { formationByKey, FORMATIONS, teamStrength, type Lineup, type Slot } from '../../lib/strength';
import { autoFill, defaultSort, grade, isComplete, options, spent, themeFor, THEMES, type SortKey } from './logic';
import { routeParam } from '../../router';
import { SeasonResult } from '../../components/SeasonResult';
import { playSeason, type PlayedSeason } from '../../lib/playSeason';
import { POINTS_TARGET, pointsOdds } from '../../lib/season';

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
  const [budget, setBudget] = useState(themeFor(saved?.budget).budget);
  const theme = themeFor(budget);

  // On phones the themes scroll sideways: keep the chosen one in view.
  useEffect(() => {
    const row = themesRef.current;
    const chip = row?.querySelector<HTMLElement>('.theme--on');
    if (row && chip && row.scrollWidth > row.clientWidth) {
      row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.clientWidth) / 2, behavior: 'smooth' });
    }
  }, [budget]);
  const [season, setSeason] = useState<PlayedSeason | null>(null);
  const [formationKey, setFormationKey] = useState(saved?.formation ?? '433');
  const [picks, setPicks] = useState<Record<string, string>>(saved?.picks ?? {});
  const [selected, setSelected] = useState<string | null>(null);
  // "#/budget?club=ARS" (a crest on the home page) opens the picker filtered to that club.
  const clubParam = routeParam('club');
  const [clubFilter, setClubFilter] = useState<string | null>(clubParam && meta.clubs[clubParam] ? clubParam : null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>(() => defaultSort(budget));
  useEffect(() => setSort(defaultSort(budget)), [budget]);
  const pickerRef = useRef<HTMLDivElement>(null);
  const themesRef = useRef<HTMLDivElement>(null);

  const formation = formationByKey(formationKey);
  const lineup: Lineup = Object.fromEntries(
    Object.entries(picks).map(([slot, name]) => [slot, byName.get(name)]),
  );

  useEffect(() => writeJson(KEY, { budget, formation: formationKey, picks }), [budget, formationKey, picks]);

  const used = spent(lineup, source);
  const over = used > budget;
  const strength = teamStrength(formation, lineup, source);
  const complete = isComplete(formation, lineup) && !over;
  const endRef = useRevealWhen(complete);
  const bestKey = `budget:${budget}:${source}`;
  const [best, setBest] = useState(() => getBest(bestKey));
  const [newBest, setNewBest] = useState(false);

  useEffect(() => {
    if (complete) {
      const isNew = submitBest(bestKey, strength);
      setNewBest(isNew);
      if (isNew && strength >= 84.5) celebrate(strength >= 86.5);
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
      .filter((o) => !clubFilter || o.player.club === clubFilter)
      .filter((o) => !q || fold(`${o.player.name} ${o.player.short} ${meta.clubs[o.player.club].short}`).includes(q))
      .slice(0, MAX_ROWS);
  }, [slot, query, sort, picks, budget, source, players, clubFilter]);

  // Coming from a crest: open the first empty slot straight away.
  useEffect(() => {
    if (clubFilter && !selected) {
      const empty = formation.slots.find((s) => !picks[s.id]);
      if (empty) setSelected(empty.id);
    }
  }, []);

  // On phones the picker is a bottom sheet: Escape closes it.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  function fillRest() {
    const filled = autoFill(players, formation, lineup, budget, source);
    setPicks(Object.fromEntries(Object.entries(filled).flatMap(([id, p]) => (p ? [[id, p.name]] : []))));
    setSelected(null);
    trackEvent(`budget/${theme.key}/autofill`);
  }

  function openSlot(s: Slot) {
    setSelected(s.id === selected ? null : s.id);
    setQuery('');
    // On phones the picker is a sheet over the page; elsewhere bring it into view.
    if (!matchMedia('(max-width: 720px)').matches) {
      requestAnimationFrame(() => pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }
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
      hundred: pointsOdds(strength, opponents, undefined, POINTS_TARGET),
      beaten: clubsBeaten(clubs, strength),
    };
  }, [complete, strength, clubs]);

  function shareTextNow(): string {
    const lines = [...formation.slots].reverse().map((s) => lineup[s.id]?.short ?? '?');
    const head = t('budget.share', {
      budget: `${theme.icon} ${t(`budget.theme.${theme.key}`)}`,
      ovr: formatDecimal(strength),
      grade: grade(strength),
      values: shareValues(source),
    });
    return `${head}\n${formation.label}: ${lines.join(', ')}\n${shareUrl('budget')}`;
  }

  /** The XI as a card, before (or without) playing a season with it. */
  function shareCard() {
    openShare(
      {
        game: t('game.budget.title'),
        kicker: `${t(`budget.theme.${theme.key}`)} · ${formatEur(budget)}`,
        headline: `${formatDecimal(strength)} ${t('common.ovr')}`,
        sub: t('budget.cardSub', { grade: grade(strength), spent: formatEur(used) }),
        pitch: xiOnPitch(formation, lineup, meta, source),
        ...cardFooter(),
      },
      shareTextNow(),
      'pl-games-budget-xi',
    );
  }

  return (
    <section class="game budget">
      <GameHeader
        game="budget"
        score={
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
        }
      >
        <p>
          {tj('budget.lede', { values: <b>{valuesPhrase(source)}</b> })}
        </p>
      </GameHeader>

      <div class="themes" role="radiogroup" aria-label={t('budget.budget')} ref={themesRef} onKeyDown={rovingKeys}>
        {THEMES.map((th) => (
          <button
            type="button"
            role="radio"
            aria-checked={th.key === theme.key}
            tabIndex={th.key === theme.key ? 0 : -1}
            class={`theme ${th.key === theme.key ? 'theme--on' : ''}`}
            onClick={() => {
              setBudget(th.budget);
              setSeason(null);
            }}
          >
            <span class="theme__icon" aria-hidden="true">
              <Icon name={th.glyph} size={26} />
            </span>
            <span class="theme__name">{t(`budget.theme.${th.key}`)}</span>
            <span class="theme__amount">{formatEur(th.budget)}</span>
          </button>
        ))}
      </div>
      <p class="mode-help">{t(`budget.theme.${theme.key}.blurb`)}</p>

      <div class="controls">
        <label>
          {t('budget.formation')}
          <select value={formationKey} onChange={(e) => changeFormation((e.target as HTMLSelectElement).value)}>
            {FORMATIONS.map((f) => (
              <option value={f.key}>{f.label}</option>
            ))}
          </select>
        </label>
        <button class="btn" onClick={fillRest} disabled={isComplete(formation, lineup)}>
          <Icon name="sparkles" size={18} /> {t('budget.autofill')}
        </button>
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

        {slot && <div class="picker-backdrop" onClick={() => setSelected(null)} aria-hidden="true" />}
        <div class={`picker ${slot ? 'picker--open' : ''}`} ref={pickerRef} role={slot ? 'dialog' : undefined} aria-label={slot ? posLabel(slot.type) : undefined}>
          {!slot ? (
            <p class="picker__hint">
              {complete ? t('budget.hintSwap') : t('budget.hintPick')}
            </p>
          ) : (
            <>
              <div class="picker__head">
                <h2>{posLabel(slot.type)}</h2>
                <span class="picker__left">{tj('budget.left', { v: <b>{formatEur(Math.max(0, budget - used))}</b> })}</span>
                {lineup[slot.id] && (
                  <button class="btn btn--ghost btn--sm" onClick={removeFromSlot}>
                    {t('budget.remove', { name: lineup[slot.id]!.short })}
                  </button>
                )}
                <button class="picker__close" onClick={() => setSelected(null)} aria-label={t('common.close')}>
                  ✕
                </button>
              </div>
              {clubFilter && (
                <p class="picker__filter">
                  {t('budget.clubFilter', { club: meta.clubs[clubFilter].name })}
                  <button class="link-btn" onClick={() => setClubFilter(null)}>
                    {t('budget.clubFilterOff')}
                  </button>
                </p>
              )}
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
        <div class="end end--win" ref={endRef}>
          <p class="end__title">
            {t('budget.result', { ovr: formatDecimal(strength), grade: grade(strength) })}
            {newBest ? t('common.newBestSuffix') : ''}
          </p>
          <ul class="facts">
            <li>{tj('budget.beaten', { n: <b>{outlook.beaten}</b> })}</li>
            <li>{tj('budget.points', { n: <b>{Math.round(outlook.points)}</b> })}</li>
            <li>{tj('budget.odds', { odds: <b>{formatOdds(outlook.hundred)}</b> })}</li>
            <li>{tj('budget.spentOf', { v: <b>{formatEur(used)}</b>, budget: formatEur(budget) })}</li>
          </ul>
          <div class="end__actions">
            <button
              class="btn btn--primary"
              onClick={() => {
                setSeason(playSeason({ players, meta, source, formation, lineup, strength }));
                trackEvent(`budget/${theme.key}/season`);
              }}
            >
              <Icon name="ball-football" /> {season ? t('budget.playAgain') : t('budget.playSeason')}
            </button>
            <button class="btn" onClick={shareCard}>
              {t('common.share')}
            </button>
            <a class="btn btn--ghost" href="#/road100">
              {t('budget.tryRoad')}
            </a>
          </div>
        </div>
      )}

      {complete && season && (
        <SeasonResult
          key={season.results.map((r) => r.goalsFor).join('')}
          season={season}
          formation={formation}
          lineup={lineup}
          animate
          chips={[t(`budget.theme.${theme.key}`)]}
          share={{ title: t('game.budget.title'), text: shareTextNow(), file: 'pl-games-budget-xi-season' }}
        />
      )}
      <OtherGames current="budget" />
    </section>
  );
}
