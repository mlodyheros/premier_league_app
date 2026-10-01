import { signal } from '@preact/signals';
import { t } from '../i18n';

interface ToastMsg {
  id: number;
  text: string;
}

const toasts = signal<ToastMsg[]>([]);
let next = 0;

/** A short message at the bottom of the screen, gone after a moment. */
export function toast(text: string, ms = 2200): void {
  const id = ++next;
  toasts.value = [...toasts.value, { id, text }];
  setTimeout(() => (toasts.value = toasts.value.filter((m) => m.id !== id)), ms);
}

/** Feedback for a shareText() result. */
export function notifyShare(result: 'shared' | 'copied' | 'downloaded' | 'failed'): void {
  if (result === 'shared') return; // the system sheet was feedback enough
  toast(t(result === 'copied' ? 'share.copied' : result === 'downloaded' ? 'share.downloaded' : 'share.failed'));
}

export function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((m) => (
        <p class="toast" key={m.id}>
          {m.text}
        </p>
      ))}
    </div>
  );
}
