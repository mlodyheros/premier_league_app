/**
 * Who scored and who assisted your XI's goals in a simulated season.
 *
 * The season simulation only knows team goals. Each goal is then given a
 * scorer, drawn with weights from the slot he plays (a striker scores far more
 * than a centre-back) times his own record (goals per 90 against what is
 * normal for his position), and, about three goals in five, an assister drawn
 * the same way from assist records but more concentrated, since one or two
 * creators make most of a side's assists. A few goals are own goals and are
 * credited to nobody. Goalkeepers never score.
 */
import type { Player, PosCode } from '../data/types';
import type { MatchResult } from './season';
import type { Formation, Lineup, SlotType } from './strength';

export interface Tally {
  goals: number;
  assists: number;
}

/** Share of goals that come with an assist (penalties and many set pieces don't). */
export const ASSISTED_SHARE = 0.62;
/** Share of a side's goals that are own goals: nobody in your XI scores them. */
export const OWN_GOAL_SHARE = 0.03;
/**
 * Assists are concentrated: one or two creators lead, the rest share little.
 * Raising the weights to this power keeps a 100-goal side to a couple of
 * double-figure assisters, as in real seasons.
 */
const ASSIST_CONCENTRATION = 1.5;

const SCORE_BY_SLOT: Record<SlotType, number> = {
  ST: 0.85, LW: 0.6, RW: 0.6, AM: 0.55, LM: 0.45, RM: 0.45, CM: 0.24, DM: 0.1, CB: 0.09, LB: 0.08, RB: 0.08, GK: 0,
};
const ASSIST_BY_SLOT: Record<SlotType, number> = {
  AM: 0.8, LW: 0.7, RW: 0.7, LM: 0.6, RM: 0.6, ST: 0.45, CM: 0.45, LB: 0.35, RB: 0.35, DM: 0.2, CB: 0.07, GK: 0.02,
};
/** Typical goals and assists per 90 by position: the yardstick for a player's own rate. */
const NORM_G90: Partial<Record<PosCode, number>> = { ST: 0.45, LW: 0.3, RW: 0.3, AM: 0.25, LM: 0.2, RM: 0.2, CM: 0.1, DM: 0.05 };
const NORM_A90: Partial<Record<PosCode, number>> = { AM: 0.22, LW: 0.2, RW: 0.2, LM: 0.18, RM: 0.18, ST: 0.12, CM: 0.12, LB: 0.1, RB: 0.1, DM: 0.06 };

/** A player's rate against his position's norm, shrunk toward 1 when he has played little. */
function form(p: Player, kind: 'goals' | 'assists'): number {
  const s = p.stats;
  const minutes = s.plMinutes + s.otherMinutes;
  const count = kind === 'goals' ? s.plGoals + s.otherGoals : s.plAssists + s.otherAssists;
  const norm = (kind === 'goals' ? NORM_G90 : NORM_A90)[p.pos] ?? 0.04;
  const per90 = minutes > 0 ? (count / minutes) * 90 : norm;
  const trust = Math.min(1, minutes / 4000); // ~45 full games to fully trust a rate
  const ratio = trust * (per90 / norm) + (1 - trust);
  return 0.5 + 0.5 * Math.min(2.2, ratio);
}

function draw<T>(items: readonly T[], weights: readonly number[], rand: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Goals and assists per player name over the season's results. */
export function attributeGoals(
  formation: Formation,
  lineup: Lineup,
  results: readonly MatchResult[],
  rand: () => number,
): Record<string, Tally> {
  const squad = formation.slots.flatMap((slot) => {
    const p = lineup[slot.id];
    return p ? [{ p, slot: slot.type }] : [];
  });
  const scoreW = squad.map(({ p, slot }) => SCORE_BY_SLOT[slot] * form(p, 'goals'));
  const assistW = squad.map(({ p, slot }) => (ASSIST_BY_SLOT[slot] * form(p, 'assists')) ** ASSIST_CONCENTRATION);
  const tally: Record<string, Tally> = Object.fromEntries(squad.map(({ p }) => [p.name, { goals: 0, assists: 0 }]));

  const goals = results.reduce((n, r) => n + r.goalsFor, 0);
  for (let g = 0; g < goals; g++) {
    if (rand() < OWN_GOAL_SHARE) continue;
    const scorer = draw(squad, scoreW, rand);
    tally[scorer.p.name].goals++;
    if (rand() < ASSISTED_SHARE) {
      const others = squad.filter((x) => x !== scorer);
      const weights = squad.flatMap((x, i) => (x === scorer ? [] : [assistW[i]]));
      tally[draw(others, weights, rand).p.name].assists++;
    }
  }
  return tally;
}
