import { useMemo, useState } from 'preact/hooks';
import { Avatar, Crest } from '../components/Avatar';
import { Chips } from '../components/Chips';
import { Icon } from '../components/Icon';
import { PlayerCard } from '../components/PlayerCard';
import { ValueChart } from '../components/ValueChart';
import { useHistory } from '../data/history';
import { useDataset } from '../data/store';
import type { Player } from '../data/types';
import { valueOf, valueSource } from '../data/valueSource';
import { t, type Key } from '../i18n';
import { posLabel } from '../i18n/labels';
import { fold, formatEur, formatInt, formatPct } from '../lib/format';
import { rating } from '../lib/strength';
import { playerPath } from '../lib/playerUrl';
import { href, routeParam } from '../router';

type Group = 'all' | 'GK' | 'DEF' | 'MID' | 'FWD';
const GROUPS: Group[] = ['all', 'GK', 'DEF', 'MID', 'FWD'];

type SortKey = 'ovr' | 'value' | 'gap' | 'goals' | 'assists' | 'minutes' | 'age';
const SORTS: SortKey[] = ['ovr', 'value', 'gap', 'goals', 'assists', 'minutes', 'age'];

const PAGE = 40;
/** Below this Transfermarkt value the model-vs-TM gap is noise. */
const GAP_MIN_VALUE = 5_000_000;

/** The number a sort is by, shown at the end of each row. */
function metric(p: Player, key: SortKey, source: 'tm' | 'model'): { value: number; label: string } {
  switch (key) {
    case 'ovr':
    case 'value':
      return { value: key === 'ovr' ? rating(p, source) : valueOf(p, source), label: formatEur(valueOf(p, source)) };
    case 'gap': {
      // Small values make huge percentages (€300K → €17M is +5600%): rank those last.
      const gap = p.model / p.tm - 1;
      return { value: p.tm >= GAP_MIN_VALUE ? gap : -Infinity, label: formatPct(gap) };
    }
    case 'goals':
      return { value: p.stats.goals, label: `${p.stats.goals} ${t('players.goalsShort')}` };
    case 'assists':
      return { value: p.stats.assists, label: `${p.stats.assists} ${t('players.assistsShort')}` };
    case 'minutes':
      return { value: p.stats.minutes, label: `${formatInt(p.stats.minutes)}′` };
    case 'age':
      return { value: -p.age, label: t('players.age', { n: p.age }) };
  }
}

/** Every player in the data: search, filter, sort, and open one for the full card. */
export function Players() {
  const { players, meta } = useDataset();
  const h = useHistory();
  const source = valueSource.value;
  const clubParam = routeParam('club');
  const [query, setQuery] = useState('');
  const [club, setClub] = useState(clubParam && meta.clubs[clubParam] ? clubParam : '');
  const [group, setGroup] = useState<Group>('all');
  const [sort, setSort] = useState<SortKey>('ovr');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(null);

  const list = useMemo(() => {
    const q = fold(query.trim());
    return players
      .filter((p) => (!club || p.club === club) && (group === 'all' || p.group === group))
      .filter((p) => !q || fold(`${p.name} ${p.short}`).includes(q))
      .map((p) => ({ p, m: metric(p, sort, source) }))
      .sort((a, b) => b.m.value - a.m.value || rating(b.p, source) - rating(a.p, source));
  }, [players, query, club, group, sort, source]);

  const clubs = Object.entries(meta.clubs).sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <section class="players">
      <header class="players__head">
        <h1>{t('players.title')}</h1>
        <p class="lede">{t('players.lede', { n: players.length, gw: meta.gameweek })}</p>
      </header>

      <div class="players__tools">
        <input
          type="search"
          placeholder={t('players.search')}
          aria-label={t('players.search')}
          value={query}
          onInput={(e) => {
            setQuery((e.target as HTMLInputElement).value);
            setShown(PAGE);
          }}
        />
        <select value={club} onChange={(e) => (setClub((e.target as HTMLSelectElement).value), setShown(PAGE))} aria-label={t('players.club')}>
          <option value="">{t('players.allClubs')}</option>
          {clubs.map(([code, c]) => (
            <option value={code}>{c.name}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as SortKey)} aria-label={t('players.sort')}>
          {SORTS.map((s) => (
            <option value={s}>{t(`players.sort.${s}` as Key)}</option>
          ))}
        </select>
      </div>
      <Chips
        label={t('players.position')}
        options={GROUPS}
        value={group}
        onChange={(g) => (setGroup(g), setShown(PAGE))}
        name={(g) => (g === 'all' ? t('hl.theme.all') : t(`hl.theme.${g}`))}
      />

      <p class="players__count" aria-live="polite">
        {t('players.count', { count: list.length })}
      </p>

      <ol class="players__list">
        {list.slice(0, shown).map(({ p, m }, i) => (
          <li>
            <button class={`prow ${open === p.id ? 'prow--current' : ''}`} aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
              <span class="players__rank">{i + 1}</span>
              <Avatar player={p} size={30} />
              <span class="prow__name">
                {p.name}
                <small>
                  <Crest code={p.club} size={12} /> {meta.clubs[p.club].short} · {posLabel(p.pos)} · {p.age}
                </small>
              </span>
              <span class="prow__ovr">{rating(p, source)}</span>
              <span class="prow__price">{m.label}</span>
            </button>
            {open === p.id && (
              <div class="players__card">
                <PlayerCard player={p}>
                  <div class="value-compare">
                    <div class={`vc ${source === 'tm' ? 'vc--on' : ''}`}>
                      <small>{t('compare.tm')}</small>
                      {formatEur(p.tm)}
                    </div>
                    <div class={`vc ${source === 'model' ? 'vc--on' : ''}`}>
                      <small>{t('compare.model')}</small>
                      {formatEur(p.model)}
                    </div>
                    <div class={`vc vc--gap ${p.model >= p.tm ? 'up' : 'down'}`}>
                      <small>{t('compare.gap')}</small>
                      {formatPct(p.model / p.tm - 1)}
                    </div>
                    <div class="vc">
                      <small>{t('players.range')}</small>
                      {formatEur(p.low)}–{formatEur(p.high)}
                    </div>
                  </div>
                  {h?.career[p.name] && <ValueChart points={h.career[p.name]} unit={h.unit} label={t('chart.title')} />}
                  <a class="btn players__profile" href={href(playerPath(p))}>
                    {t('players.profile')} <Icon name="arrow-right" size={18} />
                  </a>
                </PlayerCard>
              </div>
            )}
          </li>
        ))}
      </ol>
      {list.length > shown && (
        <button class="btn players__more" onClick={() => setShown(shown + PAGE)}>
          {t('players.more', { n: Math.min(PAGE, list.length - shown) })}
        </button>
      )}
    </section>
  );
}
