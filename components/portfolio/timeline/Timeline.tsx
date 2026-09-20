'use client';

import { useMemo } from 'react';
import TimelineList from './TimelineList';
import TimelineTrack from './TimelineTrack';
import AddButton from '@/components/admin/AddButton';
import Section from '@/components/portfolio/Section';
import { useSite } from '@/components/SiteProvider';

/**
 * Renders both layouts and lets CSS pick one, so there is no hydration-time
 * viewport check and no flash of the wrong layout.
 *
 * The cost is that every card is in the DOM twice. That is fine at this
 * size and is the trade the original made; if the timeline ever grows past
 * a few dozen entries, this is the line to revisit.
 */
export default function Timeline() {
  const { content, showArchived, addTimelineEntry } = useSite();

  // Already ascending from the server (`order by starts_on, id`) and kept
  // that way by the provider, so this only filters.
  const ascending = useMemo(
    () => content.timeline.filter((entry) => showArchived || !entry.isArchived),
    [content.timeline, showArchived],
  );
  const descending = useMemo(() => [...ascending].reverse(), [ascending]);

  return (
    <Section id="timeline" title="Timeline">
      <div className="tablet:hidden">
        <TimelineList entries={descending} />
      </div>
      <div className="hidden tablet:block">
        <TimelineTrack entries={ascending} />
      </div>
      <AddButton label="Timeline entry" onClick={addTimelineEntry} className="mt-5" />
    </Section>
  );
}
