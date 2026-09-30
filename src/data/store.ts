/**
 * The only module that knows where the data comes from. Games ask for players
 * and metadata through here, so the source (static JSON today, an API later)
 * can change without touching them.
 */
import { signal } from '@preact/signals';
import type { Meta, Player } from './types';

export interface Dataset {
  players: Player[];
  meta: Meta;
  byId: Map<number, Player>;
}

export const dataset = signal<Dataset | null>(null);
export const loadError = signal<string | null>(null);

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function loadDataset(): Promise<void> {
  try {
    const [players, meta] = await Promise.all([
      fetchJson<Player[]>('players.json'),
      fetchJson<Meta>('meta.json'),
    ]);
    dataset.value = { players, meta, byId: new Map(players.map((p) => [p.id, p])) };
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err);
  }
}

/** For components rendered only once the dataset is loaded. */
export function useDataset(): Dataset {
  const d = dataset.value;
  if (!d) throw new Error('Dataset not loaded');
  return d;
}
