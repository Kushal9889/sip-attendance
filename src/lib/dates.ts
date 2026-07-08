// All dates in this app are in IST (Asia/Kolkata, UTC+5:30)
// NEVER use new Date().toISOString() — that returns UTC and breaks at 12:30am IST

/** Returns today's date as YYYY-MM-DD in IST timezone */
export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
}

/** Formats a YYYY-MM-DD date for display: "Monday, 7 July 2026" */
export function displayDate(isoDate: string): string {
  // Append IST offset to parse as IST, not UTC
  const d = new Date(isoDate + 'T00:00:00+05:30');
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/** Formats short: "7 Jul" */
export function shortDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00+05:30');
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

/** Returns YYYY-MM for a given month offset from today (0 = current month, -1 = last month) */
export function getMonthKey(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Returns all days in a YYYY-MM month as YYYY-MM-DD strings */
export function getDaysInMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${yearMonth}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

/** First day of week (0=Sun) for a YYYY-MM month */
export function getFirstDayOfWeek(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).getDay();
}

/** Returns day number (1-31) from YYYY-MM-DD */
export function getDayNumber(isoDate: string): number {
  return parseInt(isoDate.split('-')[2], 10);
}

/** Is the date in the future (IST)? */
export function isFutureDate(isoDate: string): boolean {
  return isoDate > todayIST();
}
