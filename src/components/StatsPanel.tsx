import { t } from '../i18n';
import type { GameStats } from '../lib/stats';

/** Played / win % / streaks, and the guess distribution as bars. */
export function StatsPanel({ stats, highlight }: { stats: GameStats; highlight?: number }) {
  const winPct = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  const most = Math.max(1, ...stats.distribution);
  return (
    <div class="stats">
      <dl class="stats__tiles">
        <div><dt>{t('stats.played')}</dt><dd>{stats.played}</dd></div>
        <div><dt>{t('stats.winPct')}</dt><dd>{winPct}%</dd></div>
        <div><dt>{t('stats.streak')}</dt><dd>{stats.streak}</dd></div>
        <div><dt>{t('stats.best')}</dt><dd>{stats.bestStreak}</dd></div>
      </dl>
      <ol class="stats__dist" aria-label={t('stats.dist')}>
        {stats.distribution.map((n, i) => (
          <li>
            <span class="stats__n">{i + 1}</span>
            <span
              class={`stats__bar ${highlight === i + 1 ? 'hl' : ''}`}
              style={{ width: `${Math.max(8, (n / most) * 100)}%` }}
            >
              {n}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
