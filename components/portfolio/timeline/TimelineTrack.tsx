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
/** Where the card's midpoint sits, in percent: it is `mx-auto` in a row the
 *  two step buttons flank symmetrically, so it is centred whatever the
 *  viewport. The leader line's lower half is anchored here. */
const CARD_CENTRE = 50;

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

  /**
   * `focusDot` is what separates the two callers. The tablist's own arrow
   * keys must move focus with the selection — that is the roving-tabindex
   * contract. The step buttons must not: focus belongs on the button you
   * are about to click again, and stealing it would strand the pointer user
   * mid-sequence.
   */
  function move(delta: number, focusDot = true): void {
    const next = Math.min(entries.length - 1, Math.max(0, selectedIndex + delta));
    setSelectedId(entries[next]?.id ?? null);
    if (focusDot) dotRefs.current[next]?.focus();
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

  const selectedPct = axis.positions[selectedIndex] ?? CARD_CENTRE;
  // The leader takes the selected entry's own colour, which is what ties it
  // to the dot it left rather than to the card it lands on.
  const leaderClass = `${dotClass(active.kind)} opacity-50`;

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
                    ? 'h-4 w-4 ring-4 ring-ink/30'
                    : 'h-2 w-2 opacity-50 group-hover:opacity-100'
                } ${entry.isArchived ? 'opacity-30' : ''}`}
              />
            </button>
          );
        })}
      </div>

      {/* Leader line. Emphasising the dot alone cannot say which card is
          showing — the card is centred a long way below it and two dots can
          sit 2.4% apart — so the selection is drawn as a path the eye can
          follow: down from the dot, across, then down into the card's top
          edge. `-mt-4` pulls it into the empty lower half of the dots row so
          it starts at the dot rather than below the hit areas, which is also
          why it may not swallow pointer events. */}
      <div aria-hidden="true" className="pointer-events-none relative -mt-4 h-10">
        <span
          className={`absolute top-0 h-5 w-px -translate-x-1/2 transition-all duration-200 ${leaderClass}`}
          style={{ left: `${selectedPct}%` }}
        />
        <span
          className={`absolute top-5 h-px transition-all duration-200 ${leaderClass}`}
          style={{
            left: `${Math.min(selectedPct, CARD_CENTRE)}%`,
            width: `${Math.abs(CARD_CENTRE - selectedPct)}%`,
          }}
        />
        <span
          className={`absolute top-5 h-5 w-px -translate-x-1/2 ${leaderClass}`}
          style={{ left: `${CARD_CENTRE}%` }}
        />
      </div>

      {/* Detail panel. The step buttons flank the card rather than the dots:
          neighbouring dots can be 2.4% apart, so axis-anchored arrows would
          overlap them and jump horizontally on every step (D-025). They are
          flex siblings, not absolutely positioned, so at tablet width — where
          the card fills the shell and there is no dead space — the card
          narrows instead of the arrows landing on top of it.

          Keyed on the entry so switching selection remounts the card and
          replays the entrance animation. */}
      <div
        role="tabpanel"
        // `items-start`, not `items-center`: `min-h` is taller than a short
        // card, and centring one inside it floats its top edge away from the
        // leader line that is supposed to meet it.
        className="relative flex min-h-[220px] items-start justify-center gap-2 tablet:gap-4"
      >
        <StepButton direction={-1} disabled={selectedIndex === 0} onClick={() => move(-1, false)} />
        <div key={active.id} className="min-w-0 max-w-3xl flex-1 motion-safe:animate-fade-up">
          <TimelineCard entry={active} />
        </div>
        <StepButton
          direction={1}
          disabled={selectedIndex === entries.length - 1}
          onClick={() => move(1, false)}
        />
      </div>
    </div>
  );
}

interface StepButtonProps {
  direction: 1 | -1;
  disabled: boolean;
  onClick: () => void;
}

/**
 * Previous/next through the entries in date order. Disabled at either end
 * rather than wrapping: wrapping from the newest entry back to the oldest
 * destroys the one thing a date-proportional axis is for, which is knowing
 * where on it you are.
 */
function StepButton({ direction, disabled, onClick }: StepButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === -1 ? 'Show previous timeline entry' : 'Show next timeline entry'}
      className="shrink-0 self-center rounded-full border border-line p-2 text-ink-dim transition-colors enabled:hover:border-line-hover enabled:hover:bg-surface enabled:hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 disabled:cursor-not-allowed disabled:opacity-25"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={direction === -1 ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
        />
      </svg>
    </button>
  );
}
