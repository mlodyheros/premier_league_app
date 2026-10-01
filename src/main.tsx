import { render } from 'preact';
import '@fontsource-variable/inter';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles/main.css';
import { App } from './App';
import { loadDataset } from './data/store';

loadDataset();
render(<App />, document.getElementById('app')!);

// Offline play and "Add to Home Screen". Only in the build: in development the
// cache would serve stale modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* no offline support; the site still works */
    });
  });
}
