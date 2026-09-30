import type { Player } from '../data/types';
import { modelGap, valueSource } from '../data/valueSource';
import { t } from '../i18n';
import { formatEur, formatPct } from '../lib/format';

/** "Model €45M | TM €60M | −25%", with the active source emphasised. */
export function ValueCompare({ player, range = false }: { player: Player; range?: boolean }) {
  const gap = modelGap(player);
  const active = valueSource.value;
  return (
    <div class="value-compare">
      <span class={active === 'model' ? 'vc vc--on' : 'vc'}>
        <small>{t('compare.model')}</small>
        {formatEur(player.model)}
      </span>
      <span class={active === 'tm' ? 'vc vc--on' : 'vc'}>
        <small>{t('compare.tm')}</small>
        {formatEur(player.tm)}
      </span>
      <span class={`vc vc--gap ${gap > 0.005 ? 'up' : gap < -0.005 ? 'down' : ''}`}>
        <small>{t('compare.gap')}</small>
        {formatPct(gap)}
      </span>
      {range && (
        <span class="vc vc--range">
          <small>{t('compare.range')}</small>
          {formatEur(player.low)}–{formatEur(player.high)}
        </span>
      )}
    </div>
  );
}
