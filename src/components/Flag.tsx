/**
 * A nation's flag. Emoji for all but Northern Ireland, which has no flag emoji:
 * it gets the Ulster Banner, the flag its football team plays under and FIFA
 * shows, drawn here as a small SVG.
 */
export function Flag({ flag, title }: { flag: string; title?: string }) {
  if (flag !== 'NIR') return <span class="flag" title={title}>{flag}</span>;
  return (
    <svg class="flag flag--svg" viewBox="0 0 30 20" width="1.25em" height="0.85em" role="img" aria-label={title}>
      <title>{title}</title>
      <rect width="30" height="20" fill="#fff" />
      <rect x="12.5" width="5" height="20" fill="#cf142b" />
      <rect y="7.5" width="30" height="5" fill="#cf142b" />
      <polygon points="15,4.2 17.8,9 15,13.8 12.2,9" fill="#fff" />
      <polygon points="15,13.8 12.2,9 17.8,9" fill="#fff" />
      <path d="M15 4.6l2.6 4.5h-5.2zM15 13.4l-2.6-4.5h5.2z" fill="#fff" />
      <rect x="14" y="7.8" width="2" height="2.6" rx="0.6" fill="#cf142b" />
      <path d="M13.4 3.2h3.2l-.4 1.2h-2.4z" fill="#f2b600" />
    </svg>
  );
}
