/** The games, in the order the home page lists them: one place for paths and icons. */
import type { IconName } from '../components/Icon';
import { readJson } from '../lib/storage';
import { loadStats } from '../lib/stats';

export type GameId = 'guess' | 'road' | 'hl' | 'budget' | 'beat' | 'price' | 'transfer';

export interface GameMeta {
  id: GameId;
  path: string;
  /** Drawn on the page (components/Icon.tsx). */
  icon: IconName;
  /** For share texts, where only an emoji can go. */
  emoji: string;
  /** Games with a daily round, and how to tell whether today's is done. */
  daily?: { done: (day: string) => boolean; streak: () => number };
}

export const GAME_LIST: GameMeta[] = [
  {
    id: 'guess',
    path: 'guess',
    icon: 'user-search',
    emoji: '🔍',
    daily: {
      done: (day) => !!readJson<{ recorded?: boolean }>(`guess:daily:${day}`)?.recorded,
      streak: () => loadStats('guess-daily', 8).streak,
    },
  },
  { id: 'road', path: 'road100', icon: 'soccer-field', emoji: '💯' },
  { id: 'hl', path: 'higher-lower', icon: 'arrows-up-down', emoji: '↕️' },
  { id: 'budget', path: 'budget', icon: 'coins', emoji: '💰' },
  { id: 'transfer', path: 'transfer', icon: 'arrows-exchange', emoji: '🔁' },
  {
    id: 'beat',
    path: 'beat-model',
    icon: 'robot',
    emoji: '🤖',
    daily: {
      done: (day) => (readJson<unknown[]>(`beat:daily:${day}`)?.length ?? 0) >= 10,
      streak: () => loadStats('beat-daily', 0).streak,
    },
  },
  {
    id: 'price',
    path: 'price-tag',
    icon: 'tag',
    emoji: '🏷️',
    daily: {
      done: (day) => (readJson<{ guesses: unknown[] }>(`price:daily:${day}`)?.guesses.length ?? 0) >= 5,
      streak: () => loadStats('price-daily', 0).streak,
    },
  },
];

export function gameMeta(id: GameId): GameMeta {
  return GAME_LIST.find((g) => g.id === id)!;
}
