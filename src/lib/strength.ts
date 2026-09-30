/**
 * Player ratings and squad strength, shared by Road to 38-0 and Budget XI.
 *
 * A rating blends two halves: how the player performs (the exported `perf`,
 * a percentile within his position group) and what he is worth on the active
 * value source (on a log scale of euros). Price alone would make
 * the squad games "buy the dearest"; performance alone would ignore the market.
 */
import type { Player, PosCode } from '../data/types';
import { valueOf, type ValueSource } from '../data/valueSource';

export const RATING_MIN = 40;
export const RATING_MAX = 99;
const PERF_WEIGHT = 0.5;

/** Value scale for ratings: logarithmic between these two prices, clamped. */
const VALUE_FLOOR = 1_000_000;
const VALUE_CEILING = 200_000_000;

/**
 * 0-1 value score on a log scale. A log scale (unlike a league percentile)
 * keeps room at the top: €220m Haaland scores 1.0, a €100m player 0.87, a
 * €20m player 0.57, so a side full of stars stands out from one full of
 * good players.
 */
export function valueScore(value: number): number {
  const x = Math.log(value / VALUE_FLOOR) / Math.log(VALUE_CEILING / VALUE_FLOOR);
  return Math.min(1, Math.max(0, x));
}

/** 40-99 overall rating on the given value source. */
export function rating(player: Player, source: ValueSource): number {
  const blend = PERF_WEIGHT * (player.perf / 100) + (1 - PERF_WEIGHT) * valueScore(valueOf(player, source));
  return Math.round(RATING_MIN + (RATING_MAX - RATING_MIN) * blend);
}

// ---------- Formations and positional fit ----------

export type SlotType = PosCode;

/**
 * How well a player of each position fills a slot (1 = natural). Positions not
 * listed cannot play there at all: no goalkeepers up front.
 */
export const FIT: Record<SlotType, Partial<Record<PosCode, number>>> = {
  GK: { GK: 1 },
  CB: { CB: 1, DM: 0.88, LB: 0.85, RB: 0.85 },
  LB: { LB: 1, LM: 0.9, CB: 0.85, RB: 0.82, LW: 0.8 },
  RB: { RB: 1, RM: 0.9, CB: 0.85, LB: 0.82, RW: 0.8 },
  DM: { DM: 1, CM: 0.94, CB: 0.86, AM: 0.82 },
  CM: { CM: 1, DM: 0.94, AM: 0.94, LM: 0.86, RM: 0.86 },
  AM: { AM: 1, CM: 0.93, LW: 0.9, RW: 0.9, ST: 0.88, LM: 0.86, RM: 0.86 },
  LM: { LM: 1, LW: 0.96, RM: 0.9, RW: 0.88, LB: 0.86, CM: 0.86, AM: 0.86 },
  RM: { RM: 1, RW: 0.96, LM: 0.9, LW: 0.88, RB: 0.86, CM: 0.86, AM: 0.86 },
  LW: { LW: 1, LM: 0.95, RW: 0.92, AM: 0.88, ST: 0.86 },
  RW: { RW: 1, RM: 0.95, LW: 0.92, AM: 0.88, ST: 0.86 },
  ST: { ST: 1, LW: 0.87, RW: 0.87, AM: 0.86 },
};

export function fit(player: Player, slot: SlotType): number {
  return FIT[slot][player.pos] ?? 0;
}

export interface Slot {
  id: string;
  type: SlotType;
  /** Position on the pitch, percent from the left and from the top. */
  x: number;
  y: number;
}

export interface Formation {
  key: string;
  label: string;
  slots: Slot[];
}

const Y = { gk: 90, def: 71, dm: 55, mid: 47, am: 33, fwd: 16 };

function s(id: string, type: SlotType, x: number, y: number): Slot {
  return { id, type, x, y };
}

const BACK_FOUR = [s('lb', 'LB', 12, Y.def), s('lcb', 'CB', 37, Y.def + 3), s('rcb', 'CB', 63, Y.def + 3), s('rb', 'RB', 88, Y.def)];

export const FORMATIONS: Formation[] = [
  {
    key: '433',
    label: '4-3-3',
    slots: [
      s('gk', 'GK', 50, Y.gk),
      ...BACK_FOUR,
      s('lcm', 'CM', 24, Y.mid),
      s('dm', 'DM', 50, Y.dm),
      s('rcm', 'CM', 76, Y.mid),
      s('lw', 'LW', 16, Y.fwd + 4),
      s('st', 'ST', 50, Y.fwd),
      s('rw', 'RW', 84, Y.fwd + 4),
    ],
  },
  {
    key: '442',
    label: '4-4-2',
    slots: [
      s('gk', 'GK', 50, Y.gk),
      ...BACK_FOUR,
      s('lm', 'LM', 12, Y.mid - 3),
      s('lcm', 'CM', 37, Y.mid),
      s('rcm', 'CM', 63, Y.mid),
      s('rm', 'RM', 88, Y.mid - 3),
      s('lst', 'ST', 36, Y.fwd),
      s('rst', 'ST', 64, Y.fwd),
    ],
  },
  {
    key: '4231',
    label: '4-2-3-1',
    slots: [
      s('gk', 'GK', 50, Y.gk),
      ...BACK_FOUR,
      s('ldm', 'DM', 35, Y.dm),
      s('rdm', 'DM', 65, Y.dm),
      s('lw', 'LW', 14, Y.am),
      s('am', 'AM', 50, Y.am + 2),
      s('rw', 'RW', 86, Y.am),
      s('st', 'ST', 50, Y.fwd - 2),
    ],
  },
];

export function formationByKey(key: string): Formation {
  return FORMATIONS.find((f) => f.key === key) ?? FORMATIONS[0];
}

/** slot id -> player */
export type Lineup = Record<string, Player | undefined>;

/** Rating in a slot, after the out-of-position penalty. */
export function slotRating(player: Player, slot: Slot, source: ValueSource): number {
  return rating(player, source) * fit(player, slot.type);
}

/** Mean effective rating over the formation's filled slots, one decimal. */
export function teamStrength(
  formation: Formation,
  lineup: Lineup,
  source: ValueSource,
): number {
  const filled = formation.slots.filter((sl) => lineup[sl.id]);
  if (!filled.length) return 0;
  const total = filled.reduce((sum, sl) => sum + slotRating(lineup[sl.id]!, sl, source), 0);
  return Math.round((total / filled.length) * 10) / 10;
}

/** Players a club is rated on: roughly its starters plus regular rotation. */
export const SQUAD_DEPTH = 16;

/**
 * A club's strength over a season: the mean rating of its best SQUAD_DEPTH
 * players, because clubs rotate. Players in `without` (drafted away) are gone.
 */
export function clubStrength(
  players: readonly Player[],
  club: string,
  source: ValueSource,
  without: ReadonlySet<number> = new Set(),
): number {
  const ratings = players
    .filter((p) => p.club === club && !without.has(p.id))
    .map((p) => rating(p, source))
    .sort((a, b) => b - a)
    .slice(0, SQUAD_DEPTH);
  if (!ratings.length) return RATING_MIN;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}
