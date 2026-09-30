import type { Player } from '../data/types';
import { modelGap, valueSource } from '../data/valueSource';
import { formatEur, formatPct } from '../lib/format';

/** "Model €45M | TM €60M | −25%", with the active source emphasised. */
export function ValueCompare({ player, range = false }: { player: Player; range?: boolean }) {
  const gap = modelGap(player);
  const active = valueSource.value;
  return (
    <div class="value-compare">
      <span class={active === 'model' ? 'vc vc--on' : 'vc'}>
        <small>Model</small>
        {formatEur(player.model)}
      </span>
      <span class={active === 'tm' ? 'vc vc--on' : 'vc'}>
        <small>TM</small>
        {formatEur(player.tm)}
      </span>
      <span class={`vc vc--gap ${gap > 0.005 ? 'up' : gap < -0.005 ? 'down' : ''}`}>
        <small>Gap</small>
        {formatPct(gap)}
      </span>
      {range && (
        <span class="vc vc--range">
          <small>80% range</small>
          {formatEur(player.low)}–{formatEur(player.high)}
        </span>
      )}
    </div>
  );
}
