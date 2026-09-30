/** Formatting that follows the active language. */
import { lang, t, type Lang } from '../i18n';

function decimal(n: number, digits: number, l: Lang): string {
  const s = n.toFixed(digits).replace(/\.0$/, '');
  return l === 'pl' ? s.replace('.', ',') : s;
}

const NBSP = '\u00a0';

/**
 * "€220M", "€45.5M", "€750K" in English; "220 mln €", "45,5 mln €", "750 tys. €"
 * in Polish, with non-breaking spaces so a value never wraps. `compact` drops
 * the Polish "€" for narrow cells whose header already names the currency.
 */
export function formatEur(value: number, l: Lang = lang.value, compact = false): string {
  const euro = compact ? '' : `${NBSP}€`;
  if (value >= 1_000_000) {
    const m = decimal(value / 1_000_000, value >= 100_000_000 ? 0 : 1, l);
    return l === 'pl' ? `${m}${NBSP}mln${euro}` : `€${m}M`;
  }
  const k = Math.round(value / 1000);
  return l === 'pl' ? `${k}${NBSP}tys.${euro}` : `€${k}K`;
}

/** "+25%", "−8%", "0%": a true minus sign, and no "-0%". */
export function formatPct(ratio: number): string {
  const pct = Math.round(ratio * 100);
  if (pct === 0) return '0%';
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

/** A whole number with the language's thousands separator. */
export function formatInt(n: number, l: Lang = lang.value): string {
  return Math.round(n).toLocaleString(l === 'pl' ? 'pl-PL' : 'en-GB');
}

/** A decimal with the language's separator: 84.3 / 84,3. */
export function formatDecimal(n: number, digits = 1, l: Lang = lang.value): string {
  const s = n.toFixed(digits);
  return l === 'pl' ? s.replace('.', ',') : s;
}

/** "24 Sep 2026" / "24 wrz 2026" from an ISO date. */
export function formatDate(iso: string, l: Lang = lang.value): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(l === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(y, m - 1, d),
  );
}

/** 1st, 2nd, 3rd… in English; "1." in Polish. */
export function ordinal(n: number, l: Lang = lang.value): string {
  if (l === 'pl') return `${n}.`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "1 in 12,300" / "1 do 12 300"; "practically zero" when too small to show. */
export function formatOdds(p: number, l: Lang = lang.value): string {
  if (p <= 0 || !Number.isFinite(1 / p)) return t('odds.never', {}, l);
  if (p >= 0.5) return `${Math.round(p * 100)}%`;
  const n = 1 / p;
  if (n > 1e12) return t('odds.tiny', {}, l);
  const rounded = n < 100 ? Math.round(n) : Number(n.toPrecision(3));
  return t('odds.oneIn', { n: formatInt(rounded, l) }, l);
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
