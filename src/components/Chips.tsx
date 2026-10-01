import { rovingKeys } from '../lib/a11y';

/** A scrollable row of single-choice chips (a radio group). */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  name,
  disabled = false,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  name: (v: T) => string;
  disabled?: boolean;
}) {
  return (
    <div class="chips" role="radiogroup" aria-label={label} onKeyDown={rovingKeys}>
      {options.map((o) => (
        <button
          type="button"
          role="radio"
          class="chip"
          aria-checked={o === value}
          tabIndex={o === value ? 0 : -1}
          disabled={disabled}
          onClick={() => o !== value && onChange(o)}
        >
          {name(o)}
        </button>
      ))}
    </div>
  );
}
