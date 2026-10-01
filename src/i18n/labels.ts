/** Small label helpers built on t(). */
import type { PosCode } from '../data/types';
import { t } from './index';

export const posLabel = (code: PosCode) => t(`pos.${code}`);
export const posFull = (code: PosCode) => t(`posFull.${code}`);
