import { t } from '../i18n';
import { poolLevel } from '../lib/pools';
import { settingsOpen } from './Settings';

/** "Level: Normal · Change": which players a free-play round draws from. */
export function PoolNote() {
  return (
    <p class="pool-note">
      <span>
        {t('pool.label')}: <b>{t(`pool.${poolLevel.value}`)}</b>
      </span>
      <button type="button" class="link-btn" onClick={() => (settingsOpen.value = true)}>
        {t('pool.change')}
      </button>
    </p>
  );
}
