import type { FrequencyType } from '../types';

export const DAYS_OF_WEEK = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
] as const;

/**
 * Format a frequency type and its value into a human-readable string.
 * E.g., "daily" → "Daily", "times_per_week" + '{"count":3}' → "3x/week"
 */
export function formatFrequency(type: FrequencyType, value?: string | null): string {
  switch (type) {
    case 'daily':
      return 'Daily';
    case 'specific_days': {
      if (!value) return 'Specific days';
      try {
        const days: string[] = JSON.parse(value);
        if (days.length === 7) return 'Every day';
        return days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
      } catch {
        return 'Specific days';
      }
    }
    case 'times_per_week': {
      if (!value) return 'Weekly';
      try {
        const parsed: { count?: number } = JSON.parse(value);
        return `${parsed.count ?? 1}x/week`;
      } catch {
        return 'Weekly';
      }
    }
  }
}
