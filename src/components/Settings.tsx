import { useRef, useState } from 'preact/hooks';
import { valueSource, type ValueSource } from '../data/valueSource';
import { lang, LANGS, t } from '../i18n';
import { analyticsAvailable, analyticsEnabled } from '../lib/analytics';
import { clearProgress } from '../lib/storage';

/** The gear button and its dialog: language, value source, and resetting progress. */
export function Settings() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [done, setDone] = useState(false);

  function open() {
    setDone(false);
    dialog.current?.showModal();
  }

  function reset() {
    if (window.confirm(t('settings.resetConfirm'))) {
      clearProgress();
      setDone(true);
      // Games read their saved state when they mount; reload so none shows stale progress.
      setTimeout(() => location.reload(), 900);
    }
  }

  return (
    <>
      <button type="button" class="icon-btn" onClick={open} aria-label={t('settings.open')} title={t('settings.open')}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7.3 7.3 0 0 0-1.7-1L14.5 2.8a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5a7.3 7.3 0 0 0-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.7 8.8a.5.5 0 0 0 .1.6L4.8 11a7.7 7.7 0 0 0 0 2l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3c.1.2.4.3.6.2l2.4-1c.5.4 1.1.7 1.7 1l.4 2.5c0 .2.2.4.5.4h3.8c.3 0 .5-.2.5-.4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.4 1c.2.1.5 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6L19.4 13ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
          />
        </svg>
      </button>

      <dialog
        ref={dialog}
        class="settings"
        aria-labelledby="settings-title"
        onClick={(e) => {
          // A click on the backdrop (the dialog element itself) closes it.
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div class="settings__inner">
          <div class="settings__head">
            <h2 id="settings-title">{t('settings.title')}</h2>
            <button type="button" class="icon-btn" onClick={() => dialog.current?.close()} aria-label={t('settings.close')}>
              ✕
            </button>
          </div>

          <fieldset>
            <legend>{t('settings.language')}</legend>
            <div class="seg">
              {LANGS.map((l) => (
                <label class={lang.value === l.key ? 'on' : ''}>
                  <input
                    type="radio"
                    name="lang"
                    value={l.key}
                    checked={lang.value === l.key}
                    onChange={() => (lang.value = l.key)}
                  />
                  <span lang={l.key}>{l.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>{t('settings.values')}</legend>
            <div class="seg">
              {(['tm', 'model'] as ValueSource[]).map((s) => (
                <label class={valueSource.value === s ? 'on' : ''}>
                  <input
                    type="radio"
                    name="source"
                    value={s}
                    checked={valueSource.value === s}
                    onChange={() => (valueSource.value = s)}
                  />
                  <span>{t(s === 'tm' ? 'settings.valueTm' : 'settings.valueModel')}</span>
                </label>
              ))}
            </div>
            <p class="settings__help">{t('settings.valuesHelp')}</p>
          </fieldset>

          <fieldset>
            <legend>{t('settings.data')}</legend>
            <p class="settings__help">{t('settings.dataHelp')}</p>
            {analyticsAvailable && (
              <label class="check">
                <input
                  type="checkbox"
                  checked={analyticsEnabled.value}
                  onChange={(e) => (analyticsEnabled.value = (e.target as HTMLInputElement).checked)}
                />
                {t('settings.analytics')}
              </label>
            )}
            <button type="button" class="btn btn--ghost btn--danger" onClick={reset}>
              {t('settings.reset')}
            </button>
            {done && (
              <p class="settings__help" role="status">
                {t('settings.resetDone')}
              </p>
            )}
          </fieldset>
        </div>
      </dialog>
    </>
  );
}
