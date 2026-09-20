'use client';

import { useState } from 'react';
import TimelineCard from './TimelineCard';
import { dotClass } from './kindStyles';
import type { TimelineEntry } from '@/lib/types';

const INITIAL_VISIBLE = 5;

interface TimelineListProps {
  /** Sorted newest first. */
  entries: TimelineEntry[];
}

/** Vertical, rail-and-dot timeline used on phones. */
export default function TimelineList({ entries }: TimelineListProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? entries : entries.slice(0, INITIAL_VISIBLE);
  const hiddenCount = entries.length - visible.length;

  return (
    <div>
      <ol className="relative space-y-5 border-l border-line pl-6">
        {visible.map((entry) => (
          <li key={entry.id} className="relative">
            <span
              aria-hidden="true"
              className={`absolute top-6 -left-[27px] h-3 w-3 rounded-full ring-4 ring-canvas ${dotClass(
                entry.kind,
              )}`}
            />
            <TimelineCard entry={entry} />
          </li>
        ))}
      </ol>

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-5 w-full rounded-lg border border-line py-3 text-sm text-ink-dim transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
        >
          Show {hiddenCount} earlier {hiddenCount === 1 ? 'entry' : 'entries'}
        </button>
      ) : null}
    </div>
  );
}
