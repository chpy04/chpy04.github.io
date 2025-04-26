// src/components/Canvas/Camera.tsx
import { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { useStore } from "@/lib/store";
import * as THREE from "three";
import type { PerspectiveCamera as PerspectiveCameraImpl } from "three";

export function Camera() {
  const cameraRef = useRef<PerspectiveCameraImpl>(null);
  const {
    cameraX,
    cameraY,
    cameraZ,
    targetCameraX,
    targetCameraY,
    targetCameraZ,
    setTargetX,
    setTargetY,
    setCameraX,
    setCameraY,
    setCameraZ,
    focussedMode,
    zoomIn,
    zoomOut,
  } = useStore();
  const { gl } = useThree();

  // Drag state
  const dragState = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startCameraX: 0,
    startCameraY: 0,
  });

  // Set up event handlers
  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = (e: MouseEvent) => {
      dragState.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        startCameraX: cameraX,
        startCameraY: cameraY,
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current.isDragging) return;

      const dragX =
        (e.clientX - dragState.current.startX) * 0.01 * (cameraZ / 10);
      const dragY =
        (e.clientY - dragState.current.startY) * 0.01 * (cameraZ / 10);

      if (focussedMode) {
        // In zoomed mode, allow full 3D panning
        const newX = dragState.current.startCameraX - dragX;
        const newY = dragState.current.startCameraY + dragY;

        setCameraX(newX);
        setCameraY(newY);

        // IMPORTANT: directly set targets too, so they stay synced
        setTargetX(newX);
        setTargetY(newY);
      } else {
        // In timeline mode, only allow horizontal panning
        const newX = dragState.current.startCameraX - dragX;
        setCameraX(newX);
        setTargetX(newX);
      }
    };

    const handleMouseUp = () => {
      dragState.current.isDragging = false;
    };

    // Zoom with mouse wheel
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    };

    // Add event listeners
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    // Clean up
    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [
    gl,
    cameraX,
    cameraY,
    cameraZ,
    focussedMode,
    setCameraX,
    setCameraY,
    zoomIn,
    zoomOut,
    setTargetX,
    setTargetY,
  ]);

  // Update camera position with smooth interpolation
  useFrame(() => {
    if (cameraRef.current) {
      const epsilon = 0.01; // threshold for "close enough"

      const dx = targetCameraX - cameraX;
      const dy = targetCameraY - cameraY;
      const dz = targetCameraZ - cameraZ;

      if (
        Math.abs(dx) < epsilon &&
        Math.abs(dy) < epsilon &&
        Math.abs(dz) < epsilon
      ) {
        // If already close enough, just snap exactly
        setCameraX(targetCameraX);
        setCameraY(targetCameraY);
        setCameraZ(targetCameraZ);
        cameraRef.current.position.set(
          targetCameraX,
          targetCameraY,
          targetCameraZ
        );
      } else {
        // Otherwise keep moving smoothly
        const newCameraX = THREE.MathUtils.lerp(cameraX, targetCameraX, 0.1);
        const newCameraY = THREE.MathUtils.lerp(cameraY, targetCameraY, 0.1);
        const newCameraZ = THREE.MathUtils.lerp(cameraZ, targetCameraZ, 0.1);

        setCameraX(newCameraX);
        setCameraY(newCameraY);
        setCameraZ(newCameraZ);
        cameraRef.current.position.set(newCameraX, newCameraY, newCameraZ);
      }

      // Always look toward the "infinite Z" axis
      cameraRef.current.lookAt(
        cameraRef.current.position.x,
        cameraRef.current.position.y,
        -1000
      );
    }
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={[cameraX, cameraY, cameraZ]}
      fov={75}
    />
  );
}
