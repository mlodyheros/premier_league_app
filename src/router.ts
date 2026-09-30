/** Hash routing ("#/guess"), so the static build works on GitHub Pages. */
import { signal } from '@preact/signals';

function current(): string {
  return location.hash.replace(/^#\/?/, '').split('?')[0] || '';
}

export const route = signal(current());

window.addEventListener('hashchange', () => {
  route.value = current();
  window.scrollTo(0, 0);
});

export function href(path: string): string {
  return `#/${path}`;
}
