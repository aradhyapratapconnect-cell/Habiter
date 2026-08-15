/**
 * Date helper utilities for streak calculations.
 *
 * All functions operate on ISO date strings ("YYYY-MM-DD") — the same format
 * used in the database. Using plain string dates avoids timezone pitfalls that
 * Date objects can introduce when the local day doesn't align with UTC.
 */

import type { ISODate } from '../types';

/** Parse "YYYY-MM-DD" into a local-time Date at midnight. */
export function parseISO(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** Format a local-time Date back into "YYYY-MM-DD". */
export function toISO(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Return a new Date advanced (or retreated) by N days. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Number of whole days between two dates.
 * diffDays(b, a) > 0 when b is after a.
 */
export function diffDays(a: Date, b: Date): number {
  const MS = 86_400_000;
  return Math.round((b.getTime() - a.getTime()) / MS);
}

/** True if both dates represent the same calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
