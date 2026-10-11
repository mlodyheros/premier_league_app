/** Hash routing ("#/guess"), so the static build works on GitHub Pages. */
import { signal } from '@preact/signals';

function current(): string {
  // Unit tests import pages without a browser.
  if (typeof location === 'undefined') return '';
  return location.hash.replace(/^#\/?/, '').split('?')[0] || '';
}

export const route = signal(current());

globalThis.window?.addEventListener('hashchange', () => {
  route.value = current();
  window.scrollTo(0, 0);
});

export function href(path: string): string {
  return `#/${path}`;
}

/** A query parameter of the current hash route: "#/budget?club=ARS" → club = "ARS". */
export function routeParam(name: string): string | null {
  const query = location.hash.split('?')[1];
  return query ? new URLSearchParams(query).get(name) : null;
}
