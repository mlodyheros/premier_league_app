/**
 * Shrink heavy crests: any public/crests/*.svg over LIMIT bytes is rendered
 * at 192px high and saved back as an SVG wrapping a 128-colour PNG. Crests are
 * never shown bigger than ~52px (156px on a 3x screen), so nothing is lost,
 * and Coventry's 173KB (64 embedded photos) becomes 14KB.
 *
 *   node pipeline/compress_crests.mjs        (needs pl-value's Python for Pillow)
 */
import { Resvg } from '@resvg/resvg-js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIMIT = 15_000;
const HEIGHT = 192;
const PYTHON = process.env.PL_VALUE_PYTHON ?? `${process.env.HOME}/projects/pl-value-predictor/.venv/bin/python`;
const dir = 'public/crests';
const tmp = mkdtempSync(join(tmpdir(), 'crests-'));

for (const f of readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
  const path = join(dir, f);
  const svg = readFileSync(path, 'utf8');
  if (statSync(path).size < LIMIT || svg.includes('data:image/png;base64') && svg.length < 30_000) continue;
  const png = new Resvg(svg, { fitTo: { mode: 'height', value: HEIGHT } }).render();
  const raw = join(tmp, f.replace('.svg', '.png'));
  writeFileSync(raw, png.asPng());
  // Pillow's palette quantisation keeps the alpha edge clean at a fraction of the size.
  const b64 = execFileSync(PYTHON, ['-c', [
    'import sys, io, base64',
    'from PIL import Image',
    'im = Image.open(sys.argv[1]).convert("RGBA")',
    'q = im.quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)',
    'b = io.BytesIO(); q.save(b, "PNG", optimize=True)',
    'sys.stdout.write(base64.b64encode(b.getvalue()).decode())',
  ].join('\n'), raw]).toString();
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${png.width} ${png.height}"><image width="${png.width}" height="${png.height}" href="data:image/png;base64,${b64}"/></svg>`;
  writeFileSync(path, out);
  console.log(`${f}: ${statSync(path).size} bytes`);
}
