import { beforeEach, describe, expect, it } from 'vitest';

// The league keeps its state in localStorage: a small in-memory stand-in.
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  },
});

const { addFriend, decodeCard, encodeCard, friends, isMine, myCard, myId, removeFriend, setMyName } = await import('../src/lib/friends');

const card = (n: string, i: string | undefined, d = '2026-10-06') => ({ v: 1 as const, n, i, d, g: '3/8', b: null, p: null, r: 90, h: 4, t: 1 });

describe('friends league', () => {
  beforeEach(() => store.clear());

  it('keeps two friends with the same nickname apart', () => {
    addFriend(card('Kuba', 'aaaaaaaa'));
    addFriend(card('Kuba', 'bbbbbbbb'));
    expect(friends()).toHaveLength(2);
    // A newer link from the first Kuba updates his row, not the other's.
    addFriend({ ...card('Kuba', 'aaaaaaaa', '2026-10-07'), r: 99 });
    expect(friends().map((c) => [c.i, c.r])).toEqual([
      ['aaaaaaaa', 99],
      ['bbbbbbbb', 90],
    ]);
    removeFriend(card('Kuba', 'bbbbbbbb'));
    expect(friends().map((c) => c.i)).toEqual(['aaaaaaaa']);
  });

  it('never adds your own link as a friend, even after a rename', () => {
    setMyName('Ola');
    const mine = myCard('2026-10-06');
    expect(mine.i).toBe(myId());
    setMyName('Ola K.');
    expect(isMine(mine)).toBe(true);
    expect(isMine(card('Ola', 'zzzzzzzz'))).toBe(false);
  });

  it('still reads links from before ids, matching them by nickname', () => {
    addFriend(card('Ania', undefined));
    addFriend({ ...card('ania', undefined, '2026-10-07'), r: 70 });
    expect(friends()).toHaveLength(1);
    expect(friends()[0].r).toBe(70);
  });

  it('round-trips a card and drops a malformed id', () => {
    const c = card('Zoë', 'abc12345');
    expect(decodeCard(encodeCard(c))).toEqual(c);
    expect(decodeCard(encodeCard({ ...c, i: '<script>' }))?.i).toBeUndefined();
    expect(decodeCard('not-a-code')).toBeNull();
  });
});
