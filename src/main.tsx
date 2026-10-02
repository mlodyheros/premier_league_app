import { render } from 'preact';
import '@fontsource-variable/inter';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles/main.css';
import { App } from './App';
import { loadDataset } from './data/store';
import { todayKey } from './lib/rng';

loadDataset();
render(<App />, document.getElementById('app')!);

/*
 * A new day while the page is open (a phone keeps a tab, or the installed app,
 * alive for days): reload, so the daily rounds, the countdowns and the data
 * are today's. Every game keeps its progress in storage, so nothing is lost.
 */
const bootDay = todayKey();
function checkDay() {
  if (!document.hidden && todayKey() !== bootDay) location.reload();
}
document.addEventListener('visibilitychange', checkDay);
setInterval(checkDay, 60_000);

// Offline play and "Add to Home Screen". Only in the build: in development the
// cache would serve stale modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* no offline support; the site still works */
    });
  });
}
