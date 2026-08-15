import { useEffect, useState } from 'react';
import type { DailyLog, ISODate, Mood } from '../../types';
import { useCheckinsStore, getDaysInMonth } from '../../stores/checkinsStore';

// ---------------------------------------------------------------------------
// Safe API accessor
// ---------------------------------------------------------------------------

function api() {
  return typeof window !== 'undefined' && window.habiterAPI
    ? window.habiterAPI
    : null;
}

// ---------------------------------------------------------------------------
// Mood → emoji mapping
// ---------------------------------------------------------------------------

const MOOD_EMOJI: Record<Mood, string> = {
  great: '😄',
  good: '🙂',
  neutral: '😐',
  bad: '😔',
  terrible: '😫',
};

// ---------------------------------------------------------------------------
// Month names
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------------------------------------------------------------------------
// MoodTrackerStrip Component (TICKET-017)
// ---------------------------------------------------------------------------

export default function MoodTrackerStrip() {
  const year = useCheckinsStore((s) => s.year);
  const month = useCheckinsStore((s) => s.month);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all daily logs whenever the month changes
  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      const a = api();
      if (!a) return;
      setLoading(true);
      try {
        const all = await a.dailyLogs.list();
        if (!cancelled) {
          // Filter to the currently viewed month
          const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
          const filtered = all.filter((l) => l.date.startsWith(prefix));
          setLogs(filtered);
        }
      } catch (err) {
        console.error('[MoodTrackerStrip] Failed to load logs:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLogs();
    return () => { cancelled = true; };
  }, [year, month]);

  // Build a map of date → mood for quick lookup
  const moodMap = new Map<ISODate, Mood>();
  for (const log of logs) {
    if (log.mood) {
      moodMap.set(log.date, log.mood);
    }
  }

  const daysInMonth = getDaysInMonth(year, month);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <section className="bg-bg-secondary border border-border-subtle rounded-card px-5 py-4">
      <h3 className="text-h2 font-semibold text-text-primary mb-0.5">
        Mood Tracker
      </h3>
      <p className="text-small text-text-secondary mb-3">
        {MONTH_NAMES[month]} {year}
      </p>

      {loading ? (
        <div className="text-center py-4 text-text-secondary text-body">
          Loading…
        </div>
      ) : (
        <>
          {/* Emoji row */}
          <div className="flex gap-[3px]">
            {days.map((d) => {
              const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}` as ISODate;
              const mood = moodMap.get(dateStr);
              return (
                <div
                  key={d}
                  className="flex-1 flex items-center justify-center"
                  title={mood ? `${d} — ${mood}` : `${d} — no mood logged`}
                >
                  {mood ? (
                    <span className="text-base leading-none">{MOOD_EMOJI[mood]}</span>
                  ) : (
                    <span className="w-3 h-3 rounded-full bg-bg-elevated" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Day numbers row */}
          <div className="flex gap-[3px] mt-1.5">
            {days.map((d) => (
              <div
                key={d}
                className="flex-1 text-center text-[9px] text-text-secondary"
              >
                {d}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
