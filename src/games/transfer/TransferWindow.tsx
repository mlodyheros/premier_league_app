import { useEffect, useMemo, useState } from 'preact/hooks';
import { Icon } from '../../components/Icon';
import { Avatar, Crest } from '../../components/Avatar';
import { Chips } from '../../components/Chips';
import { GameHeader, OtherGames } from '../../components/GameHeader';
import { resultsGrid, SeasonResult } from '../../components/SeasonResult';
import { useDataset } from '../../data/store';
import type { Player, PosGroup } from '../../data/types';
import { shareValues, valueOf, valueSource, valuesPhrase } from '../../data/valueSource';
import { t, tj } from '../../i18n';
import { posLabel } from '../../i18n/labels';
import { trackEvent } from '../../lib/analytics';
import { fold, formatDecimal, formatEur, ordinal } from '../../lib/format';
import { buzz } from '../../lib/motion';
import type { PlayedSeason } from '../../lib/playSeason';
import { getBest, submitBest } from '../../lib/records';
import { pick } from '../../lib/rng';
import { attributeGoals } from '../../lib/scorers';
import { REALISTIC, SEASON_FORM_SD, simulateSeason } from '../../lib/season';
import { shareUrl } from '../../lib/share';
import { readJson, writeJson } from '../../lib/storage';
import { formationByKey, rating } from '../../lib/strength';
import { autoFill } from '../budget/logic';
import { USER_TEAM_ID } from '../../lib/league';
import {
  buyers,
  buyPrice,
  canBuy,
  canSell,
  type Ctx,
  leagueAfter,
  market,
  MAX_IN,
  MAX_OUT,
  moneyLeft,
  LAST_YEAR_FACTOR,
  BUY_PREMIUM,
  SELL_SHARE,
  outlook,
  seasonStart,
  sellPrice,
  squadOf,
  startingBudget,
  yearsLeft,
  type Outlook,
  type Window,
} from './logic';

interface State {
  window: Window | null;
  season: PlayedSeason | null;
  /** The forecast before any deal, kept with the season it was played against. */
  before: Outlook | null;
}

const KEY = 'transfer:state';
const FORMATION = formationByKey('433');
const MARKET_ROWS = 40;
type Tab = 'squad' | 'market';
type Group = 'all' | PosGroup;
const GROUPS: Group[] = ['all', 'GK', 'DEF', 'MID', 'FWD'];

export function TransferWindow() {
  const { players, meta } = useDataset();
  const source = valueSource.value;
  const ctx = useMemo<Ctx>(() => ({ source, season: seasonStart(meta.dataDate) }), [source, meta.dataDate]);
  const [state, setState] = useState<State>(() => readJson<State>(KEY) ?? { window: null, season: null, before: null });
  const [tab, setTab] = useState<Tab>('squad');
  const [justPlayed, setJustPlayed] = useState(false);
  const w = state.window;
  const bestKey = `transfer:${source}`;
  const best = getBest(bestKey);

  useEffect(() => writeJson(KEY, state), [state]);

  // A data update can drop a player from the league: forget deals that no longer exist.
  const names = useMemo(() => new Set(players.map((p) => p.name)), [players]);
  useEffect(() => {
    if (w && [...w.sold, ...w.bought].some((n) => !names.has(n))) {
      setState((s) => ({ ...s, window: { ...w, sold: w.sold.filter((n) => names.has(n)), bought: w.bought.filter((n) => names.has(n)) } }));
    }
  }, [names]);

  const before = useMemo(
    () => (w ? outlook(leagueAfter(players, meta, ctx, { club: w.club, sold: [], bought: [] })) : null),
    [w?.club, ctx, players],
  );
  // The forecast simulates 200 seasons: on a phone that takes a moment, so a
  // deal shows at once and the forecast follows (marked as updating meanwhile).
  const [now, setNow] = useState<Outlook | null>(null);
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    if (!w) return setNow(null);
    setUpdating(true);
    const timer = setTimeout(() => {
      setNow(outlook(leagueAfter(players, meta, ctx, w)));
      setUpdating(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [w, ctx, players]);

  function chooseClub(club: string) {
    buzz('tap');
    setState({ window: { club, sold: [], bought: [] }, season: null, before: null });
    setTab('squad');
    setJustPlayed(false);
    trackEvent(`transfer/club/${club}`);
  }

  function update(next: Window) {
    buzz('tap');
    setState((s) => ({ ...s, window: next }));
  }

  function play() {
    if (!w || !before || moneyLeft(players, w, ctx) < 0) return;
    const league = leagueAfter(players, meta, ctx, w);
    const s = simulateSeason(league, USER_TEAM_ID, Math.random, REALISTIC, SEASON_FORM_SD);
    const squad = squadOf(players, w);
    const lineup = autoFill(squad, FORMATION, {}, Infinity, source);
    const strength = league.find((t) => t.id === USER_TEAM_ID)!.strength;
    const season: PlayedSeason = {
      source,
      difficulty: 'realistic',
      strength,
      odds: now?.top4 ?? 0,
      replaced: '',
      results: s.results,
      table: s.table,
      position: s.position,
      scorers: attributeGoals(FORMATION, lineup, s.results, Math.random),
    };
    const gained = Math.round(before.position) - s.position;
    submitBest(bestKey, gained);
    trackEvent(`transfer/${w.club}/gained-${gained}`);
    setJustPlayed(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setState((st) => ({ ...st, season, before }));
  }

  function shareTextNow(): string {
    if (!w || !state.season || !state.before) return '';
    const club = meta.clubs[w.club].name;
    const byName = new Map(players.map((p) => [p.name, p]));
    const short = (n: string) => byName.get(n)?.short ?? n;
    const head = t('tw.share', {
      club,
      from: ordinal(Math.round(state.before.position)),
      to: ordinal(state.season.position),
      pts: state.season.table[state.season.position - 1].points,
    });
    const deals = [
      w.sold.length ? `${t('tw.out')}: ${w.sold.map(short).join(', ')}` : '',
      w.bought.length ? `${t('tw.in')}: ${w.bought.map(short).join(', ')}` : '',
    ].filter(Boolean);
    return `${head}\n${deals.join(' · ')}\n${resultsGrid(state.season)}\n${shareValues(source)} · ${shareUrl('transfer')}`;
  }

  return (
    <section class="game transfer">
      <GameHeader
        game="transfer"
        score={
          <div class="scorebug">
            <span>
              <small>{t('tw.best')}</small>
              <b>{best === null ? '–' : best > 0 ? `+${best}` : best}</b>
            </span>
          </div>
        }
      >
        <p>{tj('tw.lede', { out: MAX_OUT, in: MAX_IN, values: <b>{valuesPhrase(source)}</b> })}</p>
      </GameHeader>

      {!w ? (
        <ClubPicker onPick={chooseClub} />
      ) : state.season && state.before ? (
        <SeasonResult
          key={state.season.results.map((r) => `${r.goalsFor}${r.goalsAgainst}`).join('')}
          season={state.season}
          formation={FORMATION}
          lineup={autoFill(squadOf(players, w), FORMATION, {}, Infinity, source)}
          animate={justPlayed}
          share={{ title: t('game.transfer.title'), text: shareTextNow(), file: 'pl-games-transfer-window' }}
          chips={[meta.clubs[w.club].name]}
          user={{ code: w.club, name: meta.clubs[w.club].short }}
          success={state.season.position <= Math.round(state.before.position)}
          note={tj('tw.note', {
            forecast: <b>{ordinal(Math.round(state.before.position))}</b>,
            finish: <b>{ordinal(state.season.position)}</b>,
            diff: <b>{formatDiff(Math.round(state.before.position) - state.season.position)}</b>,
          })}
          actions={
            <>
              <button
                class="btn btn--primary"
                onClick={() => {
                  setState((s) => ({ ...s, season: null }));
                  setJustPlayed(false);
                }}
              >
                {t('tw.again')}
              </button>
              <button class="btn" onClick={() => setState({ window: null, season: null, before: null })}>
                {t('tw.otherClub')}
              </button>
            </>
          }
        />
      ) : (
        before &&
        now && (
          <WindowView
            w={w}
            before={before}
            now={now}
            tab={tab}
            onTab={setTab}
            onChange={update}
            onReset={() => setState({ window: null, season: null, before: null })}
            onPlay={play}
            updating={updating}
            ctx={ctx}
          />
        )
      )}
      <OtherGames current="transfer" />
    </section>
  );
}

/** "+3 places", "−2 places", "as forecast". */
function formatDiff(n: number): string {
  if (n === 0) return t('tw.asForecast');
  return t(n > 0 ? 'tw.placesUp' : 'tw.placesDown', { count: Math.abs(n) });
}

function ClubPicker({ onPick }: { onPick: (club: string) => void }) {
  const { players, meta } = useDataset();
  const source = valueSource.value;
  const clubs = Object.entries(meta.clubs).sort((a, b) => a[1].name.localeCompare(b[1].name));
  return (
    <div class="tw-pick">
      <div class="tw-pick__head">
        <h2>{t('tw.pickClub')}</h2>
        <button class="btn btn--primary btn--sm" onClick={() => onPick(pick(clubs)[0])}>
          <Icon name="dice-5" size={18} /> {t('tw.randomClub')}
        </button>
      </div>
      <ul class="tw-clubs">
        {clubs.map(([code, club]) => (
          <li>
            <button onClick={() => onPick(code)}>
              <Crest code={code} size={36} />
              <b>{club.short}</b>
              <small>{formatEur(startingBudget(players, code, source))}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WindowView({
  w,
  before,
  now,
  tab,
  onTab,
  onChange,
  onReset,
  onPlay,
  updating,
  ctx,
}: {
  updating: boolean;
  ctx: Ctx;
  w: Window;
  before: Outlook;
  now: Outlook;
  tab: Tab;
  onTab: (t: Tab) => void;
  onChange: (w: Window) => void;
  onReset: () => void;
  onPlay: () => void;
}) {
  const { players, meta } = useDataset();
  const source = ctx.source;
  const [group, setGroup] = useState<Group>('all');
  const [query, setQuery] = useState('');
  const byName = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);
  const squad = squadOf(players, w);
  const left = moneyLeft(players, w, ctx);
  const goesTo = useMemo(() => buyers(players, meta, w, ctx), [players, meta, w, ctx]);

  const offers = useMemo(() => {
    const q = fold(query.trim());
    return market(players, w, ctx)
      .filter((p) => (group === 'all' || p.group === group) && (!q || fold(`${p.name} ${p.short}`).includes(q)))
      .slice(0, MARKET_ROWS);
  }, [players, w, ctx, group, query]);

  const undo = (name: string) =>
    onChange({ ...w, sold: w.sold.filter((n) => n !== name), bought: w.bought.filter((n) => n !== name) });

  return (
    <div class="tw">
      <div class="tw-club">
        <Crest code={w.club} size={40} />
        <b>{meta.clubs[w.club].name}</b>
        <button class="link-btn" onClick={onReset}>
          {t('tw.changeClub')}
        </button>
      </div>

      <dl class={`tw-outlook ${updating ? 'tw-outlook--updating' : ''}`} aria-live="polite" aria-busy={updating}>
        <Stat label={t('tw.forecast')} before={before.position} now={now.position} format={(v) => formatDecimal(v, 1)} lowerIsBetter />
        <Stat label={t('tw.points')} before={before.points} now={now.points} format={(v) => String(Math.round(v))} />
        <Stat label={t('tw.top4')} before={before.top4} now={now.top4} format={pct} />
        <Stat label={t('tw.relegation')} before={before.relegation} now={now.relegation} format={pct} lowerIsBetter />
      </dl>
      <p class="tw-rules">
        <Icon name="info-circle" size={16} />
        {t('tw.rules', {
          premium: Math.round((BUY_PREMIUM - 1) * 100),
          discount: Math.round((1 - SELL_SHARE) * 100),
          lastYear: Math.round((1 - LAST_YEAR_FACTOR) * 100),
        })}
      </p>
      <p class="tw-money">
        {tj('tw.money', { v: <b class={left < 0 ? 'bad' : ''}>{formatEur(Math.max(0, left))}</b> })} ·{' '}
        {t('tw.deals', { out: w.sold.length, maxOut: MAX_OUT, in: w.bought.length, maxIn: MAX_IN })} · {t('common.ovr')}{' '}
        <b>{formatDecimal(now.strength)}</b>
      </p>

      {(w.sold.length > 0 || w.bought.length > 0) && (
        <ul class="tw-deals">
          {w.sold.map((n) => (
            <li class="tw-deal tw-deal--out">
              <span>
                ↗ {byName.get(n)?.name ?? n}
                {goesTo.has(n) && <small>{t('tw.to', { club: meta.clubs[goesTo.get(n)!].short })}</small>}
              </span>
              <span>+{formatEur(byName.get(n) ? sellPrice(byName.get(n)!, ctx) : 0)}</span>
              <button class="link-btn" onClick={() => undo(n)}>
                {t('tw.undo')}
              </button>
            </li>
          ))}
          {w.bought.map((n) => (
            <li class="tw-deal tw-deal--in">
              <span>↙ {byName.get(n)?.name ?? n}</span>
              <span>−{formatEur(byName.get(n) ? buyPrice(byName.get(n)!, ctx) : 0)}</span>
              <button class="link-btn" onClick={() => undo(n)}>
                {t('tw.undo')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Chips
        label={t('tw.view')}
        options={['squad', 'market'] as Tab[]}
        value={tab}
        onChange={onTab}
        name={(o) => (o === 'squad' ? t('tw.squad', { n: squad.length }) : t('tw.market'))}
      />

      {tab === 'squad' ? (
        <ul class="tw-list">
          {[...squad]
            .sort((a, b) => rating(b, source) - rating(a, source))
            .map((p) => {
              const isNew = w.bought.includes(p.name);
              return (
                <Row player={p} ctx={ctx} price={isNew ? buyPrice(p, ctx) : sellPrice(p, ctx)} tag={isNew ? t('tw.new') : undefined}>
                  {isNew ? (
                    <button class="btn btn--ghost btn--sm" onClick={() => undo(p.name)}>
                      {t('tw.undo')}
                    </button>
                  ) : (
                    <button
                      class="btn btn--sm"
                      disabled={!canSell(players, w, p)}
                      onClick={() => onChange({ ...w, sold: [...w.sold, p.name] })}
                    >
                      {t('tw.sell')}
                    </button>
                  )}
                </Row>
              );
            })}
        </ul>
      ) : (
        <>
          <div class="tw-filters">
            <input
              type="search"
              placeholder={t('players.search')}
              aria-label={t('players.search')}
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            />
          </div>
          <Chips
            label={t('players.position')}
            options={GROUPS}
            value={group}
            onChange={setGroup}
            name={(g) => (g === 'all' ? t('hl.theme.all') : t(`hl.theme.${g}`))}
          />
          <ul class="tw-list">
            {offers.map((p) => (
              <Row player={p} ctx={ctx} price={buyPrice(p, ctx)} club>
                <button
                  class="btn btn--primary btn--sm"
                  disabled={!canBuy(players, w, p, ctx)}
                  onClick={() => onChange({ ...w, bought: [...w.bought, p.name] })}
                >
                  {t('tw.buy')}
                </button>
              </Row>
            ))}
          </ul>
        </>
      )}

      {/* Switching TM ↔ model reprices every deal, and can leave the window over budget. */}
      {left < 0 && <p class="notice-inline">{t('tw.overBudget', { v: formatEur(-left) })}</p>}
      <div class="tw-play action-bar">
        <button class="btn btn--primary btn--big" onClick={onPlay} disabled={left < 0}>
          <Icon name="ball-football" /> {t('tw.play')}
        </button>
      </div>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Stat({
  label,
  before,
  now,
  format,
  lowerIsBetter = false,
}: {
  label: string;
  before: number;
  now: number;
  format: (v: number) => string;
  lowerIsBetter?: boolean;
}) {
  const changed = format(before) !== format(now);
  const better = lowerIsBetter ? now < before : now > before;
  return (
    <div class="tw-stat">
      <dt>{label}</dt>
      <dd>
        {format(now)}
        {changed && (
          <small class={better ? 'up' : 'down'}>
            {t('tw.was', { v: format(before) })}
          </small>
        )}
      </dd>
    </div>
  );
}

function Row({
  player: p,
  ctx,
  price,
  club = false,
  tag,
  children,
}: {
  player: Player;
  ctx: Ctx;
  /** What the deal costs or brings, not his value. */
  price: number;
  club?: boolean;
  tag?: string;
  children: preact.ComponentChildren;
}) {
  const { meta } = useDataset();
  const source = ctx.source;
  const left = yearsLeft(p, ctx.season);
  return (
    <li class="trow">
      <Avatar player={p} size={30} />
      <span class="trow__name">
        {p.name}
        {tag && <em class="trow__tag">{tag}</em>}
        <small>
          {club && <>{meta.clubs[p.club].short} · </>}
          {posLabel(p.pos)} · {p.age}
        </small>
      </span>
      <span class="prow__ovr">{rating(p, source)}</span>
      <span class="trow__price" title={t('tw.valueIs', { v: formatEur(valueOf(p, source)) })}>
        {formatEur(price)}
        {/* Only a contract that lowers the price, under the price it lowers. */}
        {left !== null && left <= 2 && (
          <small class={left <= 1 ? 'trow__expiring' : ''}>{t('tw.contract', { year: p.contract! })}</small>
        )}
      </span>
      {children}
    </li>
  );
}
