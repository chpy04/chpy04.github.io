// src/components/Experiences/EventCard.tsx
import { useRef, useState } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useStore } from "@/lib/store";
import * as THREE from "three";
import { eventXPos, TimelineEvent } from "./Timeline";

type EventCardProps = {
  event: TimelineEvent;
  position: [number, number, number];
};

export function EventCard({ event, position }: EventCardProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const {
    currentEventIdx,
    focussedMode,
    setFocussedMode,
    setTargetX,
    setTargetY,
    setTargetZ,
    zoomIn,
  } = useStore();

  const isActive = currentEventIdx === event.id;
  const [hovered, setHovered] = useState(false);

  // Animation
  useFrame((state) => {
    if (meshRef.current) {
      // Subtle animation
      meshRef.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.3) * 0.03;
      meshRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.2) * 0.03;

      // Scale based on focus/hover
      let targetScale = 1;
      if (isActive) targetScale = 1.2;
      else if (hovered) targetScale = 1.1;

      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1
      );
    }
  });

  const handleClick = () => {
    // Center camera on this event
    setTargetX(eventXPos(event));
    setTargetY(0);
    setTargetZ(5);
    setFocussedMode(false);

    // If we click an already-active event, zoom in
    if (isActive && !focussedMode) {
      zoomIn();
    }
  };

  return (
    <group position={position}>
      {/* Event card */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[4, 3, 0.2]} />
        <meshStandardMaterial
          color={isActive ? "#ff9900" : hovered ? "#e1f5fe" : event.color}
        />
      </mesh>

      {/* Event title */}
      <Text
        position={[0, 0.5, 0.2]}
        fontSize={0.4}
        color="#000000"
        anchorX="center"
        anchorY="middle"
      >
        {event.title}
      </Text>

      {/* Event date */}
      <Text
        position={[0, -0.5, 0.2]}
        fontSize={0.3}
        color="#000000"
        anchorX="center"
        anchorY="middle"
      >
        {event.date}
      </Text>
    </group>
  );
}
