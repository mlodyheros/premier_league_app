import { useRef } from 'preact/hooks';
import { gameMeta, type GameId } from '../games/meta';
import { t, type Key } from '../i18n';
import { href, route } from '../router';
import { settingsOpen } from './Settings';

/** The four destinations on the bar itself; everything else lives under "More". */
const TABS: { path: string; icon: string; label: Key; match: string[] }[] = [
  { path: '', icon: '🏠', label: 'nav.home2', match: [''] },
  { path: 'guess', icon: gameMeta('guess').icon, label: 'short.guess', match: ['guess'] },
  { path: 'road100', icon: gameMeta('road').icon, label: 'short.road', match: ['road100', 'road38'] },
  { path: 'budget', icon: gameMeta('budget').icon, label: 'short.budget', match: ['budget'] },
];
const MORE_GAMES: GameId[] = ['hl', 'beat', 'price'];

/**
 * A phone's bottom tab bar (at most five tabs, in thumb reach), with a
 * bottom sheet for the rest. Hidden on wider screens, where the header's
 * navigation is enough.
 */
export function BottomNav() {
  const sheet = useRef<HTMLDialogElement>(null);
  const here = route.value;
  const inMore = !TABS.some((tab) => tab.match.includes(here));
  const close = () => sheet.current?.close();

  return (
    <>
      <nav class="bottom-nav" aria-label={t('nav.main')}>
        {TABS.map((tab) => {
          const active = tab.match.includes(here);
          return (
            <a class={`bottom-nav__item ${active ? 'on' : ''}`} href={href(tab.path)} aria-current={active ? 'page' : undefined}>
              <span class="bottom-nav__icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span class="bottom-nav__label">{t(tab.label)}</span>
            </a>
          );
        })}
        <button
          type="button"
          class={`bottom-nav__item ${inMore ? 'on' : ''}`}
          aria-haspopup="dialog"
          onClick={() => sheet.current?.showModal()}
        >
          <span class="bottom-nav__icon" aria-hidden="true">
            ⋯
          </span>
          <span class="bottom-nav__label">{t('nav.more')}</span>
        </button>
      </nav>

      <dialog
        ref={sheet}
        class="sheet"
        aria-label={t('nav.moreTitle')}
        onClick={(e) => {
          if (e.target === sheet.current) close();
        }}
      >
        <div class="sheet__inner">
          <span class="sheet__grip" aria-hidden="true" />
          <ul class="sheet__list">
            {MORE_GAMES.map((id) => {
              const g = gameMeta(id);
              return (
                <li>
                  <a href={href(g.path)} onClick={close} aria-current={here === g.path ? 'page' : undefined}>
                    <span aria-hidden="true">{g.icon}</span>
                    <span>
                      <b>{t(`game.${id}.title`)}</b>
                      <small>{t(`game.${id}.blurb`)}</small>
                    </span>
                  </a>
                </li>
              );
            })}
            <li>
              <a href={href('how')} onClick={close} aria-current={here === 'how' ? 'page' : undefined}>
                <span aria-hidden="true">📘</span>
                <span>
                  <b>{t('nav.how')}</b>
                </span>
              </a>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  settingsOpen.value = true;
                }}
              >
                <span aria-hidden="true">⚙️</span>
                <span>
                  <b>{t('settings.title')}</b>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </dialog>
    </>
  );
}
