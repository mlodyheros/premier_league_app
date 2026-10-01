/**
 * Privacy-friendly visit counts with GoatCounter: no cookies, no personal data,
 * so no consent banner. Off unless VITE_GOATCOUNTER_CODE is set at build time,
 * off on localhost, off when the browser sends Do Not Track, and off when the
 * player switches it off in Settings.
 *
 * Besides page views it records a few anonymous game events, e.g.
 * "road/arcade/ovr-88/pos-1/w-30", which is how Road to 38-0's difficulty can
 * be tuned on real drafts rather than guesses.
 */
import { effect, signal } from '@preact/signals';
import { readJson, writeJson } from './storage';

interface GoatCounter {
  count: (vars: { path: string; title?: string; event?: boolean }) => void;
}

declare global {
  interface Window {
    goatcounter?: GoatCounter & { no_onload?: boolean; allow_local?: boolean };
  }
}

const CODE: string | undefined = import.meta.env.VITE_GOATCOUNTER_CODE;
const SCRIPT = 'https://gc.zgo.at/count.js';

/** Whether this build has analytics at all. */
export const analyticsAvailable = Boolean(CODE);

/** The player's own choice, remembered; on by default. */
export const analyticsEnabled = signal<boolean>(readJson<boolean>('analytics') ?? true);
effect(() => writeJson('analytics', analyticsEnabled.value));

function allowed(): boolean {
  if (!CODE || !analyticsEnabled.value || typeof window === 'undefined') return false;
  if (navigator.doNotTrack === '1') return false;
  return !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
}

let loading: Promise<void> | null = null;

function load(): Promise<void> {
  if (loading) return loading;
  loading = new Promise((resolve) => {
    // Page views are sent by hand on each route change (hash routing).
    window.goatcounter = { ...(window.goatcounter ?? {}), no_onload: true } as Window['goatcounter'];
    const s = document.createElement('script');
    s.async = true;
    s.src = SCRIPT;
    s.dataset.goatcounter = `https://${CODE}.goatcounter.com/count`;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
  return loading;
}

async function send(vars: { path: string; title?: string; event?: boolean }) {
  if (!allowed()) return;
  await load();
  window.goatcounter?.count?.(vars);
}

/** A page view for a hash route ("" is the home page). */
export function trackPage(route: string): void {
  void send({ path: `/${route}` });
}

/** An anonymous game event, e.g. "guess/daily/won-4". */
export function trackEvent(name: string): void {
  void send({ path: name, event: true });
}
