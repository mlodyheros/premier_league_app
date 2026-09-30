import type { FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import { Header } from './components/Header';
import { dataset, loadError } from './data/store';
import { BeatModel } from './games/beat-model/BeatModel';
import { BudgetXI } from './games/budget/BudgetXI';
import { GuessGame } from './games/guess/GuessGame';
import { HigherLower } from './games/higher-lower/HigherLower';
import { PriceTag } from './games/price-tag/PriceTag';
import { Road38 } from './games/road38/Road38';
import { lang, t, type Key } from './i18n';
import { formatDate } from './lib/format';
import { Home } from './pages/Home';
import { HowItWorks } from './pages/HowItWorks';
import { route } from './router';

const PAGES: Record<string, { page: FunctionComponent; title?: Key }> = {
  '': { page: Home },
  guess: { page: GuessGame, title: 'game.guess.title' },
  road38: { page: Road38, title: 'game.road.title' },
  'higher-lower': { page: HigherLower, title: 'game.hl.title' },
  budget: { page: BudgetXI, title: 'game.budget.title' },
  'beat-model': { page: BeatModel, title: 'game.beat.title' },
  'price-tag': { page: PriceTag, title: 'game.price.title' },
  how: { page: HowItWorks, title: 'how.title' },
};

export function App() {
  const entry = PAGES[route.value] ?? PAGES[''];
  const Page = entry.page;

  useEffect(() => {
    document.title = entry.title ? t('title.page', { page: t(entry.title) }) : t('title.home');
  }, [entry, lang.value]);

  return (
    <>
      <Header />
      <main class="main">
        {loadError.value ? (
          <p class="notice">{t('app.loadError', { error: loadError.value })}</p>
        ) : dataset.value ? (
          // Keyed on the route so a game remounts (and re-reads its saved state) on each visit.
          <Page key={route.value} />
        ) : (
          <p class="notice" aria-busy="true">
            {t('app.loading')}
          </p>
        )}
      </main>
      {dataset.value && (
        <footer class="site-footer">
          <p>{t('app.footer', { date: formatDate(dataset.value.meta.dataDate) })}</p>
        </footer>
      )}
    </>
  );
}
