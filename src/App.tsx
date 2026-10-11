import type { FunctionComponent } from 'preact';
import { Icon } from './components/Icon';
import { useEffect } from 'preact/hooks';
import { BottomNav } from './components/BottomNav';
import { Header } from './components/Header';
import { Onboarding } from './components/Onboarding';
import { ShareSheet } from './components/ShareSheet';
import { UpdateBanner } from './components/UpdateBanner';
import { Toasts } from './components/Toast';
import { dataset, loadDataset, loadError } from './data/store';
import { BeatModel } from './games/beat-model/BeatModel';
import { BudgetXI } from './games/budget/BudgetXI';
import { GuessGame } from './games/guess/GuessGame';
import { HigherLower } from './games/higher-lower/HigherLower';
import { PriceTag } from './games/price-tag/PriceTag';
import { Road38 } from './games/road38/Road38';
import { TransferWindow } from './games/transfer/TransferWindow';
import { lang, t, type Key } from './i18n';
import { trackPage } from './lib/analytics';
import { formatDate } from './lib/format';
import { Home } from './pages/Home';
import { HowItWorks } from './pages/HowItWorks';
import { Players } from './pages/Players';
import { Market } from './pages/Market';
import { League } from './pages/League';
import { About, reportUrl } from './pages/About';
import { PlayerProfile } from './pages/PlayerProfile';
import { playerBySlug } from './lib/playerUrl';
import { href, route } from './router';

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
  transfer: { page: TransferWindow, title: 'game.transfer.title' },
  how: { page: HowItWorks, title: 'how.title' },
  stats: { page: Players, title: 'players.title' },
  market: { page: Market, title: 'market.title' },
  league: { page: League, title: 'league.title' },
  about: { page: About, title: 'about.title' },
};

const PLAYER = 'player/';

export function App() {
  const slug = route.value.startsWith(PLAYER) ? route.value.slice(PLAYER.length) : null;
  const entry = slug === null ? (PAGES[route.value] ?? PAGES['']) : null;
  const Page = entry?.page;
  const name = slug !== null && dataset.value ? playerBySlug(dataset.value.players, slug)?.name : undefined;

  // Every player profile counts as one page, not five hundred.
  useEffect(() => trackPage(slug === null ? route.value : 'player'), [route.value]);

  useEffect(() => {
    const page = name ?? (entry?.title ? t(entry.title) : null);
    document.title = page ? t('title.page', { page }) : t('title.home');
  }, [entry, name, lang.value]);

  return (
    <>
      <Header />
      <main class="main">
        {loadError.value ? (
          <div class="error-card" role="alert">
            <span class="error-card__icon">
              <Icon name="alert-triangle" size={40} />
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
            {Page ? <Page /> : <PlayerProfile slug={slug!} />}
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
      {dataset.value && <ShareSheet />}
      <UpdateBanner />
      <Toasts />
      {dataset.value && (
        <footer class="site-footer">
          <p>{t('app.footer', { date: formatDate(dataset.value.meta.dataDate) })}</p>
          <p class="site-footer__links">
            <a href={href('about')}>{t('about.title')}</a>
            <a href={reportUrl()} target="_blank" rel="noopener noreferrer">
              {t('about.report')}
            </a>
          </p>
        </footer>
      )}
    </>
  );
}
