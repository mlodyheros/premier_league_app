import type { ComponentChildren } from 'preact';
import { GAME_LIST, gameMeta, type GameId } from '../games/meta';
import { t } from '../i18n';
import { href } from '../router';

/**
 * Every game's top: a way back, the icon and title, the score, a one-line
 * pitch, and the full rules folded away so the game itself comes first.
 */
export function GameHeader({
  game,
  score,
  tabs,
  children,
}: {
  game: GameId;
  /** The score bug (or anything to the right of the title). */
  score?: ComponentChildren;
  /** Mode tabs, shown under the title. */
  tabs?: ComponentChildren;
  /** The rules, folded under "How to play". */
  children?: ComponentChildren;
}) {
  const meta = gameMeta(game);
  return (
    <header class="game-head">
      <a class="game-head__back" href={href('')}>
        ← {t('nav.games')}
      </a>
      <div class="game-head__row">
        <span class="game-head__icon" aria-hidden="true">
          {meta.icon}
        </span>
        <div class="game-head__title">
          <h1>{t(`game.${game}.title`)}</h1>
          <p class="game-head__pitch">{t(`game.${game}.blurb`)}</p>
        </div>
        {score}
      </div>
      {tabs && <div class="game-head__tabs">{tabs}</div>}
      {children && (
        <details class="rules">
          <summary>{t('game.howToPlay')}</summary>
          <div class="rules__body">{children}</div>
        </details>
      )}
    </header>
  );
}

/** "Other games" at the bottom of a game: one tap to the next one. */
export function OtherGames({ current }: { current: GameId }) {
  return (
    <nav class="other-games" aria-label={t('game.otherGames')}>
      <p>{t('game.otherGames')}</p>
      <ul>
        {GAME_LIST.filter((g) => g.id !== current).map((g) => (
          <li>
            <a href={href(g.path)}>
              <span aria-hidden="true">{g.icon}</span> {t(`game.${g.id}.title`)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
