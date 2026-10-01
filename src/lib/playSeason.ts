/** Play a season with a drafted or bought XI against the real league. */
import type { Meta, Player } from '../data/types';
import type { ValueSource } from '../data/valueSource';
import { clubTeams, USER_TEAM_ID, withUserTeam } from './league';
import { attributeGoals, type Tally } from './scorers';
import {
  DIFFICULTY,
  POINTS_TARGET,
  pointsOdds,
  SEASON_FORM_SD,
  simulateSeason,
  type Difficulty,
  type MatchResult,
  type TableRow,
} from './season';
import type { Formation, Lineup } from './strength';

export interface PlayedSeason {
  source: ValueSource;
  difficulty?: Difficulty;
  /** Road to 100's draft mode, when the XI was drafted. */
  draft?: string;
  strength: number;
  /** Chance of reaching `target` points, before the season was played. */
  odds: number;
  /** The points goal the odds are for; missing on seasons saved when the goal was 38-0. */
  target?: number;
  replaced: string;
  results: MatchResult[];
  table: TableRow[];
  position: number;
  scorers?: Record<string, Tally>;
}

export function playSeason(opts: {
  players: readonly Player[];
  meta: Meta;
  source: ValueSource;
  formation: Formation;
  lineup: Lineup;
  strength: number;
  difficulty?: Difficulty;
  draft?: string;
  /** Players who leave their clubs for your XI (Road to 100); none when bought (Budget XI). */
  without?: ReadonlySet<number>;
  rand?: () => number;
}): PlayedSeason {
  const { players, meta, source, formation, lineup, strength, difficulty = 'realistic', draft } = opts;
  const rand = opts.rand ?? Math.random;
  const clubs = clubTeams(players, meta, source, opts.without);
  const { model, bonus } = DIFFICULTY[difficulty];
  const { league, replaced } = withUserTeam(clubs, strength + bonus);
  const opponents = league.filter((t) => t.id !== USER_TEAM_ID).map((t) => t.strength);
  const season = simulateSeason(league, USER_TEAM_ID, rand, model, SEASON_FORM_SD);
  return {
    source,
    difficulty,
    draft,
    strength,
    odds: pointsOdds(strength + bonus, opponents, model, POINTS_TARGET),
    target: POINTS_TARGET,
    replaced: replaced.name,
    results: season.results,
    table: season.table,
    position: season.position,
    scorers: attributeGoals(formation, lineup, season.results, rand),
  };
}
