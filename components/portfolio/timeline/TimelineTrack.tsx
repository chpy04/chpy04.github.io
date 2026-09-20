'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import TimelineCard from './TimelineCard';
import { dotClass } from './kindStyles';
import { buildAxis, formatDateRange, lineRuns } from '@/lib/timeline';
import type { TimelineEntry } from '@/lib/types';

/** The axis stops short of the edges so a dot's ring is never clipped. */
const TRACK_MIN = 3;
const TRACK_MAX = 97;
/** Closest two dots may sit before they are nudged apart, in percent. */
const MIN_DOT_GAP = 2.4;

interface TimelineTrackProps {
  /** Sorted oldest first — `buildAxis` assumes it. */
  entries: TimelineEntry[];
}

/**
 * Horizontal, date-proportional timeline for tablet and up. Entries are
 * dots on a shared axis; the selected entry renders in a fixed panel below,
 * so cards can never overlap each other.
 *
 * All of the arithmetic — where each dot goes, which years get a label,
 * which stretches of line to draw — is in `lib/timeline.ts` and tested
 * there. This component only places what it is handed.
 */
export default function TimelineTrack({ entries }: TimelineTrackProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const axis = useMemo(
    () => buildAxis(entries, { trackMin: TRACK_MIN, trackMax: TRACK_MAX, minDotGap: MIN_DOT_GAP }),
    [entries],
  );
  const runs = useMemo(() => lineRuns(axis.gaps), [axis.gaps]);

  // Selection is held by id, not index: an edit to a date reorders the
  // list, and an index would silently jump to whichever entry took that
  // slot. Defaulting to the most recent is what the page opens on.
  const fallbackIndex = entries.length - 1;
  const selectedIndex = (() => {
    const found = entries.findIndex((entry) => entry.id === selectedId);
    return found === -1 ? fallbackIndex : found;
  })();
  const active = entries[selectedIndex];

  function move(delta: number): void {
    const next = Math.min(entries.length - 1, Math.max(0, selectedIndex + delta));
    setSelectedId(entries[next]?.id ?? null);
    dotRefs.current[next]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    const actions: Record<string, () => void> = {
      ArrowRight: () => move(1),
      ArrowLeft: () => move(-1),
      Home: () => move(-entries.length),
      End: () => move(entries.length),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  if (!active) return null;

  return (
    <div>
      {/* Year labels */}
      <div className="relative h-5">
        {axis.ticks.map((tick) => (
          <span
            key={tick.year}
            className="absolute -translate-x-1/2 text-xs text-ink-fainter"
            style={{ left: `${tick.pct}%` }}
          >
            {tick.year}
          </span>
        ))}
      </div>

      {/* Axis */}
      <div className="relative h-3">
        {runs.map((run) => (
          <div
            key={run.from}
            className="absolute top-1/2 h-px -translate-y-1/2 bg-line"
            style={{ left: `${run.from}%`, width: `${run.to - run.from}%` }}
          />
        ))}
        {axis.ticks.map((tick) => (
          <div
            key={tick.year}
            className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-line-strong"
            style={{ left: `${tick.pct}%` }}
          />
        ))}
        {axis.gaps.map((gap) => (
          <span
            key={gap.key}
            aria-hidden="true"
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] leading-none tracking-[0.2em] text-ink-faintest"
            style={{ left: `${(gap.from + gap.to) / 2}%` }}
          >
            &middot;&middot;&middot;
          </span>
        ))}
      </div>

      {/* Entry dots */}
      <div
        role="tablist"
        aria-label="Timeline entries"
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        className="relative h-12"
      >
        {entries.map((entry, index) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={entry.id}
              ref={(node) => {
                dotRefs.current[index] = node;
              }}
              role="tab"
              type="button"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onMouseEnter={() => setSelectedId(entry.id)}
              onFocus={() => setSelectedId(entry.id)}
              onClick={() => setSelectedId(entry.id)}
              style={{ left: `${axis.positions[index]}%` }}
              // Tall, narrow hit area: vertical room is free, but horizontal
              // room is limited by how close two entries can sit on the axis.
              className="group absolute top-0 flex h-11 w-6 -translate-x-1/2 items-center justify-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
            >
              <span className="sr-only">
                {entry.title}, {entry.organization}, {formatDateRange(entry.startsOn, entry.endsOn)}
              </span>
              <span
                aria-hidden="true"
                className={`block rounded-full transition-all duration-200 ${dotClass(entry.kind)} ${
                  isSelected
                    ? 'h-3.5 w-3.5 ring-4 ring-ink/15'
                    : 'h-2.5 w-2.5 opacity-60 group-hover:opacity-100'
                } ${entry.isArchived ? 'opacity-30' : ''}`}
              />
            </button>
          );
        })}
      </div>

      {/* Detail panel. Keyed on the entry so switching selection remounts
          the card and replays the entrance animation. */}
      <div role="tabpanel" className="relative min-h-[220px]">
        <div key={active.id} className="motion-safe:animate-fade-up">
          <TimelineCard entry={active} className="mx-auto max-w-3xl" />
        </div>
      </div>
    </div>
  );
}
