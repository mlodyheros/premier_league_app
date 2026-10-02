/**
 * localStorage with a namespace, and without throwing: private windows and
 * blocked storage just mean nothing is remembered.
 */
const PREFIX = 'plg:';

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

/** Settings kept when progress is reset. */
const KEEP = new Set(['lang', 'valueSource', 'analytics', 'poolLevel', 'onboarded', 'theme']);

/** Delete every score, streak and game in progress; keep the settings. */
export function clearProgress(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX) && !KEEP.has(key.slice(PREFIX.length))) doomed.push(key);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}
