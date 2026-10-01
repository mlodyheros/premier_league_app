import { t } from '../i18n';
import { href, route } from '../router';
import { Settings } from './Settings';
import { ValueToggle } from './ValueToggle';

export function Header() {
  return (
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href={href('')} aria-label={t('nav.home')}>
          <span class="brand__ball" aria-hidden="true">●</span>
          <span>PL<b>Games</b></span>
        </a>
        <nav class="site-nav" aria-label={t('nav.main')}>
          <a href={href('')} aria-current={route.value === '' ? 'page' : undefined}>
            {t('nav.games')}
          </a>
          <a href={href('league')} aria-current={route.value === 'league' ? 'page' : undefined}>
            {t('nav.league')}
          </a>
          <a href={href('market')} aria-current={route.value === 'market' ? 'page' : undefined}>
            {t('nav.market')}
          </a>
          <a href={href('stats')} aria-current={route.value === 'stats' ? 'page' : undefined}>
            {t('nav.players')}
          </a>
          <a href={href('how')} aria-current={route.value === 'how' ? 'page' : undefined}>
            {t('nav.how')}
          </a>
        </nav>
        <div class="site-header__tools">
          <ValueToggle />
          <Settings />
        </div>
      </div>
    </header>
  );
}
