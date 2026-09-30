/** Price Tag: guess a player's value on a log-scale slider. */
import type { Player } from '../../data/types';

export const ROUNDS = 5;
export const MAX_POINTS = 100;
export const SLIDER_MIN = 500_000;
export const SLIDER_MAX = 250_000_000;
/** A guess this many times too high or too low scores nothing. */
export const ZERO_AT = 3;

export function pool(players: readonly Player[]): Player[] {
  return players.filter((p) => p.known || p.tm >= 5_000_000);
}

/** Slider position (0-1) to euros, logarithmic, rounded to a "price-like" figure. */
export function sliderToEur(t: number): number {
  const raw = SLIDER_MIN * (SLIDER_MAX / SLIDER_MIN) ** Math.min(1, Math.max(0, t));
  return roundPrice(raw);
}

export function eurToSlider(eur: number): number {
  return Math.log(eur / SLIDER_MIN) / Math.log(SLIDER_MAX / SLIDER_MIN);
}

/** Two significant figures: €47M, €4.7M, €750K. */
export function roundPrice(eur: number): number {
  const magnitude = 10 ** (Math.floor(Math.log10(eur)) - 1);
  return Math.round(eur / magnitude) * magnitude;
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
