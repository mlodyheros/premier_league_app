/**
 * A result as a picture: a square card drawn on a canvas, shared as a PNG
 * through the share sheet where files can be shared, downloaded elsewhere.
 */
export type Cell = 'good' | 'mid' | 'bad' | 'none';

export interface ResultCard {
  /** Small line at the top: the game and the day. */
  kicker: string;
  /** The headline number or verdict: "102 pts", "3/8". */
  big: string;
  /** A line under it: record, position, the player's name. */
  sub?: string;
  /** Rows of coloured squares: results, guesses. */
  rows?: Cell[][];
  /** Name for the downloaded file, without the extension. */
  file: string;
}

const SIZE = 1080;
const COLORS: Record<Cell, string> = { good: '#00ff85', mid: '#ffc53d', bad: '#ff2882', none: '#3b2547' };

export async function drawCard(card: ResultCard): Promise<Blob | null> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, '#2a0f38');
  bg.addColorStop(1, '#12061a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Brand bar along the bottom, as on the icon.
  ctx.fillStyle = COLORS.good;
  ctx.fillRect(0, SIZE - 18, SIZE * 0.7, 18);
  ctx.fillStyle = COLORS.bad;
  ctx.fillRect(SIZE * 0.7, SIZE - 18, SIZE * 0.3, 18);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#b9a7c4';
  ctx.font = '600 44px "Inter Variable", Inter, system-ui, sans-serif';
  ctx.fillText(card.kicker.toUpperCase(), SIZE / 2, 150);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 230px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.fillText(card.big, SIZE / 2, 400);

  if (card.sub) {
    ctx.fillStyle = '#e9def0';
    ctx.font = '600 52px "Inter Variable", Inter, system-ui, sans-serif';
    ctx.fillText(card.sub, SIZE / 2, 500, SIZE - 120);
  }

  const rows = card.rows ?? [];
  if (rows.length) {
    const cols = Math.max(...rows.map((r) => r.length));
    const gap = cols > 10 ? 8 : 14;
    const cell = Math.min(90, (SIZE - 160 - gap * (cols - 1)) / cols);
    const height = rows.length * cell + (rows.length - 1) * gap;
    const top = 580 + (380 - height) / 2;
    rows.forEach((row, y) => {
      const width = row.length * cell + (row.length - 1) * gap;
      const left = (SIZE - width) / 2;
      row.forEach((c, x) => {
        ctx.fillStyle = COLORS[c];
        ctx.beginPath();
        ctx.roundRect(left + x * (cell + gap), top + y * (cell + gap), cell, cell, cell * 0.18);
        ctx.fill();
      });
    });
  }

  ctx.fillStyle = '#b9a7c4';
  ctx.font = '600 38px "Inter Variable", Inter, system-ui, sans-serif';
  ctx.fillText(location.host + location.pathname.replace(/\/$/, ''), SIZE / 2, SIZE - 60);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function shareImage(card: ResultCard): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = await drawCard(card);
  if (!blob) return 'failed';
  const file = new File([blob], `${card.file}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'failed';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
