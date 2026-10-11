/**
 * Is there a newer build than the one running? Each build's script has a
 * content hash in its name (assets/index-AbC123.js); the published index.html
 * names the current one. When they differ, the page is out of date.
 */
import { signal } from '@preact/signals';

export const updateReady = signal(false);

const CHECK_EVERY = 15 * 60_000;

function runningScript(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]');
  return el ? new URL(el.src).pathname.split('/').pop() ?? null : null;
}

async function check(): Promise<void> {
  if (updateReady.value || document.hidden) return;
  const mine = runningScript();
  if (!mine) return;
  try {
    const res = await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const live = /assets\/(index-[\w-]+\.js)/.exec(await res.text())?.[1];
    if (live && live !== mine) updateReady.value = true;
  } catch {
    /* offline: try again later */
  }
}

/** Start watching for new builds (production only: dev has no hashed script). */
export function watchForUpdates(): void {
  if (!import.meta.env.PROD) return;
  setInterval(check, CHECK_EVERY);
  document.addEventListener('visibilitychange', () => void check());
}
