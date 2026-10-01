/** Motion helpers that all respect the player's "reduce motion" setting. */

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** A short vibration on phones that support it: feedback for right and wrong answers. */
export function buzz(kind: 'good' | 'bad' | 'tap' = 'tap'): void {
  if (reducedMotion() || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  const pattern = kind === 'good' ? [18] : kind === 'bad' ? [40, 40, 40] : [8];
  try {
    navigator.vibrate(pattern);
  } catch {
    /* not allowed */
  }
}

const COLORS = ['#00ff85', '#ff2882', '#04f5ff', '#ffc53d', '#f6eff8'];

/** A burst of confetti over the page; `big` for the moments that deserve it. */
export function celebrate(big = false): void {
  if (reducedMotion() || typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);

  const count = big ? 220 : 110;
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth * (0.2 + Math.random() * 0.6),
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * (big ? 16 : 11),
    vy: -Math.random() * (big ? 17 : 13) - 4,
    size: 5 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  const duration = big ? 2600 : 1800;
  const start = performance.now();

  function frame(now: number) {
    const t = now - start;
    ctx!.clearRect(0, 0, innerWidth, innerHeight);
    ctx!.globalAlpha = Math.max(0, 1 - t / duration);
    for (const p of parts) {
      p.vy += 0.42;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx!.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
