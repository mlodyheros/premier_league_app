import { t } from '../i18n';
import { updateReady } from '../lib/update';
import { Icon } from './Icon';

/** "A new version is out": one tap reloads; every game keeps its progress in storage. */
export function UpdateBanner() {
  if (!updateReady.value) return null;
  return (
    <div class="update-banner" role="status">
      <Icon name="refresh" size={18} />
      <span>{t('update.ready')}</span>
      <button class="btn btn--primary btn--sm" onClick={() => location.reload()}>
        {t('update.reload')}
      </button>
      <button class="update-banner__close" onClick={() => (updateReady.value = false)} aria-label={t('common.close')}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
