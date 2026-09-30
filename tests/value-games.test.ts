import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Player } from '../src/data/types';
import { modelGap } from '../src/data/valueSource';
import { drawRound, modelNotes, pool as bmPool, ROUNDS, sideOf } from '../src/games/beat-model/logic';
import { isCorrect, maxRatio, nextChallenger, pool as hlPool } from '../src/games/higher-lower/logic';
import { emoji, eurToSlider, roundPrice, score, sliderToEur } from '../src/games/price-tag/logic';
import { mulberry32 } from '../src/lib/rng';

const players: Player[] = JSON.parse(readFileSync('public/data/players.json', 'utf8'));

describe('Higher or Lower', () => {
  const candidates = hlPool(players);

  it('never pairs two players of equal value', () => {
    const rand = mulberry32(5);
    for (const source of ['tm', 'model'] as const) {
      let current = candidates[0];
      for (let i = 0; i < 300; i++) {
        const next = nextChallenger(current, candidates, source, i % 30, new Set(), rand);
        const cv = source === 'tm' ? current.tm : current.model;
        const nv = source === 'tm' ? next.tm : next.model;
        expect(nv).not.toBe(cv);
        current = next;
      }
    }
  });

  it('brings pairs closer as the streak grows', () => {
    const rand = mulberry32(9);
    const current = candidates.find((p) => p.tm === 30_000_000)!;
    for (let i = 0; i < 100; i++) {
      const next = nextChallenger(current, candidates, 'tm', 25, new Set(), rand);
      expect(Math.max(next.tm, current.tm) / Math.min(next.tm, current.tm)).toBeLessThanOrEqual(maxRatio(25));
    }
  });

  it('judges calls on the active source', () => {
    const a = { ...candidates[0], tm: 10, model: 50 };
    const b = { ...candidates[1], tm: 20, model: 40 };
    expect(isCorrect(a, b, 'higher', 'tm')).toBe(true);
    expect(isCorrect(a, b, 'higher', 'model')).toBe(false);
  });
});

describe('Beat the Model', () => {
  it('leaves out cheap players and near-ties', () => {
    for (const p of bmPool(players)) {
      expect(p.tm).toBeGreaterThanOrEqual(5_000_000);
      expect(Math.abs(modelGap(p))).toBeGreaterThanOrEqual(0.08);
    }
  });

  it('draws distinct players with both answers well represented', () => {
    let over = 0;
    let total = 0;
    for (let seed = 0; seed < 200; seed++) {
      const round = drawRound(players, mulberry32(seed));
      expect(round).toHaveLength(ROUNDS);
      expect(new Set(round.map((p) => p.id)).size).toBe(ROUNDS);
      over += round.filter((p) => sideOf(p) === 'over').length;
      total += round.length;
    }
    expect(over / total).toBeGreaterThan(0.45);
    expect(over / total).toBeLessThan(0.55);
  });

  it('explains at most three things', () => {
    for (const p of players) expect(modelNotes(p, 5).length).toBeLessThanOrEqual(3);
  });
});

describe('Price Tag', () => {
  it('scores 100 for a perfect guess and 0 at three times out', () => {
    expect(score(40_000_000, 40_000_000)).toBe(100);
    expect(score(120_000_000, 40_000_000)).toBe(0);
    expect(score(40_000_000 / 3, 40_000_000)).toBe(0);
    expect(score(50_000_000, 40_000_000)).toBeGreaterThan(75);
  });

  it('maps the slider onto a log scale and back', () => {
    expect(sliderToEur(0)).toBe(500_000);
    expect(sliderToEur(1)).toBe(250_000_000);
    expect(sliderToEur(eurToSlider(15_000_000))).toBe(15_000_000);
  });

  it('rounds to two significant figures', () => {
    expect(roundPrice(47_312_000)).toBe(47_000_000);
    expect(roundPrice(4_731_200)).toBe(4_700_000);
    expect(roundPrice(752_000)).toBe(750_000);
  });

  it('shows the right emoji', () => {
    expect([95, 70, 40, 5, 0].map(emoji).join('')).toBe('🎯🟩🟨🟧🟥');
  });
});
