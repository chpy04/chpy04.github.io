import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
// import { Text } from '@react-three/drei';
import { EventCard } from "./EventCard";
import { useStore } from "@/lib/store";
import * as THREE from "three";
import { TIMELINE_WIDTH } from "@/lib/store/constants";

// Event type definition
export type TimelineEvent = {
  id: number;
  title: string;
  date: string;
  color?: string;
};

// Sample timeline data - note we now just use X position
const timelineEvents: TimelineEvent[] = [
  {
    id: 0,
    title: "Education",
    date: "2015-2019",
    color: "#e3f2fd",
  },
  {
    id: 1,
    title: "First Job",
    date: "2019-2021",
    color: "#bbdefb",
  },
  {
    id: 2,
    title: "Major Project",
    date: "2021-2022",
    color: "#90caf9",
  },
  {
    id: 3,
    title: "Current Work",
    date: "2022-Now",
    color: "#64b5f6",
  },
];

export const eventXPos = (event: TimelineEvent) => {
  return event.id * TIMELINE_WIDTH;
};

export function Timeline() {
  const lineRef = useRef<THREE.Mesh>(null);
  const { cameraX, setCurrentEvent, currentEventIdx, focussedMode } =
    useStore();

  // Find the current event based on camera X position
  useEffect(() => {
    if (focussedMode) return; // Don't change focused event while zoomed in

    // Find closest event to the camera
    let closestEvent = 0;
    let minDistance = Infinity;

    timelineEvents.forEach((event) => {
      const distance = Math.abs(eventXPos(event) - cameraX);
      if (distance < minDistance) {
        minDistance = distance;
        closestEvent = event.id;
      }
    });

    // Only update if it changed
    if (closestEvent !== currentEventIdx) {
      setCurrentEvent(closestEvent);
    }
  }, [cameraX, setCurrentEvent, currentEventIdx, focussedMode]);

  // Simple animation
  useFrame((state) => {
    if (lineRef.current) {
      lineRef.current.position.y =
        Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <group>
      {/* Timeline line */}
      <mesh ref={lineRef} position={[7.5, -2, 0]}>
        <boxGeometry args={[50, 0.1, 0.1]} />
        <meshStandardMaterial color="#cfd8dc" />
      </mesh>

      {/* Timeline events */}
      {timelineEvents.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          position={[eventXPos(event), 0, 0]}
        />
      ))}
    </group>
  );
}
