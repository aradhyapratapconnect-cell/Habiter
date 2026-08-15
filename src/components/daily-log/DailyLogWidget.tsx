import { useEffect, useRef, useState } from 'react';
import {
  useDailyLogsStore,
  MOOD_OPTIONS,
  moodToEmoji,
  formatDisplayDate,
} from '../../stores/dailyLogsStore';
import { isEditableDateISO } from '../../stores/checkinsStore';
import type { ISODate } from '../../types';
/**
 * Daily log widget for the header area (TICKET-016).
 *
 * Displays today's mood and sleep in a compact card. Clicking opens a
 * popover where the user can select a mood emoji and enter sleep hours.
 * Day navigation (‹ ›) lets the user log for past/future days.
 */
export default function DailyLogWidget() {
  const selectedDate = useDailyLogsStore((s) => s.selectedDate);
  const currentLog = useDailyLogsStore((s) => s.currentLog);
  const isEditing = useDailyLogsStore((s) => s.isEditing);
  const loadLog = useDailyLogsStore((s) => s.loadLog);
  const prevDay = useDailyLogsStore((s) => s.prevDay);
  const nextDay = useDailyLogsStore((s) => s.nextDay);
  const setMood = useDailyLogsStore((s) => s.setMood);
  const setSleep = useDailyLogsStore((s) => s.setSleep);
  const openEditor = useDailyLogsStore((s) => s.openEditor);
  const closeEditor = useDailyLogsStore((s) => s.closeEditor);

  const [sleepInput, setSleepInput] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load log on mount and when selected date changes
  useEffect(() => {
    loadLog();
  }, [selectedDate, loadLog]);

  // Populate sleep input when log loads
  useEffect(() => {
    if (currentLog?.sleep_hours != null) {
      setSleepInput(String(currentLog.sleep_hours));
    } else {
      setSleepInput('');
    }
  }, [currentLog]);

  // Close popover on outside click
  useEffect(() => {
    if (!isEditing) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        closeEditor();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isEditing, closeEditor]);

  const mood = currentLog?.mood ?? null;
  const sleepHours = currentLog?.sleep_hours ?? null;

  // TICKET-027: only today and yesterday are editable
  const editable = isEditableDateISO(selectedDate as ISODate);

  function handleSleepBlur() {
    const val = sleepInput.trim();
    if (val === '') {
      setSleep(null);
    } else {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0 && num <= 24) {
        setSleep(num);
      }
    }
  }

  function handleSleepKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      {/* Compact display card — click to open editor */}
      <button
        type="button"
        onClick={() => (isEditing ? closeEditor() : openEditor())}
        className="bg-bg-secondary border border-border-subtle rounded-card px-4 py-2.5 text-right hover:border-accent-primary/30 transition-colors cursor-pointer w-full"
      >
        <div className="text-small text-text-secondary mb-0.5 flex items-center justify-end gap-1.5">
          <span>Hours of Sleep</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          {sleepHours != null ? (
            <span className="text-body font-medium text-text-primary">
              {sleepHours}h
            </span>
          ) : (
            <span className="text-body text-text-disabled italic">
              Not logged
            </span>
          )}
          {mood && (
            <span className="text-lg leading-none">{moodToEmoji(mood)}</span>
          )}
        </div>
      </button>

      {/* Edit popover */}
      {isEditing && (
        <div className="absolute top-full right-0 mt-2 z-50 w-[280px] bg-bg-elevated border border-border-subtle rounded-modal shadow-2xl p-4">
          {/* Day navigation — TICKET-027: restricted to today / yesterday */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevDay}
              disabled={!editable}
              className={`w-7 h-7 flex items-center justify-center rounded-button transition-colors text-sm ${
                editable
                  ? 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                  : 'text-text-disabled cursor-not-allowed'
              }`}
            >
              ‹
            </button>
            <span className="text-body font-medium text-text-primary">
              {formatDisplayDate(selectedDate)}
            </span>
            <button
              onClick={nextDay}
              disabled={!editable}
              className={`w-7 h-7 flex items-center justify-center rounded-button transition-colors text-sm ${
                editable
                  ? 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                  : 'text-text-disabled cursor-not-allowed'
              }`}
            >
              ›
            </button>
          </div>

          {/* Mood selector — TICKET-027: disabled for dates outside the editable window */}
          <div className="mb-4">
            <label className="text-small text-text-secondary block mb-2">
              Mood
            </label>
            <div className={`flex gap-1.5 ${!editable ? 'opacity-50 pointer-events-none' : ''}`}>
              {MOOD_OPTIONS.map((opt) => (
                <button
                  key={opt.mood}
                  type="button"
                  onClick={() => setMood(mood === opt.mood ? null : opt.mood)}
                  disabled={!editable}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-button border transition-all ${
                    mood === opt.mood
                      ? 'bg-accent-primary/15 border-accent-primary/40 scale-105'
                      : 'bg-bg-secondary border-border-subtle hover:border-accent-primary/20'
                  }`}
                  title={opt.label}
                >
                  <span className="text-xl leading-none">{opt.emoji}</span>
                  <span className="text-[9px] text-text-secondary">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sleep hours input — TICKET-027: disabled for dates outside the editable window */}
          <div className={!editable ? 'opacity-50' : ''}>
            <label className="text-small text-text-secondary block mb-1.5">
              Hours of Sleep
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={sleepInput}
                onChange={(e) => setSleepInput(e.target.value)}
                onBlur={handleSleepBlur}
                onKeyDown={handleSleepKeyDown}
                placeholder="e.g. 7.5"
                disabled={!editable}
                className="flex-1 px-3 py-1.5 bg-bg-secondary border border-border-subtle rounded-input text-body text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-small text-text-secondary">hrs</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
