import { t } from '../i18n';
import { rovingKeys } from '../lib/a11y';
import type { Mode } from '../lib/daily';
import { dayNumber } from '../lib/rng';

/** "Daily #N | Practice" tabs used by the games with a daily round. */
export function ModeTabs({ mode, day, onChange }: { mode: Mode; day: string; onChange: (m: Mode) => void }) {
  return (
    <div class="tabs" role="tablist" onKeyDown={rovingKeys}>
      <button role="tab" aria-selected={mode === 'daily'} tabIndex={mode === 'daily' ? 0 : -1} onClick={() => onChange('daily')}>
        {t('mode.daily', { n: dayNumber(day) })}
      </button>
      <button
        role="tab"
        aria-selected={mode === 'practice'}
        tabIndex={mode === 'practice' ? 0 : -1}
        onClick={() => onChange('practice')}
      >
        {t('mode.practice')}
      </button>
    </div>
  );
}

/** Shown under a finished daily round. */
export function DailyDone({ countdown, streak }: { countdown: string; streak: number }) {
  return (
    <p class="end__note">
      {t('mode.doneToday')} <b class="mono">{countdown}</b> · {t('mode.streak', { n: streak })}
    </p>
  );
}
