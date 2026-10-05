import type { ComponentChildren } from 'preact';
import { t } from '../i18n';
import { href } from '../router';
import { Icon, type IconName } from './Icon';

export interface Spot {
  /** Where on the pitch, percent from the left and from the top (attack at the top). */
  x: number;
  y: number;
  path: string;
  icon: IconName;
  title: string;
  /** One line under the title: today's result, a best, a count. */
  note?: ComponentChildren;
  /** A daily round still to play, or one done today. */
  state?: 'todo' | 'done';
  keeper?: boolean;
  /** Card width, percent of the pitch: wider in the rows of three. */
  w?: number;
}

/**
 * The home page as a team sheet: every game and page a player on a 4-3-3,
 * today's three daily rounds up front, the player's own profile in goal.
 */
export function GamesFormation({ spots, label }: { spots: Spot[]; label: string }) {
  return (
    <nav class="formation" aria-label={label}>
      <div class="formation__pitch" aria-hidden="true">
        <span class="formation__touch" />
        <span class="formation__half" />
        <span class="formation__circle" />
        <span class="formation__box formation__box--top" />
        <span class="formation__box formation__box--bottom" />
      </div>
      <span class="formation__line formation__line--attack">{t('home.line.attack')}</span>
      <ul>
        {spots.map((s, i) => (
          <li style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w ?? 23}%`, '--i': spots.length - 1 - i }}>
            <a
              class={`spot ${s.keeper ? 'spot--keeper' : ''} ${s.state ? `spot--${s.state}` : ''}`}
              href={href(s.path)}
            >
              <span class="spot__badge">
                <Icon name={s.icon} size={22} />
              </span>
              <span class="spot__title">{s.title}</span>
              {s.note && <span class="spot__note">{s.note}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
