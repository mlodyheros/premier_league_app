/** Building share cards (lib/shareCard.ts) from the games' own data. */
import type { Meta } from '../data/types';
import type { ValueSource } from '../data/valueSource';
import { t } from '../i18n';
import type { MatchResult } from './season';
import type { Tally } from './scorers';
import { initialsOf, siteLabel, type CardPlayer, type Cell } from './shareCard';
import { slotRating, type Formation, type Lineup } from './strength';

/** An XI on the card's pitch: shirts in club colours, ratings, goals and assists. */
export function xiOnPitch(
  formation: Formation,
  lineup: Lineup,
  meta: Meta,
  source: ValueSource,
  scorers?: Record<string, Tally>,
): CardPlayer[] {
  return formation.slots.flatMap((slot) => {
    const p = lineup[slot.id];
    if (!p) return [];
    const club = meta.clubs[p.club];
    const tally = scorers?.[p.name];
    return [
      {
        x: slot.x,
        y: slot.y,
        name: p.short || p.name,
        initials: initialsOf(p.name),
        colors: [club.primary, club.secondary] as [string, string],
        rating: Math.round(slotRating(p, slot, source)),
        goals: tally?.goals,
        assists: tally?.assists,
      },
    ];
  });
}

export function resultCells(results: readonly MatchResult[]): Cell[] {
  return results.map((r) => (r.outcome === 'W' ? 'good' : r.outcome === 'D' ? 'mid' : 'bad'));
}

export function crestUrl(code: string): string {
  return `${import.meta.env.BASE_URL}crests/${code}.svg`;
}

export const cardFooter = (cta = t('share.cta')) => ({ cta, url: siteLabel() });
