/** "€220M", "€45.5M", "€750K". */
export function formatEur(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `€${trimZero(m.toFixed(m >= 100 ? 0 : 1))}M`;
  }
  return `€${Math.round(value / 1000)}K`;
}

/** "+25%", "−8%", "0%": a true minus sign, and no "-0%". */
export function formatPct(ratio: number): string {
  const pct = Math.round(ratio * 100);
  if (pct === 0) return '0%';
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

function trimZero(s: string): string {
  return s.includes('.') ? s.replace(/\.0$/, '') : s;
}

/** Lowercase and strip accents, for search: "Ødegaard" → "odegaard". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[łŁ]/g, 'l')
    .toLowerCase();
}

export function initials(name: string): string {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
