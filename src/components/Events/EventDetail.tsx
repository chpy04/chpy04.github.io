// src/components/Experiences/EventDetail.tsx
import { useRef } from "react";
// import { Text } from "@react-three/drei";
// import { useFrame } from '@react-three/fiber';
import * as THREE from "three";

// Main component that selects which content to show based on detail level
type EventDetailProps = {
  eventIdx: number;
};

export function EventDetail({ eventIdx }: EventDetailProps) {
  const groupRef = useRef<THREE.Group>(null);
  console.log(eventIdx);

  return (
    <group ref={groupRef}>
      {/* Background panel */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry />
        <meshStandardMaterial color={"#9fa8da"} />
      </mesh>
    </group>
  );
}
