/** Shapes of the JSON written by pipeline/export_data.py. */

export type PosGroup = 'GK' | 'DEF' | 'MID' | 'FWD';
export type PosCode =
  | 'GK'
  | 'CB' | 'RB' | 'LB'
  | 'DM' | 'CM' | 'AM' | 'RM' | 'LM'
  | 'RW' | 'LW' | 'ST';

/** 0 = Premier League history, 1 = other leagues only, 2 = no covered record. */
export type EvidenceTier = 0 | 1 | 2;

export interface PlayerStats {
  minutes: number;
  goals: number;
  assists: number;
  points: number;
  plSeasons: number;
  plMinutes: number;
  plGoals: number;
  plAssists: number;
  clMinutes: number;
}

export interface Player {
  id: number;
  name: string;
  /** FPL display name, e.g. "Saka". */
  short: string;
  /** Three-letter club code, a key of Meta.clubs. */
  club: string;
  pos: PosCode;
  group: PosGroup;
  age: number;
  nat: string;
  flag: string;
  continent: string;
  /** Transfermarkt market value, EUR. */
  tm: number;
  /** pl-value model estimate (out-of-fold), EUR. */
  model: number;
  /** 80% range around the model estimate, EUR. */
  low: number;
  high: number;
  tier: EvidenceTier;
  /** 0-100 performance percentile within the position group; never uses price. */
  perf: number;
  /** Recognisable enough to be a daily puzzle answer. */
  known: boolean;
  contract: string | null;
  fee: number | null;
  stats: PlayerStats;
}

export interface Club {
  name: string;
  short: string;
  primary: string;
  secondary: string;
}

export interface TierInfo {
  key: string;
  label: string;
  players: number;
  rangeLow: number;
  rangeHigh: number;
}

export interface Meta {
  season: string;
  dataDate: string;
  gameweek: number;
  exportedAt: string;
  source: { name: string; url: string };
  players: number;
  model: {
    kind: string;
    features: number;
    scoring: string;
    cvR2Log: number;
    cvMaeEur: number;
    cvRmseEur: number;
    cvTopDecileMaeEur: number;
    cvTopDecileRatio: number;
    rangeLevel: number;
    tiers: Record<string, TierInfo>;
    /** Plain-language accuracy figures from the same out-of-fold estimates. */
    diagnostics: {
      typicalMiss: number;
      inRange: number;
      ratioUnder5m: number;
      ratioOver20m: number;
      typicalMissNoRecord: number;
      typicalMissWithRecord: number;
      totalModelEur: number;
      totalTmEur: number;
    };
  };
  clubs: Record<string, Club>;
}
