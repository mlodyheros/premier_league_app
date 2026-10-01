import { t } from '../i18n';
import { formatEur } from '../lib/format';

const W = 320;
const H = 130;
const PAD = { top: 18, right: 8, bottom: 20, left: 8 };

function monthIndex(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
}

/**
 * A player's Transfermarkt value over his career: a line from the first
 * valuation to today's, the peak marked, years along the bottom.
 */
export function ValueChart({ points, unit, label }: { points: [string, number][]; unit: number; label: string }) {
  if (points.length < 2) return null;
  const xs = points.map(([m]) => monthIndex(m));
  const vs = points.map(([, v]) => v * unit);
  const x0 = xs[0];
  const x1 = Math.max(xs[xs.length - 1], x0 + 1);
  const top = Math.max(...vs) * 1.12 || 1;
  const x = (i: number) => PAD.left + ((xs[i] - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / top) * (H - PAD.top - PAD.bottom);
  const line = vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(vs.length - 1).toFixed(1)},${H - PAD.bottom} L${x(0).toFixed(1)},${H - PAD.bottom} Z`;
  const peak = vs.indexOf(Math.max(...vs));
  const last = vs.length - 1;

  // A tick at each January the curve spans, at most six.
  const years: number[] = [];
  for (let yr = Math.ceil(x0 / 12); yr * 12 <= x1; yr++) years.push(yr);
  const every = Math.ceil(years.length / 6);

  return (
    <figure class="vchart">
      <figcaption class="vchart__title">{label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('chart.aria', { from: formatEur(vs[0]), peak: formatEur(vs[peak]), now: formatEur(vs[last]) })}>
        {years
          .filter((_, i) => i % every === 0)
          .map((yr) => {
            const px = PAD.left + ((yr * 12 - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
            return (
              <g class="vchart__year">
                <line x1={px} x2={px} y1={PAD.top} y2={H - PAD.bottom} />
                <text x={px} y={H - 6} text-anchor="middle">
                  ’{String(yr).slice(2)}
                </text>
              </g>
            );
          })}
        <path class="vchart__area" d={area} />
        <path class="vchart__line" d={line} />
        <circle class="vchart__peak" cx={x(peak)} cy={y(vs[peak])} r="3.5" />
        <text class="vchart__label" x={Math.min(Math.max(x(peak), 40), W - 40)} y={y(vs[peak]) - 6} text-anchor="middle">
          {formatEur(vs[peak])}
        </text>
        {peak !== last && <circle class="vchart__now" cx={x(last)} cy={y(vs[last])} r="3.5" />}
      </svg>
    </figure>
  );
}
