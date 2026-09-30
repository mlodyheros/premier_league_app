import { useMemo, useRef, useState } from 'preact/hooks';
import { useDataset } from '../data/store';
import type { Player } from '../data/types';
import { fold } from '../lib/format';
import { Avatar } from './Avatar';

const MAX_RESULTS = 8;

interface Props {
  onPick: (player: Player) => void;
  /** Players that can no longer be picked (already guessed). */
  exclude?: ReadonlySet<number>;
  placeholder?: string;
  disabled?: boolean;
}

/** Accent-insensitive autocomplete over every player, keyboard friendly. */
export function PlayerSearch({ onPick, exclude, placeholder = 'Type a player…', disabled }: Props) {
  const { players, meta } = useDataset();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const index = useMemo(
    () => players.map((p) => ({ p, key: fold(`${p.name} ${p.short}`) })),
    [players],
  );

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (q.length < 2) return [];
    const starts: Player[] = [];
    const contains: Player[] = [];
    for (const { p, key } of index) {
      if (exclude?.has(p.id)) continue;
      const words = key.split(/[\s.'-]+/);
      if (words.some((w) => w.startsWith(q)) || key.startsWith(q)) starts.push(p);
      else if (key.includes(q)) contains.push(p);
    }
    const byValue = (a: Player, b: Player) => b.tm - a.tm;
    return [...starts.sort(byValue), ...contains.sort(byValue)].slice(0, MAX_RESULTS);
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
          No player matching “{query.trim()}” in this season's squads.
        </p>
      )}
      {results.length > 0 && (
        <ul class="search__list" id={listId} role="listbox">
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
                {meta.clubs[p.club].short} · {p.pos}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
