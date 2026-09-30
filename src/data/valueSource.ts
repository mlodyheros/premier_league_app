/** The global Transfermarkt ↔ model switch, remembered across reloads. */
import { effect, signal } from '@preact/signals';
import { t } from '../i18n';
import { readJson, writeJson } from '../lib/storage';
import type { Player } from './types';

export type ValueSource = 'tm' | 'model';

const KEY = 'valueSource';

export const valueSource = signal<ValueSource>(readJson<ValueSource>(KEY) === 'model' ? 'model' : 'tm');

effect(() => writeJson(KEY, valueSource.value));

/** "Transfermarkt values" / "wartości modelu", for use inside sentences. */
export const valuesPhrase = (s: ValueSource = valueSource.value) => t(`values.${s}`);
/** "Transfermarkt value" / "wartość według modelu", singular. */
export const valuePhrase = (s: ValueSource = valueSource.value) => t(`value.${s}`);
/** "TM" / "Model", for column headers. */
export const sourceShort = (s: ValueSource = valueSource.value) => t(`short.${s}`);
/** "TM values" / "wartości TM", for share texts. */
export const shareValues = (s: ValueSource = valueSource.value) => t(`shareValues.${s}`);

export function valueOf(player: Player, source: ValueSource = valueSource.value): number {
  return source === 'tm' ? player.tm : player.model;
}

/** Model estimate relative to Transfermarkt, e.g. -0.25 for 25% lower. */
export function modelGap(player: Player): number {
  return player.model / player.tm - 1;
}
