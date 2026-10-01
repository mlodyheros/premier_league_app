/**
 * Render the share-preview image (public/og.png, 1200×630) that link previews
 * show on Messenger, X, Slack and the like.
 *
 * Run locally after the clubs change: `npm run og-image`. It uses macOS
 * system fonts (DIN Condensed, Avenir Next), so the PNG is committed rather
 * than built in CI, where those fonts don't exist.
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const meta = JSON.parse(readFileSync(join(root, 'public/data/meta.json'), 'utf8'));
const W = 1200;
const H = 630;

// Each crest is rasterised on its own first: some (Coventry's) embed bitmaps,
// which resvg draws at the top level but not inside a nested SVG image.
const crest = (code) => {
  const svg = readFileSync(join(root, 'public/crests', `${code}.svg`));
  const png = new Resvg(svg, { fitTo: { mode: 'height', value: 132 } }).render().asPng();
  return `data:image/png;base64,${png.toString('base64')}`;
};

const codes = Object.keys(meta.clubs);
const size = 44;
const gap = (W - 120 - size * 10) / 9;
const crests = codes
  .map((code, i) => {
    const x = 60 + (i % 10) * (size + gap);
    const y = 418 + Math.floor(i / 10) * (size + 22);
    return `<image href="${crest(code)}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
  })
  .join('\n');

const games = [
  'Guess the Player',
  'Road to 38-0',
  'Higher or Lower',
  'Budget XI',
  'Beat the Model',
  'Price Tag',
].join('  ·  ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="g1" cx="0.9" cy="0" r="0.7"><stop offset="0" stop-color="#ff2882" stop-opacity="0.35"/><stop offset="1" stop-color="#ff2882" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="0" cy="0.15" r="0.6"><stop offset="0" stop-color="#04f5ff" stop-opacity="0.22"/><stop offset="1" stop-color="#04f5ff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#16081d"/>
  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>
  <circle cx="72" cy="86" r="9" fill="#ff2882"/>
  <text x="94" y="104" font-family="DIN Condensed" font-weight="700" font-size="56" fill="#f6eff8" letter-spacing="1">PL<tspan fill="#00ff85">GAMES</tspan></text>
  <text x="60" y="230" font-family="DIN Condensed" font-weight="700" font-size="96" fill="#f6eff8">PREMIER LEAGUE GAMES,</text>
  <text x="60" y="320" font-family="DIN Condensed" font-weight="700" font-size="96" fill="#00ff85">PRICED BY DATA.</text>
  <text x="60" y="372" font-family="Avenir Next" font-weight="500" font-size="27" fill="#b7a3bf">${games}</text>
  ${crests}
  <text x="60" y="${H - 34}" font-family="Avenir Next" font-weight="600" font-size="22" fill="#b7a3bf">${meta.season} · ${meta.players} players · Transfermarkt vs a machine-learning model · English / Polski</text>
</svg>`;

const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: { loadSystemFonts: true, defaultFontFamily: 'Avenir Next' },
}).render().asPng();

writeFileSync(join(root, 'public/og.png'), png);
console.log(`public/og.png: ${W}×${H}, ${(png.length / 1024).toFixed(0)} KB`);
