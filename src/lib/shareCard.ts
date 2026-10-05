/**
 * Share cards: a game's result as a picture for an Instagram story (9:16) or
 * a post / a chat (1:1). Drawn on a canvas in the site's night palette
 * whatever theme is on, so every card looks the same wherever it is posted.
 */

export type CardFormat = 'story' | 'square';
export type Cell = 'good' | 'mid' | 'bad' | 'none';

export interface CardPlayer {
  /** Position on the pitch, percent from the left and from the top (attack at the top). */
  x: number;
  y: number;
  name: string;
  initials: string;
  colors: [string, string];
  rating?: number;
  goals?: number;
  assists?: number;
}

export interface CardSpec {
  /** "100 PTS Challenge" */
  game: string;
  /** Small line top right: the day, the mode. */
  kicker?: string;
  /** The big number or verdict: "102 PTS", "4/8". */
  headline: string;
  /** A line under it: record and position, a theme. */
  sub?: string;
  badges?: string[];
  /** A crest (URL) beside the headline: the club in Transfer Window. */
  crest?: string;
  /** An XI on a pitch. */
  pitch?: CardPlayer[];
  /** A row of results (38 matches, ten answers). */
  strip?: Cell[];
  /** Rows of coloured tiles (Guess the Player's guesses). */
  grid?: Cell[][];
  /** Labelled scores (Price Tag's five, the home page's three dailies). */
  tiles?: { label: string; value: string; cell: Cell }[];
  /** A challenge at the bottom: "Can you beat it?" */
  cta: string;
  /** The site, shown in the footer. */
  url: string;
}

const C = {
  bgTop: '#2a0f38',
  bgBottom: '#12061a',
  text: '#ffffff',
  soft: '#e9def0',
  muted: '#b9a7c4',
  green: '#00ff85',
  pink: '#ff2882',
  cyan: '#04f5ff',
  amber: '#ffc53d',
  panel: 'rgba(255,255,255,0.06)',
  line: 'rgba(255,255,255,0.22)',
  pitchA: '#0f5c34',
  pitchB: '#0d5530',
};
const CELL: Record<Cell, string> = { good: C.green, mid: C.amber, bad: C.pink, none: '#3b2547' };
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
const BODY = '"Inter Variable", Inter, system-ui, sans-serif';

const SIZE: Record<CardFormat, [number, number]> = { story: [1080, 1920], square: [1080, 1080] };

type Ctx = CanvasRenderingContext2D;

async function fontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`700 100px ${DISPLAY}`),
      document.fonts.load(`600 40px ${BODY}`),
      document.fonts.load(`700 40px ${BODY}`),
    ]);
    await document.fonts.ready;
  } catch {
    /* system fonts then */
  }
}

const images = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!images.has(src)) {
    images.set(
      src,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      }),
    );
  }
  return images.get(src)!;
}

/** Shrink a font until `text` fits `max` pixels; returns the size used. */
function fit(ctx: Ctx, text: string, weight: number, family: string, size: number, max: number): number {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 12 && ctx.measureText(text).width > max) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function background(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.bgTop);
  g.addColorStop(1, C.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const glow = (x: number, y: number, r: number, color: string) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  };
  glow(w * 0.95, 0, w * 0.8, 'rgba(255,40,130,0.30)');
  glow(0, h * 0.18, w * 0.7, 'rgba(4,245,255,0.16)');
  // The brand bar along the bottom, as on the icon.
  ctx.fillStyle = C.green;
  ctx.fillRect(0, h - 16, w * 0.7, 16);
  ctx.fillStyle = C.pink;
  ctx.fillRect(w * 0.7, h - 16, w * 0.3, 16);
}

function logo(ctx: Ctx, x: number, y: number, size: number) {
  ctx.fillStyle = C.pink;
  ctx.beginPath();
  ctx.arc(x + size * 0.14, y - size * 0.3, size * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `700 ${size}px ${DISPLAY}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = C.text;
  ctx.fillText('PL', x + size * 0.42, y);
  const pl = ctx.measureText('PL').width;
  ctx.fillStyle = C.green;
  ctx.fillText('GAMES', x + size * 0.42 + pl, y);
}

function pills(ctx: Ctx, labels: string[], x: number, y: number, maxW: number, center: boolean) {
  ctx.font = `700 30px ${BODY}`;
  const widths = labels.map((l) => ctx.measureText(l).width + 44);
  const total = widths.reduce((a, b) => a + b, 0) + (labels.length - 1) * 14;
  let cx = center ? x + (maxW - Math.min(total, maxW)) / 2 : x;
  labels.forEach((label, i) => {
    if (cx + widths[i] > x + maxW) return;
    roundRect(ctx, cx, y, widths[i], 54, 27);
    ctx.fillStyle = 'rgba(255,197,61,0.16)';
    ctx.fill();
    ctx.fillStyle = C.amber;
    ctx.textAlign = 'left';
    ctx.fillText(label, cx + 22, y + 37);
    cx += widths[i] + 14;
  });
}

function strip(ctx: Ctx, cells: Cell[], x: number, y: number, w: number) {
  const perRow = cells.length > 19 ? Math.ceil(cells.length / 2) : cells.length;
  const gap = perRow > 12 ? 8 : 14;
  const size = Math.min(90, (w - gap * (perRow - 1)) / perRow);
  const rowW = perRow * size + (perRow - 1) * gap;
  cells.forEach((c, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    roundRect(ctx, x + (w - rowW) / 2 + col * (size + gap), y + row * (size + gap), size, size, size * 0.2);
    ctx.fillStyle = CELL[c];
    ctx.fill();
  });
  return Math.ceil(cells.length / perRow) * (size + gap) - gap;
}

function grid(ctx: Ctx, rows: Cell[][], x: number, y: number, w: number, h: number) {
  const cols = 5;
  const gap = 16;
  const size = Math.min(130, (w - gap * (cols - 1)) / cols, (h - gap * (rows.length - 1)) / Math.max(rows.length, 1));
  const gw = cols * size + (cols - 1) * gap;
  rows.forEach((row, r) =>
    row.forEach((c, i) => {
      roundRect(ctx, x + (w - gw) / 2 + i * (size + gap), y + r * (size + gap), size, size, size * 0.18);
      ctx.fillStyle = CELL[c];
      ctx.fill();
    }),
  );
}

function tiles(ctx: Ctx, list: NonNullable<CardSpec['tiles']>, x: number, y: number, w: number, h: number) {
  const gap = 18;
  const th = Math.min(150, (h - gap * (list.length - 1)) / list.length);
  list.forEach((tile, i) => {
    const ty = y + i * (th + gap);
    roundRect(ctx, x, ty, w, th, 28);
    ctx.fillStyle = C.panel;
    ctx.fill();
    roundRect(ctx, x, ty, 16, th, 8);
    ctx.fillStyle = CELL[tile.cell];
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = C.soft;
    fit(ctx, tile.label, 600, BODY, 40, w * 0.55);
    ctx.fillText(tile.label, x + 50, ty + th / 2 + 14);
    ctx.textAlign = 'right';
    ctx.fillStyle = CELL[tile.cell] === CELL.none ? C.text : CELL[tile.cell];
    ctx.font = `700 ${Math.round(th * 0.55)}px ${DISPLAY}`;
    ctx.fillText(tile.value, x + w - 40, ty + th / 2 + th * 0.19);
  });
}

function pitch(ctx: Ctx, players: CardPlayer[], x: number, y: number, w: number, h: number) {
  // Grass in stripes, lines, boxes.
  ctx.save();
  roundRect(ctx, x, y, w, h, 36);
  ctx.clip();
  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? C.pitchA : C.pitchB;
    ctx.fillRect(x, y + (h / stripes) * i, w, h / stripes + 1);
  }
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 24, y + 24, w - 48, h - 48);
  ctx.beginPath();
  ctx.moveTo(x + 24, y + h / 2);
  ctx.lineTo(x + w - 24, y + h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, w * 0.13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(x + w * 0.25, y + 24, w * 0.5, h * 0.14);
  ctx.strokeRect(x + w * 0.25, y + h - 24 - h * 0.14, w * 0.5, h * 0.14);
  ctx.restore();

  const r = Math.min(w, h) * 0.058;
  for (const p of players) {
    const px = x + (p.x / 100) * w;
    const py = y + (p.y / 100) * h - r * 0.4;
    // Shirt: the club's two colours.
    const g = ctx.createLinearGradient(px - r, py - r, px + r, py + r);
    g.addColorStop(0.58, p.colors[0]);
    g.addColorStop(0.58, p.colors[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(r * 0.78)}px ${DISPLAY}`;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.fillText(p.initials, px, py + r * 0.28);
    ctx.shadowBlur = 0;
    if (p.rating !== undefined) {
      const rr = r * 0.46;
      ctx.beginPath();
      ctx.arc(px + r * 0.82, py - r * 0.72, rr, 0, Math.PI * 2);
      ctx.fillStyle = C.green;
      ctx.fill();
      ctx.fillStyle = '#062b18';
      ctx.font = `700 ${Math.round(rr * 1.15)}px ${DISPLAY}`;
      ctx.fillText(String(p.rating), px + r * 0.82, py - r * 0.72 + rr * 0.4);
    }
    // Name on a dark tag, goals and assists under it.
    const label = p.name;
    const nameSize = fit(ctx, label, 700, BODY, Math.round(r * 0.5), r * 3.4);
    const tw = ctx.measureText(label).width + 20;
    roundRect(ctx, px - tw / 2, py + r + 8, tw, nameSize + 14, 10);
    ctx.fillStyle = 'rgba(10,3,14,0.72)';
    ctx.fill();
    ctx.fillStyle = C.text;
    ctx.font = `700 ${nameSize}px ${BODY}`;
    ctx.fillText(label, px, py + r + 8 + nameSize + 2);
    if (p.goals || p.assists) {
      const ga = `${p.goals ?? 0}G · ${p.assists ?? 0}A`;
      ctx.font = `700 ${Math.round(r * 0.42)}px ${BODY}`;
      ctx.fillStyle = C.green;
      ctx.fillText(ga, px, py + r + 8 + nameSize + 14 + Math.round(r * 0.48));
    }
  }
}

async function draw(spec: CardSpec, format: CardFormat): Promise<HTMLCanvasElement> {
  await fontsReady();
  const [W, H] = SIZE[format];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';
  background(ctx, W, H);

  const pad = 72;
  const story = format === 'story';
  logo(ctx, pad, story ? 120 : 104, story ? 70 : 60);
  if (spec.kicker) {
    ctx.textAlign = 'right';
    ctx.fillStyle = C.muted;
    fit(ctx, spec.kicker.toUpperCase(), 700, BODY, 30, W * 0.45);
    ctx.fillText(spec.kicker.toUpperCase(), W - pad, story ? 112 : 96);
  }

  const crest = spec.crest ? await loadImage(spec.crest) : null;
  const content = spec.pitch ?? spec.grid ?? spec.tiles;
  // A number and maybe a row of squares: centred, and bigger, rather than a card half empty.
  const light = !content;
  // Square with an XI: text on the left, pitch on the right.
  const split = !story && !!spec.pitch;
  const textW = split ? W * 0.46 : W - pad * 2;
  const align: CanvasTextAlign = split ? 'left' : 'center';
  const tx = split ? pad : W / 2;

  let y = light ? (story ? H * 0.3 : 320) : story ? 250 : 200;
  ctx.textAlign = align;
  ctx.fillStyle = C.green;
  fit(ctx, spec.game.toUpperCase(), 700, DISPLAY, story ? 76 : 60, textW);
  ctx.fillText(spec.game.toUpperCase(), tx, y);

  if (crest) {
    const cs = story ? 120 : 96;
    y += 30;
    ctx.drawImage(crest, split ? pad : W / 2 - cs / 2, y, cs, cs);
    y += cs;
  }

  y += light ? (story ? 330 : 220) : story ? 200 : split ? 150 : 170;
  ctx.fillStyle = C.text;
  fit(ctx, spec.headline, 700, DISPLAY, light ? (story ? 340 : 230) : story ? 220 : split ? 150 : 170, textW);
  ctx.fillText(spec.headline, tx, y);

  if (spec.sub) {
    y += story ? 76 : 62;
    ctx.fillStyle = C.soft;
    fit(ctx, spec.sub, 600, BODY, story ? 46 : 38, textW);
    ctx.fillText(spec.sub, tx, y);
  }
  if (spec.badges?.length) {
    y += 34;
    pills(ctx, spec.badges, split ? pad : pad, y, textW, !split);
    y += 54;
  }

  const footerY = H - (story ? 120 : 76);
  const top = y + (story ? 60 : 40);
  if (spec.pitch) {
    if (split) {
      const pw = W * 0.42;
      pitch(ctx, spec.pitch, W - pad - pw + 20, 150, pw - 20, H - 150 - 150);
      if (spec.strip) strip(ctx, spec.strip, pad, Math.max(top, H - 360), textW);
    } else {
      const stripH = spec.strip ? 130 : 0;
      const ph = footerY - 150 - top - stripH;
      const pw = Math.min(W - pad * 2, ph * 0.78);
      pitch(ctx, spec.pitch, (W - pw) / 2, top, pw, ph);
      if (spec.strip) strip(ctx, spec.strip, pad, top + ph + 40, W - pad * 2);
    }
  } else if (spec.grid) {
    grid(ctx, spec.grid, pad, top, W - pad * 2, footerY - 150 - top);
  } else if (spec.tiles) {
    tiles(ctx, spec.tiles, pad, top, W - pad * 2, footerY - 140 - top);
  } else if (spec.strip) {
    strip(ctx, spec.strip, pad, top + (story ? 60 : 10), W - pad * 2);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = C.text;
  fit(ctx, spec.cta, 700, DISPLAY, story ? 64 : 50, W - pad * 2);
  ctx.fillText(spec.cta, W / 2, footerY - (story ? 10 : 0));
  ctx.fillStyle = C.muted;
  ctx.font = `600 ${story ? 32 : 28}px ${BODY}`;
  ctx.fillText(spec.url, W / 2, footerY + (story ? 54 : 44));
  return canvas;
}

export async function renderCard(spec: CardSpec, format: CardFormat): Promise<Blob | null> {
  const canvas = await draw(spec, format);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** "mlodyheros.github.io/premier_league_app" */
export function siteLabel(): string {
  return (location.host + location.pathname).replace(/\/(index\.html)?$/, '');
}

export function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
