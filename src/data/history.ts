/**
 * Value history (public/data/history.json): weekly snapshots of every player's
 * two values, and Transfermarkt career curves. Loaded on first use only: the
 * games do not need it.
 */
import { signal } from '@preact/signals';

export interface History {
  /** Values are stored in units of this many euros. */
  unit: number;
  /** One snapshot per week, oldest first. */
  dates: string[];
  /** Player name → values per snapshot (null when he was not in the data). */
  players: Record<string, { tm: (number | null)[]; model: (number | null)[] }>;
  /** Player name → [YYYY-MM, value] points, oldest first. */
  career: Record<string, [string, number][]>;
}

export const history = signal<History | null>(null);
export const historyError = signal<string | null>(null);
let loading: Promise<void> | null = null;

export function loadHistory(): Promise<void> {
  loading ??= fetch(`${import.meta.env.BASE_URL}data/history.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`history.json: HTTP ${res.status}`);
      return res.json() as Promise<History>;
    })
    .then((h) => {
      history.value = h;
    })
    .catch((err) => {
      loading = null;
      historyError.value = err instanceof Error ? err.message : String(err);
    });
  return loading;
}

/** The history once loaded (null until then); starts loading on first call. */
export function useHistory(): History | null {
  if (!history.value && !loading) void loadHistory();
  return history.value;
}
