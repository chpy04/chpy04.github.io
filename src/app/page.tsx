"use client";

import Canvas from "@/components/Canvas";
import { useStore } from "@/lib/store";

export default function Home() {
  const { cameraX, cameraY, cameraZ, focussedMode } = useStore();
  return (
    <main className="w-screen h-screen overflow-hidden bg-slate-900">
      <div className="absolute top-4 left-4 z-10 text-white">
        <h1 className="text-xl font-bold">My Portfolio</h1>
        <p className="text-sm">
          Click and drag to navigate. Click on projects to focus.
        </p>
        <p>
          camera position: (x: {cameraX.toPrecision(2)}, y:{" "}
          {cameraY.toPrecision(2)}, z: {cameraZ.toPrecision(2)})
        </p>
        <p>focussedMode: {focussedMode ? "true" : "false"}</p>
      </div>
      <Canvas />
    </main>
  );
}
