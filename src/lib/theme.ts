/** The site's colours: the default night palette, the Premier League's own, or a light one. */
import { effect, signal } from '@preact/signals';
import { readJson, writeJson } from './storage';

export type Theme = 'night' | 'pl' | 'light';
export const THEMES: Theme[] = ['night', 'pl', 'light'];

/** The browser bar's colour per theme (meta theme-color). */
const BAR: Record<Theme, string> = { night: '#1a0b24', pl: '#37003c', light: '#f4f7fb' };

const saved = readJson<Theme>('theme');
export const theme = signal<Theme>(saved && THEMES.includes(saved) ? saved : 'night');

effect(() => {
  const t = theme.value;
  writeJson('theme', t);
  if (t === 'night') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[t]);
});
