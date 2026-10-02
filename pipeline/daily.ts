/**
 * Write the daily rounds into public/data/daily.json: today and the next
 * AHEAD days, each written once and then never changed (src/lib/dailyRounds.ts
 * says why). Days older than KEEP_DAYS are dropped. Runs after the export:
 *
 *     npx tsx pipeline/daily.ts [YYYY-MM-DD]
 *
 * It uses the games' own TypeScript, so a scheduled round is exactly the round
 * the browser would have computed from the same data.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { History } from '../src/data/history';
import type { Player } from '../src/data/types';
import { writeDay, type Schedule } from '../src/lib/dailyRounds';
import { setRatingPool } from '../src/lib/strength';

const AHEAD = 2;
const KEEP_DAYS = 90;
/** The guess answer is not repeated within this many scheduled days (or until the pool runs out). */
const NO_REPEAT_DAYS = 365;

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
const read = <T>(file: string): T => JSON.parse(readFileSync(join(dataDir, file), 'utf8')) as T;

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + n));
}

const players = read<Player[]>('players.json');
setRatingPool(players);
const history = existsSync(join(dataDir, 'history.json')) ? read<History>('history.json') : null;
const schedule: Schedule = existsSync(join(dataDir, 'daily.json')) ? read<Schedule>('daily.json') : {};

const today = process.argv[2] ?? localDay(new Date());
const written: string[] = [];
for (let i = 0; i <= AHEAD; i++) {
  const day = addDays(today, i);
  if (schedule[day]) continue;
  const recent = new Set(
    Object.entries(schedule)
      .filter(([d]) => d < day && d >= addDays(day, -NO_REPEAT_DAYS))
      .map(([, r]) => r.guess),
  );
  schedule[day] = writeDay(players, history, day, recent);
  written.push(day);
}

const oldest = addDays(today, -KEEP_DAYS);
const kept: Schedule = {};
for (const day of Object.keys(schedule).sort()) if (day >= oldest) kept[day] = schedule[day];

writeFileSync(join(dataDir, 'daily.json'), JSON.stringify(kept));
console.log(
  written.length
    ? `Daily rounds written for ${written.join(', ')} (${Object.keys(kept).length} days kept).`
    : `Daily rounds already written up to ${addDays(today, AHEAD)}.`,
);
