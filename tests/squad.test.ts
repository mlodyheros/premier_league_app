import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Meta, Player } from '../src/data/types';
import { affordable, options, spent } from '../src/games/budget/logic';
import { byName as alphabetical, candidates, drawSpin, spinnableClubs } from '../src/games/road38/logic';
import { resultsGrid, seasonBadges } from '../src/components/SeasonResult';
import type { PlayedSeason } from '../src/lib/playSeason';
import type { TableRow } from '../src/lib/season';
import { formatOdds } from '../src/lib/format';
import { clubTeams, withUserTeam } from '../src/lib/league';
import { mulberry32 } from '../src/lib/rng';
import {
  expectedPoints,
  perfectSeasonOdds,
  poisson,
  simulateSeason,
  winProbability,
  type Team,
} from '../src/lib/season';
import { clubStrength, fit, FORMATIONS, rating, setRatingPool, teamStrength, valueScore, type Lineup } from '../src/lib/strength';

const players: Player[] = JSON.parse(readFileSync('public/data/players.json', 'utf8'));
const meta: Meta = JSON.parse(readFileSync('public/data/meta.json', 'utf8'));
const byName = (n: string) => players.find((p) => p.name === n)!;
setRatingPool(players);

describe('ratings', () => {
  it('stay within 52-91 on both value sources', () => {
    for (const p of players) {
      for (const s of ['tm', 'model'] as const) {
        const r = rating(p, s);
        expect(r).toBeGreaterThanOrEqual(52);
        expect(r).toBeLessThanOrEqual(91);
      }
    }
  });

  it("spread like FC 27's Premier League: one 91, about ten 88+, a median in the high 70s", () => {
    const rs = players.map((p) => rating(p, 'tm')).sort((a, b) => a - b);
    expect(rs.filter((r) => r >= 88).length).toBeLessThanOrEqual(12);
    expect(rs[Math.floor(rs.length / 2)]).toBeGreaterThanOrEqual(75);
    expect(rs[Math.floor(rs.length / 2)]).toBeLessThanOrEqual(79);
    expect(rating(byName('Erling Haaland'), 'tm')).toBe(91);
  });

  it('rate veterans on what they do now, not on their resale price', () => {
    // €15m at 35 is cheap because nobody resells him, not because he is weak.
    expect(rating(byName('Virgil van Dijk'), 'tm')).toBeGreaterThanOrEqual(82);
    expect(rating(byName('Bruno Fernandes'), 'tm')).toBeGreaterThanOrEqual(84);
  });

  it('do not rate unproven prospects as stars because they are expensive', () => {
    const prospect = byName('Vitor Reis'); // €30m at 20, barely played
    expect(prospect.tm).toBeGreaterThanOrEqual(20_000_000);
    expect(rating(prospect, 'tm')).toBeLessThan(78);
  });

  it('keep the order of stars sensible', () => {
    expect(rating(byName('Bukayo Saka'), 'tm')).toBeGreaterThan(rating(byName('Morgan Gibbs-White'), 'tm'));
    expect(rating(byName('Declan Rice'), 'tm')).toBeGreaterThanOrEqual(88);
  });

  it('score value on a clamped log scale', () => {
    expect(valueScore(200_000_000)).toBe(1);
    expect(valueScore(500_000)).toBe(0);
    expect(valueScore(20_000_000)).toBeCloseTo(0.565, 2);
  });

  it('never let a goalkeeper play outfield', () => {
    const gk = players.find((p) => p.pos === 'GK')!;
    expect(fit(gk, 'ST')).toBe(0);
    expect(fit(gk, 'GK')).toBe(1);
  });
});

describe('club strength', () => {
  it('ranks the richest squads above the promoted ones', () => {
    const clubs = clubTeams(players, meta, 'tm');
    const top = clubs.reduce((a, b) => (a.strength > b.strength ? a : b));
    const bottom = clubs.reduce((a, b) => (a.strength < b.strength ? a : b));
    expect(['Man City', 'Arsenal', 'Liverpool']).toContain(top.name);
    expect(['Hull', 'Coventry', 'Ipswich', 'Sunderland']).toContain(bottom.name);
  });

  it('drops when players are drafted away', () => {
    const city = players.filter((p) => p.club === 'MCI').sort((a, b) => b.tm - a.tm);
    const before = clubStrength(players, 'MCI', 'tm');
    const after = clubStrength(players, 'MCI', 'tm', new Set(city.slice(0, 3).map((p) => p.id)));
    expect(after).toBeLessThan(before);
  });

  it('puts your XI in place of the weakest club', () => {
    const clubs = clubTeams(players, meta, 'tm');
    const { league, replaced } = withUserTeam(clubs, 85);
    expect(league).toHaveLength(20);
    expect(league.some((t) => t.id === replaced.id)).toBe(false);
  });
});

describe('season simulation', () => {
  const teams: Team[] = Array.from({ length: 20 }, (_, i) => ({ id: `T${i}`, name: `Team ${i}`, strength: 65 + i }));

  it('plays 38 games per team with consistent totals', () => {
    const s = simulateSeason(teams, 'T19', mulberry32(7));
    expect(s.results).toHaveLength(38);
    for (const row of s.table) {
      expect(row.played).toBe(38);
      expect(row.won + row.drawn + row.lost).toBe(38);
      expect(row.points).toBe(row.won * 3 + row.drawn);
    }
    const gf = s.table.reduce((a, r) => a + r.goalsFor, 0);
    const ga = s.table.reduce((a, r) => a + r.goalsAgainst, 0);
    expect(gf).toBe(ga);
    expect(s.position).toBe(s.table.findIndex((r) => r.id === 'T19') + 1);
  });

  it('is reproducible with a seed', () => {
    const a = simulateSeason(teams, 'T3', mulberry32(42));
    const b = simulateSeason(teams, 'T3', mulberry32(42));
    expect(a.table).toEqual(b.table);
  });

  it('alternates home and away for the focus team', () => {
    const s = simulateSeason(teams, 'T0', mulberry32(3));
    expect(s.results.filter((r) => r.home)).toHaveLength(19);
    s.results.forEach((r, i) => expect(r.home).toBe(i % 2 === 0));
  });

  it('gives the stronger side the better odds, and sums to one', () => {
    const p = winProbability(90, 75, true);
    expect(p.win).toBeGreaterThan(p.loss);
    expect(p.win + p.draw + p.loss).toBeCloseTo(1, 6);
    expect(winProbability(80, 80, true).win).toBeGreaterThan(winProbability(80, 80, false).win);
  });

  it('makes 38-0 rarer against stronger opposition', () => {
    const weak = perfectSeasonOdds(92, Array(19).fill(70));
    const strong = perfectSeasonOdds(92, Array(19).fill(85));
    expect(weak).toBeGreaterThan(strong);
    expect(strong).toBeGreaterThan(0);
    expect(expectedPoints(92, Array(19).fill(70))).toBeGreaterThan(expectedPoints(92, Array(19).fill(85)));
  });

  it('samples Poisson goals with the right mean', () => {
    const rand = mulberry32(1);
    let total = 0;
    for (let i = 0; i < 20000; i++) total += poisson(1.4, rand);
    expect(total / 20000).toBeCloseTo(1.4, 1);
  });

  it('formats odds for people', () => {
    expect(formatOdds(0.5, 'en')).toBe('50%');
    expect(formatOdds(1 / 12345, 'en')).toBe('1 in 12,300');
    expect(formatOdds(0, 'en')).toBe('practically zero');
    expect(formatOdds(1 / 12345, 'pl').replace(/\s/g, ' ')).toBe('1 do 12 300');
  });
});

describe('Road to 38-0', () => {
  const f = FORMATIONS[0];

  it('can spin every club on an empty team sheet', () => {
    expect(spinnableClubs(players, Object.keys(meta.clubs), f, {}, 'tm')).toHaveLength(20);
  });

  it('offers only players who fit an open slot, best first', () => {
    const lineup: Lineup = {};
    for (const s of f.slots.filter((s) => s.type !== 'GK')) lineup[s.id] = players.find((p) => p.club === 'COV')!;
    const list = candidates(players, 'ARS', f, lineup, 'tm');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((c) => c.slot.type === 'GK' && c.player.pos === 'GK')).toBe(true);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].rating).toBeGreaterThanOrEqual(list[i].rating);
  });

  it('awards badges for the season, 100 points first', () => {
    const row = (won: number, drawn: number, lost: number) =>
      ({ id: 'YOU', name: 'You', played: 38, won, drawn, lost, goalsFor: 0, goalsAgainst: 0, points: won * 3 + drawn }) as TableRow;
    expect(seasonBadges(row(38, 0, 0), 1).map((b) => b.icon)).toEqual(['💯', '🏆', '⭐']);
    expect(seasonBadges(row(25, 13, 0), 2).map((b) => b.icon)).toEqual(['🛡️']);
    expect(seasonBadges(row(32, 4, 2), 2).map((b) => b.icon)).toEqual(['💯']);
  });

  it('shares 38 results in two rows', () => {
    const results = Array.from({ length: 38 }, (_, i) => ({
      opponent: 'X',
      home: i % 2 === 0,
      goalsFor: 1,
      goalsAgainst: 0,
      outcome: 'W' as const,
    }));
    const rows = resultsGrid({ results } as unknown as PlayedSeason).split('\n');
    expect(rows).toHaveLength(2);
    expect([...rows[0]].length).toBe(19);
  });
});

describe('Budget XI', () => {
  const f = FORMATIONS[0];
  const st = f.slots.find((s) => s.type === 'ST')!;

  it('refunds the current occupant when swapping', () => {
    const haaland = byName('Erling Haaland');
    const lineup: Lineup = { [st.id]: haaland };
    expect(spent(lineup, 'tm')).toBe(haaland.tm);
    expect(affordable(haaland, st, lineup, 220_000_000, 'tm')).toBe(true);
    expect(affordable(haaland, st, {}, 219_000_000, 'tm')).toBe(false);
  });

  it('lists no one twice and flags what you cannot afford', () => {
    const haaland = byName('Erling Haaland');
    const lw = f.slots.find((s) => s.type === 'LW')!;
    const opts = options(players, lw, { [st.id]: haaland }, 300_000_000, 'tm', 'rating');
    expect(opts.some((o) => o.player.id === haaland.id)).toBe(false);
    expect(opts.filter((o) => !o.affordable).every((o) => o.price > 300_000_000 - haaland.tm)).toBe(true);
  });

  it('scores a full XI as the mean effective rating', () => {
    const lineup: Lineup = {};
    const used = new Set<number>();
    for (const s of f.slots) {
      const p = players.find((x) => x.pos === s.type && !used.has(x.id))!;
      used.add(p.id);
      lineup[s.id] = p;
    }
    const mean = f.slots.reduce((a, s) => a + rating(lineup[s.id]!, 'tm'), 0) / 11;
    expect(teamStrength(f, lineup, 'tm')).toBeCloseTo(mean, 1);
  });
});

describe('Budget XI list order', () => {
  it('lists affordable players before unaffordable ones on every sort', () => {
    const f = FORMATIONS[0];
    const rw = f.slots.find((s) => s.type === 'RW')!;
    for (const sort of ['rating', 'bargain', 'cheap', 'dear'] as const) {
      const opts = options(players, rw, {}, 9_000_000, 'tm', sort);
      const firstUnaffordable = opts.findIndex((o) => !o.affordable);
      expect(firstUnaffordable).toBeGreaterThan(0);
      expect(opts.slice(firstUnaffordable).every((o) => !o.affordable)).toBe(true);
    }
  });
});

describe('Road to 38-0 draft modes', () => {
  const f = FORMATIONS[0];
  const clubs = Object.keys(meta.clubs);

  it('draws a club and a position the club can fill', () => {
    const rand = mulberry32(4);
    for (let i = 0; i < 50; i++) {
      const spin = drawSpin(players, clubs, f, {}, 'position', rand)!;
      const slot = f.slots.find((s) => s.id === spin.slot)!;
      expect(slot).toBeDefined();
      expect(players.some((p) => p.club === spin.club && fit(p, slot.type) > 0)).toBe(true);
    }
  });

  it('only draws open positions, and a re-drawn club is a different one', () => {
    const lineup: Lineup = { gk: players.find((p) => p.pos === 'GK')! };
    const rand = mulberry32(9);
    for (let i = 0; i < 50; i++) {
      const first = drawSpin(players, clubs, f, lineup, 'blind', rand)!;
      expect(first.slot).not.toBe('gk');
      const again = drawSpin(players, clubs, f, lineup, 'blind', rand, first)!;
      expect(again.club).not.toBe(first.club);
    }
  });

  it('draws clubs that can fill a drawn position, and positions a drawn club can fill', async () => {
    const { clubOptions, slotOptions } = await import('../src/games/road38/logic');
    for (const club of clubOptions(players, clubs, f, {}, 'gk')) {
      expect(players.some((p) => p.club === club && p.pos === 'GK')).toBe(true);
    }
    const slots = slotOptions(players, clubs, f, {}, 'ARS', 'st');
    expect(slots).not.toContain('st');
    expect(slots.length).toBeGreaterThan(5);
    expect(clubOptions(players, clubs, f, {}, null, 'ARS')).not.toContain('ARS');
  });

  it('draws no position in standard mode', () => {
    expect(drawSpin(players, clubs, f, {}, 'standard', mulberry32(1))!.slot).toBeNull();
  });

  it('lists a blind draft alphabetically, so the order gives no ratings away', () => {
    const list = alphabetical(candidates(players, 'ARS', f, {}, 'tm'));
    const names = list.map((c) => c.player.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe('goal scorers', () => {
  it('give every goal a scorer, most to forwards, none to the keeper', async () => {
    const { attributeGoals } = await import('../src/lib/scorers');
    const f = FORMATIONS[0];
    const lineup: Lineup = {};
    const used = new Set<number>();
    for (const s of f.slots) {
      const p = players.filter((x) => x.pos === s.type && !used.has(x.id)).sort((a, b) => b.tm - a.tm)[0];
      used.add(p.id);
      lineup[s.id] = p;
    }
    const results = Array.from({ length: 38 }, () => ({ opponent: 'X', home: true, goalsFor: 2, goalsAgainst: 1, outcome: 'W' as const }));
    const tally = attributeGoals(f, lineup, results, mulberry32(3));
    const goals = Object.values(tally).reduce((a, t) => a + t.goals, 0);
    // A few are own goals, credited to nobody.
    expect(goals).toBeGreaterThan(66);
    expect(goals).toBeLessThanOrEqual(76);
    expect(tally[lineup.gk!.name].goals).toBe(0);
    expect(tally[lineup.st!.name].goals).toBeGreaterThan(tally[lineup.lcb!.name].goals);
    const assists = Object.values(tally).reduce((a, t) => a + t.assists, 0);
    expect(assists).toBeGreaterThan(30);
    expect(assists).toBeLessThan(60);
    // Assists are concentrated: never five double-figure assisters.
    expect(Object.values(tally).filter((t) => t.assists >= 10).length).toBeLessThan(5);
  });

  it("leave about a fifth to the bench, so a 100-goal side's numbers look real", async () => {
    const { attributeGoals, BENCH } = await import('../src/lib/scorers');
    const f = FORMATIONS[0];
    const lineup: Lineup = {};
    const used = new Set<number>();
    for (const s of f.slots) {
      const p = players.filter((x) => x.pos === s.type && !used.has(x.id)).sort((a, b) => b.tm - a.tm)[0];
      used.add(p.id);
      lineup[s.id] = p;
    }
    // A record season: 38 wins, 106 goals (Manchester City, 2017/18).
    const results = Array.from({ length: 38 }, (_, i) => ({ opponent: 'X', home: true, goalsFor: i < 30 ? 3 : 2, goalsAgainst: 0, outcome: 'W' as const }));
    let top = 0;
    let twenty = 0;
    let bench = 0;
    const runs = 50;
    for (let i = 0; i < runs; i++) {
      const tally = attributeGoals(f, lineup, results, mulberry32(i + 1));
      const xi = Object.entries(tally).filter(([n]) => n !== BENCH).map(([, t]) => t);
      top += Math.max(...xi.map((t) => t.goals));
      twenty += xi.filter((t) => t.goals + t.assists >= 20).length;
      bench += tally[BENCH].goals;
    }
    expect(bench / runs / 110).toBeGreaterThan(0.13);
    expect(bench / runs / 110).toBeLessThan(0.23);
    // City's top scorer had 21 that season; Haaland's record is 36.
    expect(top / runs).toBeLessThan(32);
    // City had four players with 20+ goals and assists; we stay at most there.
    expect(twenty / runs).toBeLessThanOrEqual(4);
  });
});

describe('EA FC 27', () => {
  it('every player with an FC 27 card is within two points of it, on both values', () => {
    for (const source of ['tm', 'model'] as const) {
      for (const p of players.filter((x) => x.ref)) {
        expect(Math.abs(rating(p, source) - p.ref!), `${p.name} (${source})`).toBeLessThanOrEqual(2);
      }
    }
  });
});
