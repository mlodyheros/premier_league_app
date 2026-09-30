/** Small label helpers built on t(). */
import type { PosCode } from '../data/types';
import { t } from './index';

export const posLabel = (code: PosCode) => t(`pos.${code}`);
export const posFull = (code: PosCode) => t(`posFull.${code}`);

/** Share-status message for a shareText() result. */
export function shareNote(result: 'shared' | 'copied' | 'failed'): string {
  return t(result === 'copied' ? 'share.copied' : result === 'shared' ? 'share.shared' : 'share.failed');
}
