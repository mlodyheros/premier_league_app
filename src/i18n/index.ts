/**
 * Translations. `en` is the reference dictionary; `pl` is typed against it, so
 * a missing Polish string is a compile error, not a blank on the page.
 *
 * Entries are strings with {placeholders}, or plural forms picked with
 * Intl.PluralRules from the `count` parameter (Polish needs one/few/many).
 */
import type { ComponentChildren } from 'preact';
import { effect, signal } from '@preact/signals';
import { readJson, writeJson } from '../lib/storage';
import { en } from './en';
import { pl } from './pl';

export type Lang = 'en' | 'pl';
export const LANGS: { key: Lang; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'pl', label: 'Polski' },
];

export type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Entry = string | Plural;
export type Key = keyof typeof en;
export type Dictionary = Record<Key, Entry>;

const DICTS: Record<Lang, Dictionary> = { en, pl };

function detect(): Lang {
  const saved = readJson<Lang>('lang');
  if (saved === 'en' || saved === 'pl') return saved;
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

export const lang = signal<Lang>(detect());

effect(() => {
  writeJson('lang', lang.value);
  if (typeof document !== 'undefined') document.documentElement.lang = lang.value;
});

function template(key: Key, count: unknown, l: Lang): string {
  const entry = DICTS[l][key] ?? en[key];
  if (typeof entry === 'string') return entry;
  const rule = new Intl.PluralRules(l).select(Number(count ?? 0));
  return entry[rule] ?? entry.other;
}

/** A translated string with {placeholders} filled in. */
export function t(key: Key, params: Record<string, string | number> = {}, l: Lang = lang.value): string {
  return template(key, params.count, l).replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** Like t(), but placeholders may be elements (bold text, links). */
export function tj(key: Key, params: Record<string, ComponentChildren> = {}): ComponentChildren[] {
  const parts = template(key, params.count, lang.value).split(/(\{\w+\})/);
  return parts.map((part) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return m && m[1] in params ? params[m[1]] : part;
  });
}
