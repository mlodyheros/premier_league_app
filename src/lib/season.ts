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

export const BASE_GOALS = 1.45;
export const HOME_ADVANTAGE = 1.12;
/** Sensitivity of a side's expected goals to its strength advantage, per rating point. */
export const K_UP = 0.035;
/** ...and to its strength deficit. */
export const K_DOWN = 0.105;

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

export function expectedGoals(attack: number, defence: number, home: boolean): number {
  const gap = attack - defence;
  const k = gap >= 0 ? K_UP : K_DOWN;
  return BASE_GOALS * Math.exp(k * gap) * (home ? HOME_ADVANTAGE : 1 / HOME_ADVANTAGE);
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
export function simulateSeason(teams: Team[], focusId: string, rand: () => number): Season {
  const rows = new Map(teams.map((t) => [t.id, emptyRow(t)]));
  const results: MatchResult[] = [];

  for (const home of teams) {
    for (const away of teams) {
      if (home.id === away.id) continue;
      const hg = poisson(expectedGoals(home.strength, away.strength, true), rand);
      const ag = poisson(expectedGoals(away.strength, home.strength, false), rand);
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
export function perfectSeasonOdds(strength: number, opponents: readonly number[]): number {
  return opponents.reduce(
    (p, opp) => p * winProbability(strength, opp, true).win * winProbability(strength, opp, false).win,
    1,
  );
}

/** Expected points over the season against these opponents, home and away. */
export function expectedPoints(strength: number, opponents: readonly number[]): number {
  return opponents.reduce((sum, opp) => {
    const h = winProbability(strength, opp, true);
    const a = winProbability(strength, opp, false);
    return sum + 3 * (h.win + a.win) + h.draw + a.draw;
  }, 0);
}

/** Win / draw / loss probabilities for one match, by exact Poisson sums. */
export function winProbability(attack: number, defence: number, home: boolean): { win: number; draw: number; loss: number } {
  const lf = expectedGoals(attack, defence, home);
  const la = expectedGoals(defence, attack, !home);
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
