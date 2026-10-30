import { today } from '../lib/format';
import { puttsByDay } from '../lib/practice';
import type { PracticeSet } from '../lib/types';

const WEEKS = 12;

function iso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function level(putts: number): number {
  if (!putts) return 0;
  if (putts <= 20) return 1;
  if (putts <= 50) return 2;
  return 3;
}

/** Twelve weeks, a column per week starting Monday, today in the last column. */
export function PracticeDays({ sets }: { sets: PracticeSet[] }) {
  const byDay = puttsByDay(sets);
  const end = new Date(`${today()}T12:00:00`);
  const monday = new Date(end);
  monday.setDate(end.getDate() - ((end.getDay() + 6) % 7));
  const start = new Date(monday);
  start.setDate(monday.getDate() - (WEEKS - 1) * 7);

  const cells: { day: string; putts: number; future: boolean }[] = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const day = iso(d);
    cells.push({ day, putts: byDay.get(day) ?? 0, future: d > end });
  }

  return (
    <div className="days" role="img" aria-label="Putts rolled per day, last twelve weeks">
      {cells.map((c) => (
        <i
          key={c.day}
          className={c.future ? 'future' : `l${level(c.putts)}`}
          title={c.putts ? `${c.day}: ${c.putts} putts` : c.day}
        />
      ))}
    </div>
  );
}
