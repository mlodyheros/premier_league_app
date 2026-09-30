/** Share a result: the native share sheet on phones, the clipboard elsewhere. */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  if (touch && nav.share) {
    try {
      await nav.share({ text });
      return 'shared';
    } catch (err) {
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

export function siteUrl(): string {
  return location.origin + location.pathname;
}
