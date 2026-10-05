/**
 * Player ratings and squad strength, shared by Road to 38-0 and Budget XI.
 *
 * An overall rating (OVR) is built in three steps:
 *
 * 1. **Ability value.** The market value on the active source, corrected for
 *    age and position. Transfermarkt prices young players for their potential
 *    and resale, and veterans for their lack of it: a 35-year-old regular is
 *    cheap but still good today (AGE_FACTOR). Goalkeepers sell for less than
 *    outfield players of the same standing (POSITION_FACTOR). The result is a
 *    rough "what he is worth on the pitch now".
 * 2. **Score.** 60% that ability value (log scale), 40% performance (the
 *    exported `perf`: minutes, bonus points, xGChain, goal involvement, form,
 *    Champions League games, as a percentile within his position group).
 * 3. **Scale.** Scores are ranked across the league and mapped onto a
 *    FIFA-like distribution (RATING_CURVE): the best player ~91, the top 3%
 *    86+, a median Premier League player ~73, fringe youngsters in the 50s.
 *    Ranking keeps the order the score gives while making the numbers read
 *    the way football fans expect.
 * 4. **Reader corrections.** A short, explicit list (RATING_ADJUSTMENTS) for
 *    players a reader judged the formula still gets wrong; every reader rating
 *    is a test (tests/rating-labels.test.ts) the formula has to keep passing.
 * 5. **EA Sports FC 27.** Where a player has an FC 27 base card (`ref`, from
 *    pipeline/fc27-ratings.json), the rating is kept within REF_TOLERANCE of
 *    it: the formula still moves it (form, the value source), but it never
 *    strays from what players know from the game.
 */
import type { Player, PosCode } from '../data/types';
import { valueOf, type ValueSource } from '../data/valueSource';

export const RATING_MIN = 55;
export const RATING_MAX = 91;
const VALUE_WEIGHT = 0.6;

/** Value scale for ratings: logarithmic between these two prices, clamped. */
const VALUE_FLOOR = 1_000_000;
const VALUE_CEILING = 200_000_000;

/**
 * 0-1 value score on a log scale: €200m and above scores 1.0, a €100m player
 * 0.87, a €20m player 0.57, €1m and below 0.
 */
export function valueScore(value: number): number {
  const x = Math.log(value / VALUE_FLOOR) / Math.log(VALUE_CEILING / VALUE_FLOOR);
  return Math.min(1, Math.max(0, x));
}

/** Multiplier from market price to "ability now", by age. */
export const AGE_FACTOR: Record<number, number> = {
  17: 0.55, 18: 0.6, 19: 0.65, 20: 0.72, 21: 0.82, 22: 0.9, 23: 0.96,
  24: 1, 25: 1, 26: 1, 27: 1,
  28: 1.1, 29: 1.3, 30: 1.55, 31: 1.85, 32: 2.25, 33: 2.7, 34: 3.2, 35: 3.7,
};

export function ageFactor(age: number): number {
  return AGE_FACTOR[age] ?? (age < 17 ? 0.55 : 4);
}

/** Multiplier from market price to ability, by position: keepers are cheap for their level. */
export const POSITION_FACTOR: Partial<Record<PosCode, number>> = { GK: 1.5 };

/**
 * Points added after the scale, for players a reader judged the formula still
 * rates wrong (keyed by name, which survives data updates). Kept short: when
 * a pattern shows up here, the formula is what should change.
 */
/** How far a rating may stray from the player's FC 27 rating. */
export const REF_TOLERANCE = 2;

export const RATING_ADJUSTMENTS: Record<string, number> = {
  'Bruno Fernandes': 3,
  'Carlos Baleba': 5,
  'Youri Tielemans': 3,
};

/** The 0-1 score a rating is ranked on. */
export function ratingScore(player: Player, source: ValueSource): number {
  const ability = valueOf(player, source) * ageFactor(player.age) * (POSITION_FACTOR[player.pos] ?? 1);
  return VALUE_WEIGHT * valueScore(ability) + (1 - VALUE_WEIGHT) * (player.perf / 100);
}

/**
 * League percentile -> rating, piecewise linear: the spread of FC 27's
 * Premier League base cards (median 77, top 3% 86+, youngsters from the
 * high 50s), so players without a card sit on the same scale as those with one.
 */
export const RATING_CURVE: [number, number][] = [
  [0, 57],
  [0.1, 70],
  [0.25, 74],
  [0.5, 77],
  [0.75, 80],
  [0.9, 83],
  [0.97, 86],
  [0.995, 89],
  [1, 91],
];

function curve(q: number): number {
  for (let i = 1; i < RATING_CURVE.length; i++) {
    const [q1, r1] = RATING_CURVE[i];
    if (q <= q1) {
      const [q0, r0] = RATING_CURVE[i - 1];
      return r0 + ((r1 - r0) * (q - q0)) / (q1 - q0);
    }
  }
  return RATING_MAX;
}

/** Every player's score, sorted, per source: the league the ratings rank against. */
let pool: Record<ValueSource, number[]> | null = null;
const cache: Record<ValueSource, Map<number, number>> = { tm: new Map(), model: new Map() };

/** Set the league ratings are ranked within. Called once the dataset loads. */
export function setRatingPool(players: readonly Player[]): void {
  const sorted = (s: ValueSource) => players.map((p) => ratingScore(p, s)).sort((a, b) => a - b);
  pool = { tm: sorted('tm'), model: sorted('model') };
  cache.tm.clear();
  cache.model.clear();
}

function rankOf(sorted: number[], score: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < score) lo = mid + 1;
    else hi = mid;
  }
  return lo / Math.max(1, sorted.length - 1);
}

/** Overall rating (55-91) on the given value source. */
export function rating(player: Player, source: ValueSource): number {
  if (!pool) throw new Error('setRatingPool() must run before ratings are read');
  const hit = cache[source].get(player.id);
  if (hit !== undefined) return hit;
  const scaled = Math.round(curve(rankOf(pool[source], ratingScore(player, source))));
  let r = scaled + (RATING_ADJUSTMENTS[player.name] ?? 0);
  if (player.ref) r = Math.min(player.ref + REF_TOLERANCE, Math.max(player.ref - REF_TOLERANCE, r));
  r = Math.min(RATING_MAX, Math.max(RATING_MIN, r));
  cache[source].set(player.id, r);
  return r;
}

// ---------- Formations and positional fit ----------

export type SlotType = PosCode;

/**
 * How well a player of each position fills a slot (1 = natural). Neighbouring
 * roles cost nothing or a few per cent, so a star is never far below his
 * rating out of position; positions not listed cannot play there at all (no
 * goalkeepers up front).
 */
export const FIT: Record<SlotType, Partial<Record<PosCode, number>>> = {
  GK: { GK: 1 },
  CB: { CB: 1, DM: 0.93, LB: 0.93, RB: 0.93 },
  LB: { LB: 1, RB: 0.96, LM: 0.95, CB: 0.93, LW: 0.9 },
  RB: { RB: 1, LB: 0.96, RM: 0.95, CB: 0.93, RW: 0.9 },
  // The middle three are one family: a holding player can step up, a 10 can drop in.
  DM: { DM: 1, CM: 1, AM: 0.97, CB: 0.93 },
  CM: { CM: 1, DM: 1, AM: 1, LM: 0.94, RM: 0.94 },
  AM: { AM: 1, CM: 1, DM: 0.97, LW: 0.97, RW: 0.97, LM: 0.97, RM: 0.97, ST: 0.95 },
  // Wide players: same side costs nothing, the other flank or the middle a little.
  LM: { LM: 1, LW: 1, RM: 0.98, RW: 0.98, AM: 0.97, CM: 0.94, LB: 0.93 },
  RM: { RM: 1, RW: 1, LM: 0.98, LW: 0.98, AM: 0.97, CM: 0.94, RB: 0.93 },
  LW: { LW: 1, LM: 1, RW: 0.98, RM: 0.98, AM: 0.97, ST: 0.95 },
  RW: { RW: 1, RM: 1, LW: 0.98, LM: 0.98, AM: 0.97, ST: 0.95 },
  ST: { ST: 1, AM: 0.95, LW: 0.95, RW: 0.95 },
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
