import { valueSource, type ValueSource } from '../data/valueSource';
import { t } from '../i18n';

const OPTIONS = [
  { key: 'tm' as ValueSource, label: () => t('toggle.tm'), title: () => t('toggle.tmTitle') },
  { key: 'model' as ValueSource, label: () => t('toggle.model'), title: () => t('toggle.modelTitle') },
];

/** The global value-source switch. Every game reads valueSource. */
export function ValueToggle() {
  return (
    <div class="value-toggle" role="radiogroup" aria-label={t('toggle.label')}>
      {OPTIONS.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={valueSource.value === o.key}
          title={o.title()}
          class={valueSource.value === o.key ? 'on' : ''}
          onClick={() => (valueSource.value = o.key)}
        >
          {o.label()}
        </button>
      ))}
    </div>
  );
}
