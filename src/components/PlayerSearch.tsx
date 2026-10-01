import { useMemo, useRef, useState } from 'preact/hooks';
import { useDataset } from '../data/store';
import type { Player } from '../data/types';
import { t } from '../i18n';
import { posLabel } from '../i18n/labels';
import { fold } from '../lib/format';
import { Avatar } from './Avatar';

const MAX_RESULTS = 8;
const MAX_SUGGESTIONS = 4;

/** Edit distance (Levenshtein), stopping early once it exceeds `limit`. */
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, row[j]);
    }
    if (rowMin > limit) return limit + 1;
    prev = row;
  }
  return prev[b.length];
}

interface Props {
  onPick: (player: Player) => void;
  /** Players that can no longer be picked (already guessed). */
  exclude?: ReadonlySet<number>;
  placeholder?: string;
  disabled?: boolean;
}

/** Accent-insensitive autocomplete over every player, keyboard friendly. */
export function PlayerSearch({ onPick, exclude, placeholder = t('search.placeholder'), disabled }: Props) {
  const { players, meta } = useDataset();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const index = useMemo(
    () => players.map((p) => ({ p, key: fold(`${p.name} ${p.short}`) })),
    [players],
  );

  const { results, fuzzy } = useMemo(() => {
    const q = fold(query.trim());
    if (q.length < 2) return { results: [], fuzzy: false };
    const starts: Player[] = [];
    const contains: Player[] = [];
    for (const { p, key } of index) {
      if (exclude?.has(p.id)) continue;
      const words = key.split(/[\s.'-]+/);
      if (words.some((w) => w.startsWith(q)) || key.startsWith(q)) starts.push(p);
      else if (key.includes(q)) contains.push(p);
    }
    const byValue = (a: Player, b: Player) => b.tm - a.tm;
    const exact = [...starts.sort(byValue), ...contains.sort(byValue)].slice(0, MAX_RESULTS);
    if (exact.length || q.length < 3) return { results: exact, fuzzy: false };

    // Nothing matches: suggest the names closest to what was typed ("Odegard" → Ødegaard is
    // already folded; this catches "Saliva", "Haaland" typed as "Halland", and so on).
    const limit = q.length <= 5 ? 1 : 2;
    const near: { p: Player; d: number }[] = [];
    for (const { p, key } of index) {
      if (exclude?.has(p.id)) continue;
      const words = [...key.split(/[\s.'-]+/), key];
      const d = Math.min(...words.map((w) => Math.min(distance(q, w, limit), distance(q, w.slice(0, q.length), limit) + 1)));
      if (d <= limit) near.push({ p, d });
    }
    near.sort((a, b) => a.d - b.d || b.p.tm - a.p.tm);
    return { results: near.slice(0, MAX_SUGGESTIONS).map((n) => n.p), fuzzy: true };
  }, [query, index, exclude]);

  function choose(p: Player) {
    onPick(p);
    setQuery('');
    setActive(0);
    input.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      setQuery('');
      return;
    }
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[Math.min(active, results.length - 1)]);
    }
  }

  const listId = 'player-search-list';
  return (
    <div class="search">
      <input
        ref={input}
        type="text"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={results.length ? `ps-${results[active]?.id}` : undefined}
        autocomplete="off"
        autocapitalize="off"
        spellcheck={false}
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onInput={(e) => {
          setQuery((e.target as HTMLInputElement).value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {results.length === 0 && fold(query.trim()).length >= 2 && (
        <p class="search__empty" role="status">
          {t('search.empty', { query: query.trim() })}
        </p>
      )}
      {results.length > 0 && (
        <ul class="search__list" id={listId} role="listbox" aria-label={fuzzy ? t('search.didYouMean') : undefined}>
          {fuzzy && (
            <li class="search__hint" role="presentation">
              {t('search.didYouMean')}
            </li>
          )}
          {results.map((p, i) => (
            <li
              id={`ps-${p.id}`}
              role="option"
              aria-selected={i === active}
              class={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
            >
              <Avatar player={p} size={28} />
              <span class="search__name">{p.name}</span>
              <span class="search__meta">
                {meta.clubs[p.club].short} · {posLabel(p.pos)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
