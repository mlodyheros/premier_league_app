import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { trackEvent } from '../lib/analytics';
import { renderCard, type CardFormat, type CardSpec } from '../lib/shareCard';
import { shareText } from '../lib/share';
import { readJson, writeJson } from '../lib/storage';
import { Chips } from './Chips';
import { Icon } from './Icon';
import { notifyShare, toast } from './Toast';

interface Request {
  spec: CardSpec;
  /** The result as text, for chats and for "copy". */
  text: string;
  /** File name without the extension. */
  file: string;
}

const request = signal<Request | null>(null);

/** Open the share sheet: a picture of the result, and its text. */
export function openShare(spec: CardSpec, text: string, file: string): void {
  request.value = { spec, text, file };
}

const FORMATS: CardFormat[] = ['story', 'square'];

/** One sheet for every game: pick story or post, then share, save or copy. */
export function ShareSheet() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<CardFormat>(() => readJson<CardFormat>('shareFormat') ?? 'story');
  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null);
  const req = request.value;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (req && !d.open) d.showModal();
    if (!req && d.open) d.close();
  }, [req]);

  useEffect(() => {
    if (!req) return;
    let cancelled = false;
    setImage(null);
    renderCard(req.spec, format).then((blob) => {
      if (!cancelled && blob) setImage({ url: URL.createObjectURL(blob), blob });
    });
    return () => {
      cancelled = true;
    };
  }, [req, format]);

  useEffect(() => () => image && URL.revokeObjectURL(image.url), [image]);

  function chooseFormat(f: CardFormat) {
    setFormat(f);
    writeJson('shareFormat', f);
  }

  const file = image && req ? new File([image.blob], `${req.file}-${format}.png`, { type: 'image/png' }) : null;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const canShareFile = !!file && !!nav.canShare?.({ files: [file] });

  async function shareImage() {
    if (!file || !req) return;
    try {
      await navigator.share({ files: [file], text: req.text });
      trackEvent(`share/image/${format}`);
    } catch {
      /* closed the sheet */
    }
  }

  function save() {
    if (!image || !file) return;
    const a = document.createElement('a');
    a.href = image.url;
    a.download = file.name;
    a.click();
    toast(t('share.downloaded'));
    trackEvent(`share/save/${format}`);
  }

  async function copyText() {
    if (!req) return;
    notifyShare(await shareText(req.text));
  }

  return (
    <dialog
      ref={dialog}
      class="settings share-sheet"
      aria-labelledby="share-title"
      onClose={() => (request.value = null)}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close();
      }}
    >
      <div class="settings__inner">
        <div class="settings__head">
          <h2 id="share-title">{t('share.title')}</h2>
          <button type="button" class="icon-btn" onClick={() => dialog.current?.close()} aria-label={t('common.close')}>
            <Icon name="x" />
          </button>
        </div>
        <Chips
          label={t('share.format')}
          options={FORMATS}
          value={format}
          onChange={chooseFormat}
          name={(f) => t(`share.format.${f}`)}
        />
        <div class={`share-sheet__preview share-sheet__preview--${format}`}>
          {image ? <img src={image.url} alt={t('share.preview')} /> : <span class="share-sheet__loading" aria-busy="true" />}
        </div>
        <div class="share-sheet__actions">
          {canShareFile && (
            <button class="btn btn--primary" onClick={shareImage}>
              <Icon name="share" size={18} /> {t('share.image')}
            </button>
          )}
          <button class={`btn ${canShareFile ? '' : 'btn--primary'}`} onClick={save} disabled={!image}>
            <Icon name="download" size={18} /> {t('share.save')}
          </button>
          <button class="btn btn--ghost" onClick={copyText}>
            <Icon name="copy" size={18} /> {t('share.copy')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
