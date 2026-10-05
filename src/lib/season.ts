/**
 * A 38-game season from team strengths.
 *
 * Each match draws goals for both sides from a Poisson distribution. The
 * expected goals start from a league-average rate, rise for the home side, and
 * scale exponentially with the strength gap - asymmetrically: an advantage
 * raises a side's goals slowly (K_UP per rating point) while a deficit cuts
 * them fast (K_DOWN). A far stronger side then wins 3-0 far more often than
 * 7-0, as in real football, instead of running up cricket scores.
 */

export interface MatchModel {
  /** League-average expected goals per side. */
  base: number;
  /** Multiplier for the home side (the away side is divided by it). */
  home: number;
  /** Sensitivity of a side's expected goals to its strength advantage, per rating point. */
  up: number;
  /** ...and to its strength deficit. */
  down: number;
}

/**
 * Tuned so a simulated real league looks like the Premier League (~2.7 goals a
 * game, a champion in the 90s). Since ratings follow EA FC 27 (a narrower
 * spread than before: the weakest club ~75, not ~69), each rating point counts
 * for more: +7% / -21.5%.
 */
export const REALISTIC: MatchModel = { base: 1.45, home: 1.12, up: 0.07, down: 0.215 };

export type Difficulty = 'realistic' | 'arcade';

/**
 * How a draft is simulated. Realistic: the league's own model, no help.
 * Arcade: a steeper curve, and your XI plays every match at its peak (+2.5).
 * Tuned on the real squads and simulated drafts for the 100-point goal: in
 * arcade a typical draft (~82.5) reaches 100 points about one season in ten,
 * a strong one (~84) about every other season, the best (~86) nearly always.
 * Realistic keeps 100 points for the very best drafts (about one in ten).
 */

/** A strong draft's strength, used to quote example odds. */
export const STRONG_DRAFT = 84;
/** The points Road to 100 is named after. */
export const POINTS_TARGET = 100;
export const DIFFICULTY: Record<Difficulty, { model: MatchModel; bonus: number }> = {
  realistic: { model: REALISTIC, bonus: 0 },
  arcade: { model: { base: 1.45, home: 1.12, up: 0.09, down: 0.27 }, bonus: 2.5 },
};

export const BASE_GOALS = REALISTIC.base;
export const HOME_ADVANTAGE = REALISTIC.home;
export const K_UP = REALISTIC.up;
export const K_DOWN = REALISTIC.down;

export interface Team {
  id: string;
  name: string;
  strength: number;
}

export interface MatchResult {
  opponent: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  outcome: 'W' | 'D' | 'L';
}

export interface TableRow {
  id: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface Season {
  table: TableRow[];
  /** The focus team's 38 results, in fixture order. */
  results: MatchResult[];
  position: number;
}

export function expectedGoals(attack: number, defence: number, home: boolean, m: MatchModel = REALISTIC): number {
  const gap = attack - defence;
  const k = gap >= 0 ? m.up : m.down;
  return m.base * Math.exp(k * gap) * (home ? m.home : 1 / m.home);
}

/** Knuth's Poisson sampler; fine for the small means of football scores. */
export function poisson(lambda: number, rand: () => number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = rand();
  while (p > limit) {
    k++;
    p *= rand();
  }
  return k;
}

function emptyRow(t: Team): TableRow {
  return { id: t.id, name: t.name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

function record(row: TableRow, gf: number, ga: number) {
  row.played++;
  row.goalsFor += gf;
  row.goalsAgainst += ga;
  if (gf > ga) {
    row.won++;
    row.points += 3;
  } else if (gf === ga) {
    row.drawn++;
    row.points += 1;
  } else {
    row.lost++;
  }
}

export function sortTable(rows: TableRow[]): TableRow[] {
  return rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      a.name.localeCompare(b.name),
  );
}

/**
 * Play a full double round-robin. The focus team's fixtures alternate home and
 * away, in a shuffled order, so its results read like a real season.
 */
/** A standard normal draw (Box-Muller). */
function gaussian(rand: () => number): number {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * How much a real club's level drifts from season to season (form, injuries,
 * a new manager), in rating points. Without it the strongest squad wins the
 * league nearly every time; real seasons are less predictable.
 */
export const SEASON_FORM_SD = 2.5;

/**
 * Play a full double round-robin. Every club except the focus team first gets
 * a season's form (`formSd` rating points, normally distributed). The focus
 * team's fixtures alternate home and away, in a shuffled order.
 */
export function simulateSeason(
  input: Team[],
  focusId: string,
  rand: () => number,
  m: MatchModel = REALISTIC,
  formSd = 0,
): Season {
  const teams = input.map((t) =>
    t.id === focusId || !formSd ? t : { ...t, strength: t.strength + formSd * gaussian(rand) },
  );
  const rows = new Map(teams.map((t) => [t.id, emptyRow(t)]));
  const results: MatchResult[] = [];

  for (const home of teams) {
    for (const away of teams) {
      if (home.id === away.id) continue;
      const hg = poisson(expectedGoals(home.strength, away.strength, true, m), rand);
      const ag = poisson(expectedGoals(away.strength, home.strength, false, m), rand);
      record(rows.get(home.id)!, hg, ag);
      record(rows.get(away.id)!, ag, hg);
      if (home.id === focusId || away.id === focusId) {
        const isHome = home.id === focusId;
        const gf = isHome ? hg : ag;
        const ga = isHome ? ag : hg;
        results.push({
          opponent: isHome ? away.name : home.name,
          home: isHome,
          goalsFor: gf,
          goalsAgainst: ga,
          outcome: gf > ga ? 'W' : gf === ga ? 'D' : 'L',
        });
      }
    }
  }

  const table = sortTable([...rows.values()]);
  return {
    table,
    results: fixtureOrder(results, rand),
    position: table.findIndex((r) => r.id === focusId) + 1,
  };
}

/** Shuffle each half separately and alternate home and away. */
function fixtureOrder(results: MatchResult[], rand: () => number): MatchResult[] {
  const shuffle = <T,>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };
  const home = shuffle(results.filter((r) => r.home));
  const away = shuffle(results.filter((r) => !r.home));
  return home.flatMap((h, i) => (away[i] ? [h, away[i]] : [h]));
}

/**
 * Chance of winning every one of the fixtures (home and away against each
 * opponent): the exact odds of 38-0 for a team of this strength.
 */
export function perfectSeasonOdds(strength: number, opponents: readonly number[], m: MatchModel = REALISTIC): number {
  return opponents.reduce(
    (p, opp) => p * winProbability(strength, opp, true, m).win * winProbability(strength, opp, false, m).win,
    1,
  );
}

/**
 * Exact chance of finishing with at least `target` points against these
 * opponents (home and away each), by dynamic programming over the 38 results.
 */
export function pointsOdds(
  strength: number,
  opponents: readonly number[],
  m: MatchModel = REALISTIC,
  target = 100,
): number {
  let dist = [1];
  for (const opp of opponents) {
    for (const home of [true, false]) {
      const p = winProbability(strength, opp, home, m);
      const next = new Array(dist.length + 3).fill(0);
      dist.forEach((q, pts) => {
        if (!q) return;
        next[pts + 3] += q * p.win;
        next[pts + 1] += q * p.draw;
        next[pts] += q * p.loss;
      });
      dist = next;
    }
  }
  return dist.reduce((sum, q, pts) => (pts >= target ? sum + q : sum), 0);
}

/** Expected points over the season against these opponents, home and away. */
export function expectedPoints(strength: number, opponents: readonly number[], m: MatchModel = REALISTIC): number {
  return opponents.reduce((sum, opp) => {
    const h = winProbability(strength, opp, true, m);
    const a = winProbability(strength, opp, false, m);
    return sum + 3 * (h.win + a.win) + h.draw + a.draw;
  }, 0);
}

/** Win / draw / loss probabilities for one match, by exact Poisson sums. */
export function winProbability(
  attack: number,
  defence: number,
  home: boolean,
  m: MatchModel = REALISTIC,
): { win: number; draw: number; loss: number } {
  const lf = expectedGoals(attack, defence, home, m);
  const la = expectedGoals(defence, attack, !home, m);
  const pmf = (l: number, k: number) => {
    let f = 1;
    for (let i = 2; i <= k; i++) f *= i;
    return (Math.exp(-l) * l ** k) / f;
  };
  let win = 0;
  let draw = 0;
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= 12; b++) {
      const p = pmf(lf, a) * pmf(la, b);
      if (a > b) win += p;
      else if (a === b) draw += p;
    }
  }
  return { win, draw, loss: 1 - win - draw };
}
