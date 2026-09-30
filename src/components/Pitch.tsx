import type { ValueSource } from '../data/valueSource';
import { fit, slotRating, type Formation, type Lineup, type Slot } from '../lib/strength';
import { Avatar } from './Avatar';

interface Props {
  formation: Formation;
  lineup: Lineup;
  source: ValueSource;
  /** Slot currently chosen by the user. */
  selected?: string | null;
  /** Empty slots worth drawing attention to (e.g. ones the current club can fill). */
  highlight?: ReadonlySet<string>;
  onSlot?: (slot: Slot) => void;
}

/** A vertical pitch with the formation's slots, filled or empty. */
export function Pitch({ formation, lineup, source, selected, highlight, onSlot }: Props) {
  return (
    <div class="pitch" role="group" aria-label={`Formation ${formation.label}`}>
      <div class="pitch__lines" aria-hidden="true">
        <span class="pitch__half" />
        <span class="pitch__circle" />
        <span class="pitch__box pitch__box--top" />
        <span class="pitch__box pitch__box--bottom" />
      </div>
      {formation.slots.map((slot) => {
        const p = lineup[slot.id];
        const eff = p ? Math.round(slotRating(p, slot, source)) : null;
        const offPos = p ? fit(p, slot.type) < 1 : false;
        const cls = [
          'slot',
          p ? 'slot--filled' : 'slot--empty',
          selected === slot.id ? 'slot--selected' : '',
          !p && highlight?.has(slot.id) ? 'slot--hint' : '',
        ].join(' ');
        const label = p ? `${slot.type}: ${p.name}, rating ${eff}` : `${slot.type}: empty`;
        return (
          <button
            type="button"
            class={cls}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            onClick={() => onSlot?.(slot)}
            disabled={!onSlot}
            aria-label={label}
            aria-pressed={selected === slot.id}
          >
            {p ? (
              <>
                <Avatar player={p} size={38} />
                <span class="slot__name">{p.short}</span>
                <span class={`slot__ovr ${offPos ? 'slot__ovr--off' : ''}`}>{eff}</span>
              </>
            ) : (
              <span class="slot__pos">{slot.type}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
