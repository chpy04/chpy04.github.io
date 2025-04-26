// src/components/Canvas/World.tsx
import { Timeline } from "@/components/Events/Timeline";
import { EventDetail } from "@/components/Events/EventDetail";
import { useStore } from "@/lib/store";

export function World() {
  const { currentEventIdx, focussedMode } = useStore();

  return (
    <group>
      {/* Always render the timeline */}
      <Timeline />

      {/* Render detailed content when zoomed in */}
      {currentEventIdx && focussedMode && (
        <EventDetail eventIdx={currentEventIdx} />
      )}
    </group>
  );
}
