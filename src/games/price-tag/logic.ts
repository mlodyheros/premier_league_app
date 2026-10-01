/** Price Tag: guess a player's value on a log-scale slider. */
import type { Player } from '../../data/types';

export const ROUNDS = 5;
export const MAX_POINTS = 100;
export const SLIDER_MIN = 500_000;
export const SLIDER_MAX = 250_000_000;
/** A guess this many times too high or too low scores nothing. */
export const ZERO_AT = 3;

/** The pool before familiarity levels existed: kept for daily rounds dated before them. */
export function legacyPool(p: Player): boolean {
  return p.known || p.tm >= 5_000_000;
}

export function pool(players: readonly Player[]): Player[] {
  return players.filter(legacyPool);
}

/** The value at the middle of the slider, where a guess starts. */
export const SLIDER_MID = 40_000_000;

/**
 * The slider is logarithmic, bent so its middle sits at SLIDER_MID: plain log
 * spacing would put €11m in the middle and crowd the stars into the last third.
 */
const SPAN = Math.log(SLIDER_MAX / SLIDER_MIN);
const BEND = Math.log(Math.log(SLIDER_MID / SLIDER_MIN) / SPAN) / Math.log(0.5);

/** Slider position (0-1) to euros, rounded to a "price-like" figure. */
export function sliderToEur(t: number): number {
  const x = Math.min(1, Math.max(0, t)) ** BEND;
  return roundPrice(SLIDER_MIN * Math.exp(SPAN * x));
}

export function eurToSlider(eur: number): number {
  const x = Math.log(eur / SLIDER_MIN) / SPAN;
  return Math.min(1, Math.max(0, x)) ** (1 / BEND);
}

/** Two significant figures: €47M, €4.7M, €750K. */
export function roundPrice(eur: number): number {
  const magnitude = 10 ** (Math.floor(Math.log10(eur)) - 1);
  return Math.round(eur / magnitude) * magnitude;
}

/** Round amounts the −/+ buttons step through, in millions. */
const LADDER = [
  0.5, 0.6, 0.75, 1, 1.2, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40,
  45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 220, 250,
].map((m) => m * 1_000_000);

/** The next round amount above (`dir` 1) or below (-1) `eur`, within the slider's range. */
export function stepPrice(eur: number, dir: 1 | -1): number {
  if (dir > 0) return LADDER.find((v) => v > eur) ?? SLIDER_MAX;
  return [...LADDER].reverse().find((v) => v < eur) ?? SLIDER_MIN;
}

/** 100 for an exact guess, falling with the log of the ratio, 0 at 3x out. */
export function score(guess: number, actual: number): number {
  const miss = Math.abs(Math.log(guess / actual)) / Math.log(ZERO_AT);
  return Math.max(0, Math.round(MAX_POINTS * (1 - miss)));
}

export function emoji(points: number): string {
  if (points >= 90) return '🎯';
  if (points >= 60) return '🟩';
  if (points >= 30) return '🟨';
  if (points > 0) return '🟧';
  return '🟥';
}
