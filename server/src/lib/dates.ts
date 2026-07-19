/**
 * Local-time (not UTC) YYYY-MM-DD date helpers. DuoGrow tracks "today" in the
 * server's local timezone — using toISOString() would shift the date near
 * midnight for users west of UTC, so everything here uses local getters.
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format a Date as a local YYYY-MM-DD string. */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Today's date as a local YYYY-MM-DD string. */
export function today(): string {
  return formatDate(new Date());
}

/** Parse a YYYY-MM-DD string into a local Date at midnight. */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Add (or subtract, with a negative delta) days to a YYYY-MM-DD string. */
export function addDays(dateStr: string, delta: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + delta);
  return formatDate(d);
}

/** Yesterday relative to today() as a YYYY-MM-DD string. */
export function yesterday(): string {
  return addDays(today(), -1);
}

/**
 * The last n days as YYYY-MM-DD strings, oldest first, ending with today.
 * lastNDays(7) => [today-6, today-5, ..., today].
 */
export function lastNDays(n: number, endDate: string = today()): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    days.push(addDays(endDate, -i));
  }
  return days;
}

/** Parse "HH:MM" into minutes-since-midnight, e.g. "06:30" -> 390. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Format minutes-since-midnight back into "HH:MM". */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${pad2(h)}:${pad2(m)}`;
}
