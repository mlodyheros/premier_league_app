/** The global Transfermarkt ↔ model switch, remembered across reloads. */
import { effect, signal } from '@preact/signals';
import { readJson, writeJson } from '../lib/storage';
import type { Player } from './types';

export type ValueSource = 'tm' | 'model';

const KEY = 'valueSource';

export const valueSource = signal<ValueSource>(readJson<ValueSource>(KEY) === 'model' ? 'model' : 'tm');

effect(() => writeJson(KEY, valueSource.value));

export const SOURCE_LABEL: Record<ValueSource, string> = {
  tm: 'Transfermarkt',
  model: 'Model',
};

export const SOURCE_SHORT: Record<ValueSource, string> = { tm: 'TM', model: 'Model' };

export function valueOf(player: Player, source: ValueSource = valueSource.value): number {
  return source === 'tm' ? player.tm : player.model;
}

/** Model estimate relative to Transfermarkt, e.g. -0.25 for 25% lower. */
export function modelGap(player: Player): number {
  return player.model / player.tm - 1;
}
