/**
 * The friends league, without a server: everyone's results travel as a short
 * code inside a link. Opening a friend's link adds them to your table; their
 * row updates when they send a newer one.
 */
import { dailyResult } from './daily';
import { getBest } from './records';
import { shareUrl } from './share';
import { readJson, writeJson } from './storage';

export interface Card {
  /** Format version. */
  v: 1;
  /** Nickname. */
  n: string;
  /** The day the daily results are for. */
  d: string;
  /** Daily results as shown on the home page ("3/8", "7/10", "312/500"), or null. */
  g: string | null;
  b: string | null;
  p: string | null;
  /** Bests: 100 PTS Challenge points, Higher or Lower streak, Transfer Window places. */
  r: number | null;
  h: number | null;
  t: number | null;
}

const NAME_KEY = 'league:name';
const FRIENDS_KEY = 'league:friends';
export const NAME_MAX = 20;

function bestOf(...keys: string[]): number | null {
  const vals = keys.map(getBest).filter((v): v is number => v !== null);
  return vals.length ? Math.max(...vals) : null;
}

export function myName(): string {
  return readJson<string>(NAME_KEY) ?? '';
}

export function setMyName(name: string): void {
  writeJson(NAME_KEY, name.trim().slice(0, NAME_MAX));
}

export function myCard(day: string, name = myName()): Card {
  return {
    v: 1,
    n: name || '?',
    d: day,
    g: dailyResult('guess', day),
    b: dailyResult('beat', day),
    p: dailyResult('price', day),
    r: bestOf('road:pts:tm', 'road:pts:model'),
    h: bestOf('hl:tm', 'hl:model'),
    t: bestOf('transfer:tm', 'transfer:model'),
  };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeCard(card: Card): string {
  return toBase64Url(JSON.stringify(card));
}

const RESULT = /^(\d{1,3}|X)\/\d{1,3}$/;
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : null);
const res = (x: unknown) => (typeof x === 'string' && RESULT.test(x) ? x : null);

/** A card from a code, or null if the code is not one. Never trusts what it reads. */
export function decodeCard(code: string): Card | null {
  try {
    const raw = JSON.parse(fromBase64Url(code)) as Record<string, unknown>;
    if (raw.v !== 1 || typeof raw.n !== 'string' || typeof raw.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.d)) {
      return null;
    }
    const name = raw.n.trim().slice(0, NAME_MAX);
    if (!name) return null;
    return { v: 1, n: name, d: raw.d, g: res(raw.g), b: res(raw.b), p: res(raw.p), r: num(raw.r), h: num(raw.h), t: num(raw.t) };
  } catch {
    return null;
  }
}

export function friends(): Card[] {
  return readJson<Card[]>(FRIENDS_KEY) ?? [];
}

/** Add or update a friend (by nickname); an older card never replaces a newer one. */
export function addFriend(card: Card): Card[] {
  const list = friends();
  const at = list.findIndex((c) => c.n.toLowerCase() === card.n.toLowerCase());
  if (at >= 0 && list[at].d > card.d) return list;
  const next = at >= 0 ? list.map((c, i) => (i === at ? card : c)) : [...list, card];
  writeJson(FRIENDS_KEY, next);
  return next;
}

export function removeFriend(name: string): Card[] {
  const next = friends().filter((c) => c.n !== name);
  writeJson(FRIENDS_KEY, next);
  return next;
}

/**
 * One number for the day, 0-100: the mean of the three daily games, each as a
 * share of its best (Guess the Player: 8 points for a first-guess win down to 1
 * for the eighth, out of 8).
 */
export function dayScore(card: Card, day: string): number | null {
  if (card.d !== day) return null;
  const parts: number[] = [];
  if (card.g) {
    const [n, max] = card.g.split('/');
    parts.push(n === 'X' ? 0 : (Number(max) + 1 - Number(n)) / Number(max));
  }
  if (card.b) {
    const [n, max] = card.b.split('/').map(Number);
    parts.push(n / max);
  }
  if (card.p) {
    const [n, max] = card.p.split('/').map(Number);
    parts.push(n / max);
  }
  if (!parts.length) return null;
  return Math.round((parts.reduce((a, b) => a + b, 0) / 3) * 100);
}

export function leagueLink(card: Card): string {
  return shareUrl('league', `?add=${encodeCard(card)}`);
}
