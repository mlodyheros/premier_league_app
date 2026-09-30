import { valueSource, type ValueSource } from '../data/valueSource';

const OPTIONS: { key: ValueSource; label: string; title: string }[] = [
  { key: 'tm', label: 'TM', title: 'Transfermarkt market value' },
  { key: 'model', label: 'Model', title: 'pl-value model estimate' },
];

/** The global value-source switch. Every game reads valueSource. */
export function ValueToggle() {
  return (
    <div class="value-toggle" role="radiogroup" aria-label="Value source">
      {OPTIONS.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={valueSource.value === o.key}
          title={o.title}
          class={valueSource.value === o.key ? 'on' : ''}
          onClick={() => (valueSource.value = o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
