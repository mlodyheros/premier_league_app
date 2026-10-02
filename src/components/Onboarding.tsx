import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon, type IconName } from './Icon';
import { t, tj, type Key } from '../i18n';
import { readJson, writeJson } from '../lib/storage';
import { ValueToggle } from './ValueToggle';

const STEPS: { icon: IconName; title: Key; body: Key }[] = [
  { icon: 'ball-football', title: 'onboard.1.title', body: 'onboard.1.body' },
  { icon: 'coins', title: 'onboard.2.title', body: 'onboard.2.body' },
];

/** Two short screens on the first visit: what the games are, and the two prices. */
export function Onboarding() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const [show] = useState(() => !readJson<boolean>('onboarded'));

  useEffect(() => {
    if (show) dialog.current?.showModal();
  }, []);

  if (!show) return null;

  function close() {
    writeJson('onboarded', true);
    dialog.current?.close();
  }

  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <dialog ref={dialog} class="settings onboard" aria-labelledby="onboard-title" onClose={() => writeJson('onboarded', true)}>
      <div class="settings__inner">
        <span class="onboard__icon" aria-hidden="true">
          <Icon name={s.icon} size={40} />
        </span>
        <h2 id="onboard-title">{t(s.title)}</h2>
        <p class="onboard__body">{tj(s.body, { b: <b>{t('onboard.daily')}</b> })}</p>
        {step === 1 && <ValueToggle />}
        <ol class="onboard__dots" aria-label={t('onboard.step', { n: step + 1, total: STEPS.length })}>
          {STEPS.map((_, i) => (
            <li class={i === step ? 'on' : ''} />
          ))}
        </ol>
        <div class="onboard__actions">
          <button class="btn btn--ghost" onClick={close}>
            {t('onboard.skip')}
          </button>
          <button class="btn btn--primary" onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? t('onboard.start') : t('onboard.next')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
