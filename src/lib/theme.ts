/** The site's colours: the default night palette, or the Premier League's own. */
import { effect, signal } from '@preact/signals';
import { readJson, writeJson } from './storage';

export type Theme = 'night' | 'pl';
export const THEMES: Theme[] = ['night', 'pl'];

/** The browser bar's colour per theme (meta theme-color). */
const BAR: Record<Theme, string> = { night: '#1a0b24', pl: '#37003c' };

export const theme = signal<Theme>(readJson<Theme>('theme') === 'pl' ? 'pl' : 'night');

effect(() => {
  const t = theme.value;
  writeJson('theme', t);
  if (t === 'night') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[t]);
});
