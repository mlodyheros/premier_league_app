/** Share a result: the native share sheet on phones, the clipboard elsewhere. */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  // Desktop browsers have navigator.share too, but copying is what people expect there.
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  if (touch && nav.share) {
    try {
      await nav.share({ text });
      return 'shared';
    } catch (err) {
      // Cancelled by the user: don't fall back to the clipboard behind their back.
      if (err instanceof DOMException && err.name === 'AbortError') return 'failed';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** The site's address without the hash route. */
export function siteUrl(): string {
  return location.origin + location.pathname;
}

/**
 * A link to a game's share page (g/<path>/): its own preview title, text and
 * picture, forwarding to the game. Built only in production; in development
 * it is just the game's address.
 */
export function shareUrl(path: string, query = ''): string {
  return import.meta.env.PROD ? `${siteUrl()}g/${path}/${query}` : `${siteUrl()}${query ? `#/${path}${query}` : `#/${path}`}`;
}
