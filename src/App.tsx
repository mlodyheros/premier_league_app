import type { FunctionComponent } from 'preact';
import { useEffect } from 'preact/hooks';
import { BottomNav } from './components/BottomNav';
import { Header } from './components/Header';
import { Onboarding } from './components/Onboarding';
import { Toasts } from './components/Toast';
import { dataset, loadDataset, loadError } from './data/store';
import { BeatModel } from './games/beat-model/BeatModel';
import { BudgetXI } from './games/budget/BudgetXI';
import { GuessGame } from './games/guess/GuessGame';
import { HigherLower } from './games/higher-lower/HigherLower';
import { PriceTag } from './games/price-tag/PriceTag';
import { Road38 } from './games/road38/Road38';
import { lang, t, type Key } from './i18n';
import { trackPage } from './lib/analytics';
import { formatDate } from './lib/format';
import { Home } from './pages/Home';
import { HowItWorks } from './pages/HowItWorks';
import { Players } from './pages/Players';
import { route } from './router';

const PAGES: Record<string, { page: FunctionComponent; title?: Key }> = {
  '': { page: Home },
  guess: { page: GuessGame, title: 'game.guess.title' },
  road100: { page: Road38, title: 'game.road.title' },
  // Old links from when the game was Road to 38-0.
  road38: { page: Road38, title: 'game.road.title' },
  'higher-lower': { page: HigherLower, title: 'game.hl.title' },
  budget: { page: BudgetXI, title: 'game.budget.title' },
  'beat-model': { page: BeatModel, title: 'game.beat.title' },
  'price-tag': { page: PriceTag, title: 'game.price.title' },
  how: { page: HowItWorks, title: 'how.title' },
  stats: { page: Players, title: 'players.title' },
};

export function App() {
  const entry = PAGES[route.value] ?? PAGES[''];
  const Page = entry.page;

  useEffect(() => trackPage(route.value), [route.value]);

  useEffect(() => {
    document.title = entry.title ? t('title.page', { page: t(entry.title) }) : t('title.home');
  }, [entry, lang.value]);

  return (
    <>
      <Header />
      <main class="main">
        {loadError.value ? (
          <div class="error-card" role="alert">
            <span class="error-card__icon" aria-hidden="true">
              ⚠️
            </span>
            <h2>{t('app.errorTitle')}</h2>
            <p>{t('app.loadError', { error: loadError.value })}</p>
            <button class="btn btn--primary" onClick={() => loadDataset()}>
              {t('app.retry')}
            </button>
          </div>
        ) : dataset.value ? (
          // Keyed on the route so a game remounts (and re-reads its saved state) on each visit,
          // and the page animates in.
          <div class="page" key={route.value}>
            <Page />
          </div>
        ) : (
          <div class="skeleton" aria-busy="true" aria-label={t('app.loading')}>
            <span class="skeleton__line skeleton__line--title" />
            <span class="skeleton__line" />
            <span class="skeleton__line skeleton__line--short" />
            <div class="skeleton__cards">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </main>
      {dataset.value && <BottomNav />}
      {dataset.value && <Onboarding />}
      <Toasts />
      {dataset.value && (
        <footer class="site-footer">
          <p>{t('app.footer', { date: formatDate(dataset.value.meta.dataDate) })}</p>
        </footer>
      )}
    </>
  );
}
