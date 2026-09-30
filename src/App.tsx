import type { FunctionComponent } from 'preact';
import { Header } from './components/Header';
import { dataset, loadError } from './data/store';
import { GuessGame } from './games/guess/GuessGame';
import { Home } from './pages/Home';
import { HowItWorks } from './pages/HowItWorks';
import { route } from './router';

const PAGES: Record<string, FunctionComponent> = {
  '': Home,
  guess: GuessGame,
  how: HowItWorks,
};

export function App() {
  const Page = PAGES[route.value] ?? Home;
  return (
    <>
      <Header />
      <main class="main">
        {loadError.value ? (
          <p class="notice">Couldn't load the player data ({loadError.value}). Try reloading.</p>
        ) : dataset.value ? (
          <Page />
        ) : (
          <p class="notice" aria-busy="true">Loading squads…</p>
        )}
      </main>
      {dataset.value && (
        <footer class="site-footer">
          <p>
            Values: Transfermarkt and the pl-value model, data from {dataset.value.meta.dataDate}. An
            unofficial fan project, not affiliated with the Premier League, its clubs or Transfermarkt.
          </p>
        </footer>
      )}
    </>
  );
}
