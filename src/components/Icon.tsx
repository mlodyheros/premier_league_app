import { ICONS, type IconName } from './icons.generated';

export type { IconName };

/**
 * A line icon from Tabler Icons, drawn in the current text colour. Decorative
 * by default (hidden from screen readers); pass `label` when the icon is the
 * only thing saying what a control does.
 */
export function Icon({ name, size = 20, label, class: cls = '' }: { name: IconName; size?: number; label?: string; class?: string }) {
  return (
    <svg
      class={`icon ${cls}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      // Trusted, generated markup (pipeline/icons.mjs), never user input.
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
