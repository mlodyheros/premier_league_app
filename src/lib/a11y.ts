/**
 * Keyboard support for tab lists and radio groups (WAI-ARIA Authoring
 * Practices): arrows move between the options and select them, Home and End
 * jump to the ends. Use as the container's onKeyDown; give the selected option
 * tabIndex 0 and the rest -1, so Tab enters the group once.
 */
export function rovingKeys(e: KeyboardEvent): void {
  const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
  const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
  if (!forward && !back && e.key !== 'Home' && e.key !== 'End') return;
  const items = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"], [role="radio"]')];
  const at = items.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  e.preventDefault();
  const next =
    e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (at + (forward ? 1 : -1) + items.length) % items.length;
  items[next].focus();
  items[next].click();
}
