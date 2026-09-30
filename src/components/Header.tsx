import { href, route } from '../router';
import { ValueToggle } from './ValueToggle';

export function Header() {
  return (
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href={href('')} aria-label="PL Games home">
          <span class="brand__ball" aria-hidden="true">●</span>
          <span>PL<b>Games</b></span>
        </a>
        <nav class="site-nav" aria-label="Main">
          <a href={href('')} aria-current={route.value === '' ? 'page' : undefined}>
            Games
          </a>
          <a href={href('how')} aria-current={route.value === 'how' ? 'page' : undefined}>
            How it works
          </a>
        </nav>
        <ValueToggle />
      </div>
    </header>
  );
}
